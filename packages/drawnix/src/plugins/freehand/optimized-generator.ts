/**
 * Optimized Freehand Generator - Performance-enhanced version with Web Worker support
 * Provides better performance for large freehand strokes through optimized smoothing
 */

import { Generator } from '@plait/common';
import { PlaitBoard, setStrokeLinecap, Point } from '@plait/core';
import { Options } from 'roughjs/bin/core';
import { Freehand } from './type';
import {
  getFillByElement,
  getStrokeColorByElement,
} from './utils';
import { getStrokeWidthByElement } from '@plait/draw';
import { OptimizedFreehandSmoother } from './optimized-smoother';

export class OptimizedFreehandGenerator extends Generator<Freehand> {
  private smoother: OptimizedFreehandSmoother;
  private useOptimizedSmoothing: boolean;

  constructor(useOptimizedSmoothing = true) {
    super();
    this.useOptimizedSmoothing = useOptimizedSmoothing;
    this.smoother = new OptimizedFreehandSmoother({
      useWebWorker: useOptimizedSmoothing,
      adaptiveSmoothing: true,
    });
  }

  protected async draw(element: Freehand): Promise<SVGGElement | undefined> {
    const strokeWidth = getStrokeWidthByElement(element);
    const strokeColor = getStrokeColorByElement(this.board, element);
    const fill = getFillByElement(this.board, element);

    // Use optimized smoothing for better performance
    let smoothedPoints: Point[];

    if (this.useOptimizedSmoothing && element.points.length > 20) {
      try {
        // Use Web Worker for large strokes
        smoothedPoints = await this.smoother.processBatch(element.points);
      } catch (error) {
        console.warn('[OptimizedFreehandGenerator] Web Worker smoothing failed, using fallback:', error);
        smoothedPoints = this.fallbackSmooth(element.points);
      }
    } else {
      smoothedPoints = this.fallbackSmooth(element.points);
    }

    const option: Options = {
      strokeWidth,
      stroke: strokeColor,
      fill,
      fillStyle: 'solid'
    };

    const g = PlaitBoard.getRoughSVG(this.board).curve(smoothedPoints, option);
    setStrokeLinecap(g, 'round');

    return g;
  }

  canDraw(element: Freehand): boolean {
    return true;
  }

  /**
   * Process points in real-time for live drawing
   */
  processLivePoints(points: Point[]): Promise<Point[]> {
    if (!this.useOptimizedSmoothing || points.length < 10) {
      return Promise.resolve(this.fallbackSmooth(points));
    }

    return this.smoother.processBatch(points);
  }

  /**
   * Fallback smoothing method for when Web Workers are not available
   */
  private fallbackSmooth(points: Point[]): Point[] {
    if (points.length < 2) return points;

    const sigma = 1;
    const windowSize = 5;
    const halfWindow = Math.floor(windowSize / 2);
    const smoothedPoints: Point[] = new Array(points.length);

    for (let i = 0; i < points.length; i++) {
      let sumX = 0;
      let sumY = 0;
      let weightSum = 0;

      const adaptiveWindow = Math.min(halfWindow, Math.min(i, points.length - 1 - i) + 1);

      for (let j = -adaptiveWindow; j <= adaptiveWindow; j++) {
        const idx = i + j;

        let point: Point;
        if (idx < 0) {
          point = [2 * points[0][0] - points[-idx][0], 2 * points[0][1] - points[-idx][1]];
        } else if (idx >= points.length) {
          const mirrorIdx = 2 * points.length - idx - 1;
          point = [2 * points[points.length - 1][0] - points[mirrorIdx][0],
                   2 * points[points.length - 1][1] - points[mirrorIdx][1]];
        } else {
          point = points[idx];
        }

        const weight = Math.exp(-(j * j) / (2 * sigma * sigma));
        sumX += point[0] * weight;
        sumY += point[1] * weight;
        weightSum += weight;
      }

      // Keep endpoints fixed for stability
      if (i === 0 || i === points.length - 1) {
        smoothedPoints[i] = [points[i][0], points[i][1]];
      } else {
        smoothedPoints[i] = [sumX / weightSum, sumY / weightSum];
      }
    }

    return smoothedPoints;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.smoother) {
      this.smoother.destroy();
    }
  }
}

/**
 * Factory function to create optimized generator with feature detection
 */
export function createOptimizedFreehandGenerator(board: PlaitBoard): OptimizedFreehandGenerator {
  // Check if Web Workers are supported and beneficial
  const useOptimized = typeof Worker !== 'undefined' && !board.options?.readonly;

  return new OptimizedFreehandGenerator(useOptimized);
}