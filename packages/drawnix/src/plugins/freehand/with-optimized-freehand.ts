/**
 * Optimized Freehand Plugin - Performance-enhanced version with Web Worker support
 * Provides better performance for freehand drawing while maintaining backward compatibility
 */

import {
  PlaitBoard,
  PlaitElement,
  PlaitOptionsBoard,
  PlaitPluginElementContext,
  RectangleClient,
  Selection,
} from '@plait/core';
import { Freehand, FREEHAND_TYPE } from './type';
import { FreehandComponent } from './freehand.component';
import { OptimizedFreehandComponent, createFreehandComponent } from './optimized-component';
import { withFreehandCreate } from './with-freehand-create';
import { isHitFreehand, isRectangleHitFreehand } from './utils';
import { withFreehandFragment } from './with-freehand-fragment';
import {
  getHitDrawElement,
  WithDrawOptions,
  WithDrawPluginKey,
} from '@plait/draw';
import { withFreehandErase } from './with-freehand-erase';

export interface FreehandOptimizationOptions {
  enableOptimization?: boolean;
  minPointsForOptimization?: number;
  useWebWorkers?: boolean;
  adaptiveRendering?: boolean;
}

const DEFAULT_OPTIMIZATION_OPTIONS: Required<FreehandOptimizationOptions> = {
  enableOptimization: true,
  minPointsForOptimization: 20,
  useWebWorkers: true,
  adaptiveRendering: true,
};

export const withOptimizedFreehand = (
  board: PlaitBoard,
  options: FreehandOptimizationOptions = {}
) => {
  const optimizationOptions = { ...DEFAULT_OPTIMIZATION_OPTIONS, ...options };

  const {
    getRectangle,
    drawElement,
    isHit,
    isRectangleHit,
    getOneHitElement,
    isMovable,
    isAlign,
  } = board;

  // Feature detection
  const canUseOptimization = optimizationOptions.enableOptimization &&
                            typeof Worker !== 'undefined' &&
                            !board.options?.readonly;

  board.drawElement = (context: PlaitPluginElementContext) => {
    if (Freehand.isFreehand(context.element)) {
      // Use optimized component for large strokes when beneficial
      if (canUseOptimization &&
          context.element.points.length >= optimizationOptions.minPointsForOptimization) {
        return OptimizedFreehandComponent;
      }
      // Fallback to original component
      return FreehandComponent;
    }
    return drawElement(context);
  };

  board.getRectangle = (element: PlaitElement) => {
    if (Freehand.isFreehand(element)) {
      return RectangleClient.getRectangleByPoints(element.points);
    }
    return getRectangle(element);
  };

  board.isRectangleHit = (element: PlaitElement, selection: Selection) => {
    if (Freehand.isFreehand(element)) {
      return isRectangleHitFreehand(board, element, selection);
    }
    return isRectangleHit(element, selection);
  };

  board.isHit = (element, point, isStrict?: boolean) => {
    if (Freehand.isFreehand(element)) {
      return isHitFreehand(board, element, point);
    }
    return isHit(element, point, isStrict);
  };

  board.getOneHitElement = (elements) => {
    const isAllFreehand = elements.every((item) => Freehand.isFreehand(item));
    if (isAllFreehand) {
      return getHitDrawElement(board, elements as Freehand[]);
    }
    return getOneHitElement(elements);
  };

  board.isMovable = (element) => {
    if (Freehand.isFreehand(element)) {
      return true;
    }
    return isMovable(element);
  };

  board.isAlign = (element) => {
    if (Freehand.isFreehand(element)) {
      return true;
    }
    return isAlign(element);
  };

  (board as PlaitOptionsBoard).setPluginOptions<WithDrawOptions>(
    WithDrawPluginKey,
    { customGeometryTypes: [FREEHAND_TYPE] }
  );

  // Store optimization settings on board for components to access
  (board as any)._freehandOptimization = optimizationOptions;

  return withFreehandErase(withFreehandFragment(withFreehandCreate(board)));
};

/**
 * Legacy compatibility - original withFreehand function
 * @deprecated Use withOptimizedFreehand for better performance
 */
export const withFreehand = (board: PlaitBoard) => {
  return withOptimizedFreehand(board, { enableOptimization: false });
};

/**
 * Get optimization settings from board
 */
export function getFreehandOptimizationSettings(board: PlaitBoard): FreehandOptimizationOptions | null {
  return (board as any)._freehandOptimization || null;
}

/**
 * Performance monitoring utilities
 */
export class FreehandPerformanceMonitor {
  private static instance: FreehandPerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): FreehandPerformanceMonitor {
    if (!FreehandPerformanceMonitor.instance) {
      FreehandPerformanceMonitor.instance = new FreehandPerformanceMonitor();
    }
    return FreehandPerformanceMonitor.instance;
  }

  recordMetric(key: string, value: number) {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    const values = this.metrics.get(key)!;
    values.push(value);

    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }

  getAverageMetric(key: string): number {
    const values = this.metrics.get(key);
    if (!values || values.length === 0) return 0;

    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  getMetricsSummary() {
    const summary: Record<string, number> = {};
    for (const [key, values] of this.metrics) {
      summary[key] = this.getAverageMetric(key);
    }
    return summary;
  }

  reset() {
    this.metrics.clear();
  }
}