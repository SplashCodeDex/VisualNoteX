/**
 * Optimized Freehand Smoother - Performance-enhanced version with Web Worker support
 * Extends the original FreehandSmoother with better performance characteristics
 */

import { distanceBetweenPointAndPoint, Point } from '@plait/core';
import { getSmoothingManager, SmoothingManager } from './smoothing-manager';

interface StrokePoint {
  point: Point;
  pressure?: number;
  timestamp: number;
  tiltX?: number;
  tiltY?: number;
}

export interface OptimizedSmootherOptions {
  smoothing?: number;
  velocityWeight?: number;
  curvatureWeight?: number;
  minDistance?: number;
  maxPoints?: number;
  pressureSensitivity?: number;
  tiltSensitivity?: number;
  velocityThreshold?: number;
  samplingRate?: number;
  useWebWorker?: boolean;
  adaptiveSmoothing?: boolean;
}

export class OptimizedFreehandSmoother {
  private readonly defaultOptions: Required<OptimizedSmootherOptions> = {
    smoothing: 0.65,
    velocityWeight: 0.2,
    curvatureWeight: 0.3,
    minDistance: 0.2,
    maxPoints: 8,
    pressureSensitivity: 0.5,
    tiltSensitivity: 0.3,
    velocityThreshold: 800,
    samplingRate: 5,
    useWebWorker: true,
    adaptiveSmoothing: true,
  };

  private options: Required<OptimizedSmootherOptions>;
  private points: StrokePoint[] = [];
  private lastProcessedTime = 0;
  private movingAverageVelocity: number[] = [];
  private readonly velocityWindowSize = 3;
  private smoothingManager: SmoothingManager;
  private pendingBatch: Point[] = [];
  private batchTimeout: number | null = null;

  constructor(options: OptimizedSmootherOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
    this.smoothingManager = getSmoothingManager();
  }

  /**
   * Process a point with optimized smoothing
   */
  process(
    point: Point,
    data: Partial<Omit<StrokePoint, 'point'>> = {}
  ): Point | null {
    const timestamp = data.timestamp ?? Date.now();

    // First point - return immediately
    if (this.points.length === 0) {
      const strokePoint: StrokePoint = { point, timestamp, ...data };
      this.points.push(strokePoint);
      this.lastProcessedTime = timestamp;
      return point;
    }

    // Sampling rate control
    if (timestamp - this.lastProcessedTime < this.options.samplingRate) {
      const timeDiff = timestamp - this.lastProcessedTime;
      if (timeDiff < 2) {
        return null;
      }
    }

    const strokePoint: StrokePoint = {
      point,
      timestamp,
      ...data,
    };

    // Distance check with dynamic adjustment
    const distanceOk = this.checkDistance(point);
    if (!distanceOk && this.points.length > 1) {
      const timeDiff = timestamp - this.lastProcessedTime;
      if (timeDiff < 32) { // ~30fps
        return null;
      }
    }

    // Update points
    this.updatePoints(strokePoint);

    // Calculate dynamic parameters
    const dynamicParams = this.calculateDynamicParameters(strokePoint);

    // Apply smoothing
    const smoothedPoint = this.smooth(point, dynamicParams);

    this.lastProcessedTime = timestamp;
    return smoothedPoint;
  }

  /**
   * Process a batch of points with Web Worker optimization
   */
  async processBatch(points: Point[]): Promise<Point[]> {
    if (points.length < 10) {
      // Use main thread for small batches
      return this.processBatchSync(points);
    }

    try {
      const result = await this.smoothingManager.smoothPoints(points, {
        sigma: this.options.smoothing,
        windowSize: Math.floor(this.options.maxPoints / 2),
        useWebWorker: this.options.useWebWorker,
      });

      return result.smoothedPoints;
    } catch (error) {
      console.warn('[OptimizedFreehandSmoother] Web Worker smoothing failed, falling back to main thread:', error);
      return this.processBatchSync(points);
    }
  }

  /**
   * Synchronous batch processing for fallback
   */
  private processBatchSync(points: Point[]): Point[] {
    // Simple gaussian smoothing for batch processing
    const sigma = this.options.smoothing;
    const windowSize = Math.floor(this.options.maxPoints / 2);

    return this.gaussianSmooth(points, sigma, windowSize);
  }

  /**
   * Get final smoothed stroke using optimized algorithm
   */
  async finalizeStroke(): Promise<Point[]> {
    if (this.points.length < 2) {
      return this.points.map(p => p.point);
    }

    const rawPoints = this.points.map(p => p.point);

    try {
      const result = await this.smoothingManager.smoothPoints(rawPoints, {
        sigma: this.options.smoothing * 0.8, // Slightly more smoothing for final result
        windowSize: Math.floor(this.options.maxPoints / 2),
        useWebWorker: this.options.useWebWorker,
      });

      return result.smoothedPoints;
    } catch (error) {
      console.warn('[OptimizedFreehandSmoother] Final smoothing failed:', error);
      return this.gaussianSmooth(rawPoints, this.options.smoothing, Math.floor(this.options.maxPoints / 2));
    }
  }

