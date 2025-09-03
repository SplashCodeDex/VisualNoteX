/**
 * Performance Monitor - Comprehensive performance tracking and analysis
 * Provides real-time metrics, historical data, and performance insights
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'rendering' | 'memory' | 'interaction' | 'network' | 'system';
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  summary: {
    averageFPS: number;
    memoryUsage: number;
    renderTime: number;
    interactionLatency: number;
  };
  metrics: PerformanceMetric[];
  alerts: PerformanceAlert[];
  recommendations: string[];
  timestamp: number;
}

export interface PerformanceAlert {
  type: 'warning' | 'critical' | 'info';
  message: string;
  metric: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private observers: Set<(report: PerformanceReport) => void> = new Set();
  private isMonitoring = false;
  private monitoringInterval: number | null = null;

  // Performance thresholds
  private thresholds = {
    maxRenderTime: 16.67, // ~60fps
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxInteractionLatency: 100, // 100ms
    minFPS: 30
  };

  constructor() {
    this.initializeMonitoring();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = window.setInterval(() => {
      this.collectMetrics();
      this.analyzePerformance();
      this.notifyObservers();
    }, intervalMs);

    console.log('📊 Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('📊 Performance monitoring stopped');
  }

  /**
   * Record a custom performance metric
   */
  recordMetric(
    name: string,
    value: number,
    category: PerformanceMetric['category'],
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      category,
      metadata
    };

    this.metrics.push(metric);

    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Check for alerts
    this.checkThresholds(metric);
  }

  /**
   * Get current performance report
   */
  getPerformanceReport(): PerformanceReport {
    const recentMetrics = this.getRecentMetrics(60000); // Last minute

    const summary = {
      averageFPS: this.calculateAverageFPS(recentMetrics),
      memoryUsage: this.getCurrentMemoryUsage(),
      renderTime: this.calculateAverageRenderTime(recentMetrics),
      interactionLatency: this.calculateAverageInteractionLatency(recentMetrics)
    };

    const recommendations = this.generateRecommendations(summary);

    return {
      summary,
      metrics: recentMetrics,
      alerts: this.alerts.slice(-10), // Last 10 alerts
      recommendations,
      timestamp: Date.now()
    };
  }

  /**
   * Subscribe to performance updates
   */
  subscribe(callback: (report: PerformanceReport) => void): () => void {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  /**
   * Export performance data for analysis
   */
  exportData(): {
    metrics: PerformanceMetric[];
    alerts: PerformanceAlert[];
    summary: PerformanceReport['summary'];
  } {
    return {
      metrics: [...this.metrics],
      alerts: [...this.alerts],
      summary: this.getPerformanceReport().summary
    };
  }

  /**
   * Clear all performance data
   */
  clearData(): void {
    this.metrics = [];
    this.alerts = [];
  }

  private initializeMonitoring(): void {
    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.recordMetric('page_hidden', 1, 'system', { visibilityState: 'hidden' });
      } else {
        this.recordMetric('page_visible', 1, 'system', { visibilityState: 'visible' });
      }
    });

    // Monitor memory usage if available
    if ('memory' in performance) {
      this.recordMetric('initial_memory', this.getCurrentMemoryUsage(), 'memory');
    }

    // Monitor network status
    window.addEventListener('online', () => {
      this.recordMetric('network_online', 1, 'network');
    });

    window.addEventListener('offline', () => {
      this.recordMetric('network_offline', 1, 'network');
    });
  }

  private collectMetrics(): void {
    // Memory usage
    const memoryUsage = this.getCurrentMemoryUsage();
    if (memoryUsage > 0) {
      this.recordMetric('memory_usage', memoryUsage, 'memory');
    }

    // Frame rate (rough estimation)
    const fps = this.estimateFPS();
    if (fps > 0) {
      this.recordMetric('estimated_fps', fps, 'rendering');
    }

    // Page responsiveness
    const responsiveness = this.measureResponsiveness();
    this.recordMetric('page_responsiveness', responsiveness, 'interaction');
  }

  private analyzePerformance(): void {
    const report = this.getPerformanceReport();

    // Analyze trends
    const memoryTrend = this.analyzeTrend('memory_usage', 5);
    const fpsTrend = this.analyzeTrend('estimated_fps', 5);

    if (memoryTrend > 0.1) { // Memory increasing significantly
      this.createAlert('warning', 'Memory usage is increasing', 'memory_usage',
        this.thresholds.maxMemoryUsage, report.summary.memoryUsage);
    }

    if (fpsTrend < -0.2) { // FPS decreasing significantly
      this.createAlert('warning', 'Frame rate is decreasing', 'estimated_fps',
        this.thresholds.minFPS, report.summary.averageFPS);
    }
  }

  private checkThresholds(metric: PerformanceMetric): void {
    switch (metric.name) {
      case 'render_time':
        if (metric.value > this.thresholds.maxRenderTime) {
          this.createAlert('warning', 'Render time exceeded threshold', metric.name,
            this.thresholds.maxRenderTime, metric.value);
        }
        break;

      case 'memory_usage':
        if (metric.value > this.thresholds.maxMemoryUsage) {
          this.createAlert('critical', 'Memory usage exceeded threshold', metric.name,
            this.thresholds.maxMemoryUsage, metric.value);
        }
        break;

      case 'interaction_latency':
        if (metric.value > this.thresholds.maxInteractionLatency) {
          this.createAlert('warning', 'Interaction latency exceeded threshold', metric.name,
            this.thresholds.maxInteractionLatency, metric.value);
        }
        break;

      case 'estimated_fps':
        if (metric.value < this.thresholds.minFPS) {
          this.createAlert('warning', 'FPS below threshold', metric.name,
            this.thresholds.minFPS, metric.value);
        }
        break;
    }
  }

  private createAlert(
    type: PerformanceAlert['type'],
    message: string,
    metric: string,
    threshold: number,
    currentValue: number
  ): void {
    const alert: PerformanceAlert = {
      type,
      message,
      metric,
      threshold,
      currentValue,
      timestamp: Date.now()
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    console.warn(`🚨 Performance Alert [${type.toUpperCase()}]: ${message}`);
  }

  private notifyObservers(): void {
    if (this.observers.size > 0) {
      const report = this.getPerformanceReport();
      this.observers.forEach(callback => {
        try {
          callback(report);
        } catch (error) {
          console.error('Error in performance observer:', error);
        }
      });
    }
  }

  private getRecentMetrics(timeWindowMs: number): PerformanceMetric[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.metrics.filter(metric => metric.timestamp >= cutoff);
  }

  private calculateAverageFPS(metrics: PerformanceMetric[]): number {
    const fpsMetrics = metrics.filter(m => m.name === 'estimated_fps');
    if (fpsMetrics.length === 0) return 0;

    const sum = fpsMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / fpsMetrics.length;
  }

  private calculateAverageRenderTime(metrics: PerformanceMetric[]): number {
    const renderMetrics = metrics.filter(m => m.name === 'render_time');
    if (renderMetrics.length === 0) return 0;

    const sum = renderMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / renderMetrics.length;
  }

  private calculateAverageInteractionLatency(metrics: PerformanceMetric[]): number {
    const latencyMetrics = metrics.filter(m => m.name === 'interaction_latency');
    if (latencyMetrics.length === 0) return 0;

    const sum = latencyMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / latencyMetrics.length;
  }

  private getCurrentMemoryUsage(): number {
    const memInfo = (performance as any).memory;
    return memInfo ? memInfo.usedJSHeapSize : 0;
  }

  private estimateFPS(): number {
    // Simple FPS estimation based on requestAnimationFrame timing
    let lastTime = performance.now();
    let frameCount = 0;

    return new Promise<number>((resolve) => {
      const countFrame = () => {
        frameCount++;
        const currentTime = performance.now();

        if (currentTime - lastTime >= 1000) { // 1 second window
          const fps = (frameCount * 1000) / (currentTime - lastTime);
          resolve(fps);
        } else {
          requestAnimationFrame(countFrame);
        }
      };

      requestAnimationFrame(countFrame);

      // Timeout after 2 seconds
      setTimeout(() => resolve(0), 2000);
    });
  }

  private measureResponsiveness(): number {
    const start = performance.now();
    // Simple responsiveness test
    setTimeout(() => {
      const latency = performance.now() - start;
      this.recordMetric('interaction_latency', latency, 'interaction');
    }, 0);
    return performance.now() - start;
  }

  private analyzeTrend(metricName: string, windowSize: number): number {
    const metrics = this.metrics.filter(m => m.name === metricName).slice(-windowSize);
    if (metrics.length < 2) return 0;

    const first = metrics[0].value;
    const last = metrics[metrics.length - 1].value;

    return (last - first) / first; // Percentage change
  }

  private generateRecommendations(summary: PerformanceReport['summary']): string[] {
    const recommendations: string[] = [];

    if (summary.memoryUsage > this.thresholds.maxMemoryUsage * 0.8) {
      recommendations.push('Consider reducing the number of elements on the canvas');
      recommendations.push('Enable virtual scrolling for better memory management');
    }

    if (summary.averageFPS < this.thresholds.minFPS) {
      recommendations.push('Reduce canvas complexity or enable performance optimizations');
      recommendations.push('Consider using Web Workers for heavy computations');
    }

    if (summary.renderTime > this.thresholds.maxRenderTime) {
      recommendations.push('Optimize React components with memoization');
      recommendations.push('Implement virtual scrolling for large canvases');
    }

    if (summary.interactionLatency > this.thresholds.maxInteractionLatency) {
      recommendations.push('Optimize event handlers with throttling');
      recommendations.push('Consider debouncing rapid interactions');
    }

    return recommendations;
  }
}

