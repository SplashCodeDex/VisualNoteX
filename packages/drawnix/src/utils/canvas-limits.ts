/**
 * Canvas Limits - Intelligent management of canvas size and element count
 * Provides warnings and automatic optimizations for large canvases
 */

import { PlaitElement, Point } from '@plait/core';

export interface CanvasLimits {
  maxElements: number;
  maxCanvasWidth: number;
  maxCanvasHeight: number;
  warningThreshold: number;
  criticalThreshold: number;
  enableAutoOptimization: boolean;
}

export interface CanvasMetrics {
  elementCount: number;
  canvasWidth: number;
  canvasHeight: number;
  averageElementSize: number;
  memoryUsage: number;
  performanceScore: number;
}

export interface LimitWarning {
  type: 'warning' | 'critical' | 'info';
  message: string;
  suggestion?: string;
  autoFix?: () => void;
}

export class CanvasLimitsManager {
  private limits: Required<CanvasLimits>;
  private metrics: CanvasMetrics;
  private warnings: LimitWarning[] = [];
  private autoOptimizationEnabled = true;

  constructor(limits: CanvasLimits = {}) {
    this.limits = {
      maxElements: 1000,
      maxCanvasWidth: 10000,
      maxCanvasHeight: 10000,
      warningThreshold: 0.7,
      criticalThreshold: 0.9,
      enableAutoOptimization: true,
      ...limits
    };

    this.metrics = {
      elementCount: 0,
      canvasWidth: 0,
      canvasHeight: 0,
      averageElementSize: 0,
      memoryUsage: 0,
      performanceScore: 1.0
    };

    this.autoOptimizationEnabled = this.limits.enableAutoOptimization;
  }

  /**
   * Update canvas metrics and check limits
   */
  updateMetrics(elements: PlaitElement[], canvasBounds?: { width: number; height: number }): LimitWarning[] {
    this.metrics.elementCount = elements.length;

    if (canvasBounds) {
      this.metrics.canvasWidth = canvasBounds.width;
      this.metrics.canvasHeight = canvasBounds.height;
    }

    // Calculate average element size
    if (elements.length > 0) {
      const totalSize = elements.reduce((sum, element) => {
        if (element.points && element.points.length > 0) {
          const bounds = this.calculateElementBounds(element.points);
          return sum + (bounds.width * bounds.height);
        }
        return sum;
      }, 0);
      this.metrics.averageElementSize = totalSize / elements.length;
    }

    // Estimate memory usage
    this.metrics.memoryUsage = this.estimateMemoryUsage(elements);

    // Calculate performance score
    this.metrics.performanceScore = this.calculatePerformanceScore();

    // Check limits and generate warnings
    this.warnings = this.checkLimits();

    // Apply auto-optimizations if enabled
    if (this.autoOptimizationEnabled && this.warnings.some(w => w.type === 'critical')) {
      this.applyAutoOptimizations(elements);
    }

    return [...this.warnings];
  }