  reset(): void {
    this.points = [];
    this.lastProcessedTime = 0;
    this.movingAverageVelocity = [];
    this.pendingBatch = [];

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  destroy(): void {
    this.reset();
  }

  private updatePoints(point: StrokePoint): void {
    this.points.push(point);
    if (this.points.length > this.options.maxPoints) {
      this.points.shift();
    }
  }

  private checkDistance(point: Point): boolean {
    if (this.points.length === 0) return true;

    const lastPoint = this.points[this.points.length - 1].point;
    const distance = this.getDistance(lastPoint, point);

    let minDistance = this.options.minDistance;
    if (this.movingAverageVelocity.length > 0) {
      const avgVelocity = this.getAverageVelocity();
      minDistance *= Math.max(0.5, Math.min(1.5, avgVelocity / 200));
    }

    return distance >= minDistance;
  }

  private calculateDynamicParameters(strokePoint: StrokePoint) {
    const velocity = this.calculateVelocity(strokePoint);
    this.updateMovingAverage(velocity);
    const avgVelocity = this.getAverageVelocity();

    const params = { ...this.options };

    // Adaptive smoothing based on velocity and pressure
    if (this.options.adaptiveSmoothing) {
      // Pressure adaptation
      if (strokePoint.pressure !== undefined) {
        const pressureWeight = Math.pow(strokePoint.pressure, 1.2);
        params.smoothing *= 1 - pressureWeight * params.pressureSensitivity * 0.8;
      }

      // Velocity adaptation
      const velocityFactor = Math.min(avgVelocity / params.velocityThreshold, 1);
      params.velocityWeight = 0.2 + velocityFactor * 0.3;
      params.smoothing *= 1 + velocityFactor * 0.2;

      // Tilt adaptation
      if (strokePoint.tiltX !== undefined && strokePoint.tiltY !== undefined) {
        const tiltFactor = Math.sqrt(strokePoint.tiltX ** 2 + strokePoint.tiltY ** 2) / 90;
        params.smoothing *= 1 + tiltFactor * params.tiltSensitivity * 0.7;
      }
    }

    return params;
  }

  private smooth(point: Point, params: Required<OptimizedSmootherOptions>): Point {
    if (this.points.length < 2) return point;

    const weights = this.calculateWeights(params);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    if (totalWeight === 0) return point;

    const smoothedPoint: Point = [0, 0];
    for (let i = 0; i < this.points.length; i++) {
      const weight = weights[i] / totalWeight;
      smoothedPoint[0] += this.points[i].point[0] * weight;
      smoothedPoint[1] += this.points[i].point[1] * weight;
    }

    return smoothedPoint;
  }

  private calculateWeights(params: Required<OptimizedSmootherOptions>): number[] {
    const weights: number[] = [];
    const lastIndex = this.points.length - 1;

    for (let i = 0; i < this.points.length; i++) {
      let weight = Math.pow(params.smoothing, (lastIndex - i) * 0.8);

      // Velocity weight
      if (i < lastIndex) {
        const velocity = this.getPointVelocity(i);
        weight *= 1 + velocity * params.velocityWeight * 0.8;
      }

      // Curvature weight
      if (i > 0 && i < lastIndex) {
        const curvature = this.getPointCurvature(i);
        weight *= 1 + curvature * params.curvatureWeight * 0.7;
      }

      weights.push(weight);
    }

    return weights;
  }

  private gaussianSmooth(points: Point[], sigma: number, windowSize: number): Point[] {
    if (points.length < 2) return points;

    const halfWindow = Math.floor(windowSize / 2);
    const smoothedPoints: Point[] = new Array(points.length);

    // Pre-calculate gaussian weights
    const weights: number[] = [];
    for (let i = -halfWindow; i <= halfWindow; i++) {
      weights.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
    }

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

        const weight = weights[j + halfWindow];
        sumX += point[0] * weight;
        sumY += point[1] * weight;
        weightSum += weight;
      }

      // Keep endpoints fixed
      if (i === 0 || i === points.length - 1) {
        smoothedPoints[i] = [points[i][0], points[i][1]];
      } else {
        smoothedPoints[i] = [sumX / weightSum, sumY / weightSum];
      }
    }

    return smoothedPoints;
  }

  // Utility methods
  private getDistance(p1: Point, p2: Point): number {
    return distanceBetweenPointAndPoint(p1[0], p1[1], p2[0], p2[1]);
  }

  private calculateVelocity(point: StrokePoint): number {
    if (this.points.length < 2) return 0;

    const prevPoint = this.points[this.points.length - 1];
    const distance = this.getDistance(prevPoint.point, point.point);
    const timeDiff = point.timestamp - prevPoint.timestamp;
    return timeDiff > 0 ? distance / timeDiff : 0;
  }

  private updateMovingAverage(velocity: number): void {
    this.movingAverageVelocity.push(velocity);
    if (this.movingAverageVelocity.length > this.velocityWindowSize) {
      this.movingAverageVelocity.shift();
    }
  }

  private getAverageVelocity(): number {
    if (this.movingAverageVelocity.length === 0) return 0;
    return this.movingAverageVelocity.reduce((a, b) => a + b) / this.movingAverageVelocity.length;
  }

  private getPointVelocity(index: number): number {
    if (index >= this.points.length - 1) return 0;

    const p1 = this.points[index];
    const p2 = this.points[index + 1];
    const distance = this.getDistance(p1.point, p2.point);
    const timeDiff = p2.timestamp - p1.timestamp;
    return timeDiff > 0 ? distance / timeDiff : 0;
  }

  private getPointCurvature(index: number): number {
    if (index <= 0 || index >= this.points.length - 1) return 0;

    const p1 = this.points[index - 1].point;
    const p2 = this.points[index].point;
    const p3 = this.points[index + 1].point;

    const a = this.getDistance(p1, p2);
    const b = this.getDistance(p2, p3);
    const c = this.getDistance(p1, p3);

    const s = (a + b + c) / 2;
    const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
    return (4 * area) / (a * b * c + 0.0001);
  }
}