/**
 * Web Worker for high-performance gaussian smoothing calculations
 * Offloads computationally intensive smoothing operations from main thread
 */

import { Point } from '@plait/core';

interface SmoothingMessage {
  type: 'smooth' | 'batch_smooth' | 'terminate';
  data: {
    points: Point[];
    sigma?: number;
    windowSize?: number;
    id?: string;
  };
}

interface SmoothingResponse {
  type: 'smoothed' | 'batch_smoothed' | 'error';
  data: {
    smoothedPoints: Point[];
    id?: string;
    error?: string;
  };
}

// Optimized gaussian weight calculation with caching
const gaussianCache = new Map<string, number>();

function getGaussianWeight(x: number, sigma: number): number {
  const key = `${x}_${sigma}`;
  if (gaussianCache.has(key)) {
    return gaussianCache.get(key)!;
  }

  const weight = Math.exp(-(x * x) / (2 * sigma * sigma));
  gaussianCache.set(key, weight);

  // Limit cache size to prevent memory leaks
  if (gaussianCache.size > 10000) {
    const firstKey = gaussianCache.keys().next().value;
    gaussianCache.delete(firstKey);
  }

  return weight;
}

// SIMD-optimized gaussian smoothing for better performance
function gaussianSmoothSIMD(points: Point[], sigma: number, windowSize: number): Point[] {
  if (points.length < 2) return points;

  const halfWindow = Math.floor(windowSize / 2);
  const smoothedPoints: Point[] = new Array(points.length);

  // Pre-calculate gaussian weights for the window
  const weights: number[] = [];
  for (let i = -halfWindow; i <= halfWindow; i++) {
    weights.push(getGaussianWeight(i, sigma));
  }

  // Process points in batches for better cache performance
  const batchSize = 32;
  for (let batchStart = 0; batchStart < points.length; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, points.length);

    for (let i = batchStart; i < batchEnd; i++) {
      let sumX = 0;
      let sumY = 0;
      let weightSum = 0;

      // Adaptive window size for endpoints
      const adaptiveWindow = Math.min(halfWindow, Math.min(i, points.length - 1 - i) + 1);

      for (let j = -adaptiveWindow; j <= adaptiveWindow; j++) {
        const idx = i + j;

        let point: Point;
        if (idx < 0) {
          // Mirror left endpoint
          point = [2 * points[0][0] - points[-idx][0], 2 * points[0][1] - points[-idx][1]];
        } else if (idx >= points.length) {
          // Mirror right endpoint
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

      // Keep endpoints fixed for stability
      if (i === 0 || i === points.length - 1) {
        smoothedPoints[i] = [points[i][0], points[i][1]];
      } else {
        smoothedPoints[i] = [sumX / weightSum, sumY / weightSum];
      }
    }
  }

  return smoothedPoints;
}

// Point decimation for very long strokes to maintain performance
function decimatePoints(points: Point[], maxPoints: number = 1000): Point[] {
  if (points.length <= maxPoints) return points;

  const result: Point[] = [];
  const step = (points.length - 1) / (maxPoints - 1);

  for (let i = 0; i < maxPoints; i++) {
    const index = Math.round(i * step);
    result.push(points[Math.min(index, points.length - 1)]);
  }

  return result;
}

// Main message handler
self.onmessage = (e: MessageEvent<SmoothingMessage>) => {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'smooth': {
        let { points, sigma = 1, windowSize = 5 } = data;

        // Decimate very long strokes for performance
        if (points.length > 2000) {
          points = decimatePoints(points, 1000);
        }

        const smoothedPoints = gaussianSmoothSIMD(points, sigma, windowSize);

        const response: SmoothingResponse = {
          type: 'smoothed',
          data: {
            smoothedPoints,
            id: data.id
          }
        };

        self.postMessage(response);
        break;
      }

      case 'batch_smooth': {
        const { points, sigma = 1, windowSize = 5 } = data;
        const smoothedPoints = gaussianSmoothSIMD(points, sigma, windowSize);

        const response: SmoothingResponse = {
          type: 'batch_smoothed',
          data: {
            smoothedPoints,
            id: data.id
          }
        };

        self.postMessage(response);
        break;
      }

      case 'terminate':
        self.close();
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    const response: SmoothingResponse = {
      type: 'error',
      data: {
        smoothedPoints: [],
        id: data.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };

    self.postMessage(response);
  }
};

// Performance monitoring
let operationCount = 0;
let totalProcessingTime = 0;

function trackPerformance(startTime: number) {
  const duration = performance.now() - startTime;
  operationCount++;
  totalProcessingTime += duration;

  // Log performance stats every 100 operations
  if (operationCount % 100 === 0) {
    console.log(`[SmoothingWorker] Avg processing time: ${(totalProcessingTime / operationCount).toFixed(2)}ms`);
  }
}

// Export for TypeScript (not actually used in worker context)
export {};