  /**
   * Check if adding an element would exceed limits
   */
  canAddElement(element: PlaitElement, existingElements: PlaitElement[]): boolean {
    const newCount = existingElements.length + 1;
    const elementSize = element.points ? this.calculateElementBounds(element.points) : { width: 100, height: 100 };

    // Check element count
    if (newCount > this.limits.maxElements) {
      return false;
    }

    // Check canvas bounds if element has position
    if (element.points && element.points.length > 0) {
      const bounds = this.calculateElementBounds(element.points);
      if (bounds.right > this.limits.maxCanvasWidth || bounds.bottom > this.limits.maxCanvasHeight) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get current canvas metrics
   */
  getMetrics(): CanvasMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current warnings
   */
  getWarnings(): LimitWarning[] {
    return [...this.warnings];
  }

  /**
   * Update limits dynamically
   */
  updateLimits(newLimits: Partial<CanvasLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
  }

  /**
   * Enable or disable auto-optimization
   */
  setAutoOptimization(enabled: boolean): void {
    this.autoOptimizationEnabled = enabled;
  }

  /**
   * Get recommended canvas settings based on device capabilities
   */
  getRecommendedLimits(): Partial<CanvasLimits> {
    const deviceMemory = (navigator as any).deviceMemory || 4;
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;

    // Adjust limits based on device capabilities
    const memoryMultiplier = Math.min(deviceMemory / 4, 2);
    const cpuMultiplier = Math.min(hardwareConcurrency / 4, 2);

    return {
      maxElements: Math.floor(1000 * memoryMultiplier * cpuMultiplier),
      maxCanvasWidth: Math.floor(10000 * memoryMultiplier),
      maxCanvasHeight: Math.floor(10000 * memoryMultiplier),
      warningThreshold: 0.6,
      criticalThreshold: 0.8
    };
  }

  private checkLimits(): LimitWarning[] {
    const warnings: LimitWarning[] = [];

    // Check element count
    const elementRatio = this.metrics.elementCount / this.limits.maxElements;

    if (elementRatio >= this.limits.criticalThreshold) {
      warnings.push({
        type: 'critical',
        message: `Canvas has ${this.metrics.elementCount} elements, exceeding ${Math.floor(this.limits.criticalThreshold * 100)}% of limit (${this.limits.maxElements})`,
        suggestion: 'Consider removing unused elements or splitting into multiple canvases',
        autoFix: () => this.optimizeElementCount()
      });
    } else if (elementRatio >= this.limits.warningThreshold) {
      warnings.push({
        type: 'warning',
        message: `Canvas has ${this.metrics.elementCount} elements, approaching limit (${this.limits.maxElements})`,
        suggestion: 'Performance may degrade with more elements'
      });
    }

    // Check canvas size
    const sizeRatio = Math.max(
      this.metrics.canvasWidth / this.limits.maxCanvasWidth,
      this.metrics.canvasHeight / this.limits.maxCanvasHeight
    );

    if (sizeRatio >= this.limits.criticalThreshold) {
      warnings.push({
        type: 'critical',
        message: `Canvas size (${this.metrics.canvasWidth}x${this.metrics.canvasHeight}) exceeds ${Math.floor(this.limits.criticalThreshold * 100)}% of limit`,
        suggestion: 'Consider reducing canvas size or using zoom',
        autoFix: () => this.optimizeCanvasSize()
      });
    } else if (sizeRatio >= this.limits.warningThreshold) {
      warnings.push({
        type: 'warning',
        message: `Canvas size is large and may impact performance`,
        suggestion: 'Consider using zoom for better performance'
      });
    }

    // Check memory usage
    if (this.metrics.memoryUsage > 50 * 1024 * 1024) { // 50MB
      warnings.push({
        type: 'warning',
        message: `High memory usage detected (${Math.round(this.metrics.memoryUsage / 1024 / 1024)}MB)`,
        suggestion: 'Consider reducing element count or complexity'
      });
    }

    // Performance score warnings
    if (this.metrics.performanceScore < 0.5) {
      warnings.push({
        type: 'critical',
        message: 'Performance score is critically low',
        suggestion: 'Immediate optimization required',
        autoFix: () => this.applyEmergencyOptimizations()
      });
    } else if (this.metrics.performanceScore < 0.7) {
      warnings.push({
        type: 'warning',
        message: 'Performance score is low',
        suggestion: 'Consider optimizing canvas content'
      });
    }

    return warnings;
  }

  private calculateElementBounds(points: Point[]): { width: number; height: number; right: number; bottom: number } {
    if (points.length === 0) {
      return { width: 0, height: 0, right: 0, bottom: 0 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    points.forEach(point => {
      minX = Math.min(minX, point[0]);
      maxX = Math.max(maxX, point[0]);
      minY = Math.min(minY, point[1]);
      maxY = Math.max(maxY, point[1]);
    });

    return {
      width: maxX - minX,
      height: maxY - minY,
      right: maxX,
      bottom: maxY
    };
  }

  private estimateMemoryUsage(elements: PlaitElement[]): number {
    let memoryUsage = 0;

    elements.forEach(element => {
      // Base memory per element
      memoryUsage += 1000; // ~1KB per element

      // Memory for points
      if (element.points) {
        memoryUsage += element.points.length * 16; // 16 bytes per point (2 numbers)
      }

      // Memory for text content
      if ((element as any).text) {
        memoryUsage += (element as any).text.length * 2; // 2 bytes per character
      }

      // Memory for complex shapes
      if (element.type === 'freehand' && element.points) {
        memoryUsage += element.points.length * 8; // Additional smoothing data
      }
    });

    return memoryUsage;
  }

  private calculatePerformanceScore(): number {
    let score = 1.0;

    // Element count impact
    const elementRatio = this.metrics.elementCount / this.limits.maxElements;
    score *= Math.max(0.1, 1 - elementRatio * 2);

    // Canvas size impact
    const sizeRatio = Math.max(
      this.metrics.canvasWidth / this.limits.maxCanvasWidth,
      this.metrics.canvasHeight / this.limits.maxCanvasHeight
    );
    score *= Math.max(0.1, 1 - sizeRatio * 1.5);

    // Memory impact
    const memoryRatio = this.metrics.memoryUsage / (100 * 1024 * 1024); // 100MB baseline
    score *= Math.max(0.1, 1 - memoryRatio);

    // Element complexity impact
    if (this.metrics.averageElementSize > 10000) { // Large elements
      score *= 0.8;
    }

    return Math.max(0, Math.min(1, score));
  }

  private applyAutoOptimizations(elements: PlaitElement[]): void {
    console.log('[CanvasLimitsManager] Applying auto-optimizations...');

    // This would trigger various optimization strategies
    // In a real implementation, this would coordinate with other optimization systems
  }

  private optimizeElementCount(): void {
    console.log('[CanvasLimitsManager] Optimizing element count...');
    // Implementation would remove redundant or off-screen elements
  }

  private optimizeCanvasSize(): void {
    console.log('[CanvasLimitsManager] Optimizing canvas size...');
    // Implementation would suggest canvas resizing or viewport adjustments
  }

  private applyEmergencyOptimizations(): void {
    console.log('[CanvasLimitsManager] Applying emergency optimizations...');
    // Implementation would apply most aggressive optimizations
  }
}

/**
 * React hook for canvas limits management
 */
import { useState, useEffect, useCallback, useMemo } from 'react';

export function useCanvasLimits(
  elements: PlaitElement[],
  canvasBounds?: { width: number; height: number },
  limits?: CanvasLimits
) {
  const [manager] = useState(() => new CanvasLimitsManager(limits));
  const [warnings, setWarnings] = useState<LimitWarning[]>([]);
  const [metrics, setMetrics] = useState<CanvasMetrics | null>(null);

  // Update metrics when elements or bounds change
  useEffect(() => {
    const newWarnings = manager.updateMetrics(elements, canvasBounds);
    setWarnings(newWarnings);
    setMetrics(manager.getMetrics());
  }, [manager, elements, canvasBounds]);

  const canAddElement = useCallback((element: PlaitElement) => {
    return manager.canAddElement(element, elements);
  }, [manager, elements]);

  const updateLimits = useCallback((newLimits: Partial<CanvasLimits>) => {
    manager.updateLimits(newLimits);
  }, [manager]);

  const setAutoOptimization = useCallback((enabled: boolean) => {
    manager.setAutoOptimization(enabled);
  }, [manager]);

  const getRecommendedLimits = useCallback(() => {
    return manager.getRecommendedLimits();
  }, [manager]);

  // Memoize expensive calculations
  const performanceScore = useMemo(() => {
    return metrics?.performanceScore || 1.0;
  }, [metrics?.performanceScore]);

  const isNearLimit = useMemo(() => {
    return warnings.some(w => w.type === 'warning' || w.type === 'critical');
  }, [warnings]);

  return {
    warnings,
    metrics,
    canAddElement,
    updateLimits,
    setAutoOptimization,
    getRecommendedLimits,
    performanceScore,
    isNearLimit
  };
}

/**
 * Canvas limits presets for different use cases
 */
export const CanvasLimitPresets = {
  // For simple diagrams
  simple: {
    maxElements: 500,
    maxCanvasWidth: 5000,
    maxCanvasHeight: 5000,
    warningThreshold: 0.6,
    criticalThreshold: 0.8
  },

  // For complex diagrams
  complex: {
    maxElements: 2000,
    maxCanvasWidth: 15000,
    maxCanvasHeight: 15000,
    warningThreshold: 0.7,
    criticalThreshold: 0.85
  },

  // For high-performance devices
  highPerformance: {
    maxElements: 5000,
    maxCanvasWidth: 25000,
    maxCanvasHeight: 25000,
    warningThreshold: 0.8,
    criticalThreshold: 0.9
  },

  // For low-performance devices
  lowPerformance: {
    maxElements: 200,
    maxCanvasWidth: 3000,
    maxCanvasHeight: 3000,
    warningThreshold: 0.5,
    criticalThreshold: 0.7
  }
} as const;