/**
 * React hook for using performance monitor
 */
import { useState, useEffect, useCallback } from 'react';

export function usePerformanceMonitor(autoStart: boolean = true) {
  const [monitor] = useState(() => new PerformanceMonitor());
  const [report, setReport] = useState<PerformanceReport | null>(null);

  useEffect(() => {
    if (autoStart) {
      monitor.startMonitoring();
    }

    const unsubscribe = monitor.subscribe((newReport) => {
      setReport(newReport);
    });

    return () => {
      unsubscribe();
      monitor.stopMonitoring();
    };
  }, [monitor, autoStart]);

  const recordMetric = useCallback((
    name: string,
    value: number,
    category: PerformanceMetric['category'],
    metadata?: Record<string, any>
  ) => {
    monitor.recordMetric(name, value, category, metadata);
  }, [monitor]);

  const getReport = useCallback(() => {
    return monitor.getPerformanceReport();
  }, [monitor]);

  const exportData = useCallback(() => {
    return monitor.exportData();
  }, [monitor]);

  return {
    report,
    recordMetric,
    getReport,
    exportData,
    startMonitoring: () => monitor.startMonitoring(),
    stopMonitoring: () => monitor.stopMonitoring(),
    clearData: () => monitor.clearData()
  };
}

/**
 * Performance benchmark utilities
 */
export class PerformanceBenchmark {
  static async benchmarkFunction<T>(
    name: string,
    fn: () => T | Promise<T>,
    iterations: number = 100
  ): Promise<{
    name: string;
    averageTime: number;
    minTime: number;
    maxTime: number;
    iterations: number;
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    return {
      name,
      averageTime,
      minTime,
      maxTime,
      iterations
    };
  }

  static async benchmarkMemoryUsage<T>(
    name: string,
    fn: () => T | Promise<T>
  ): Promise<{
    name: string;
    memoryBefore: number;
    memoryAfter: number;
    memoryDelta: number;
  }> {
    const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0;

    await fn();

    const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryDelta = memoryAfter - memoryBefore;

    return {
      name,
      memoryBefore,
      memoryAfter,
      memoryDelta
    };
  }
}