/**
 * Smoothing Manager - Handles Web Worker communication for gaussian smoothing
 * Provides fallback to main thread processing when Web Workers are not available
 */

import { Point } from '@plait/core';

interface SmoothingOptions {
  sigma?: number;
  windowSize?: number;
  useWebWorker?: boolean;
  maxPoints?: number;
}

interface SmoothingResult {
  smoothedPoints: Point[];
  processingTime: number;
  usedWebWorker: boolean;
}

export class SmoothingManager {
  private worker: Worker | null = null;
  private isWorkerSupported: boolean;
  private pendingRequests = new Map<string, {
    resolve: (result: SmoothingResult) => void;
    reject: (error: Error) => void;
    startTime: number;
  }>();

  constructor() {
    this.isWorkerSupported = this.checkWebWorkerSupport();
    if (this.isWorkerSupported) {
      this.initializeWorker();
    }
  }

  /**
   * Smooth points using the most efficient available method
   */
  async smoothPoints(
    points: Point[],
    options: SmoothingOptions = {}
  ): Promise<SmoothingResult> {
    const startTime = performance.now();
    const {
      sigma = 1,
      windowSize = 5,
      useWebWorker = true,
      maxPoints = 1000
    } = options;

    // For very small point sets, use main thread for better responsiveness
    if (points.length < 10 || !useWebWorker || !this.isWorkerSupported) {
      try {
        const smoothedPoints = this.fallbackSmoothing(points, sigma, windowSize);
        return {
          smoothedPoints,
          processingTime: performance.now() - startTime,
          usedWebWorker: false
        };
      } catch (error) {
        throw new Error(`Main thread smoothing failed: ${error}`);
      }
    }

    // Use Web Worker for larger datasets
    return this.smoothWithWorker(points, { sigma, windowSize, maxPoints }, startTime);
  }

  /**
   * Batch smooth multiple point arrays
   */
  async smoothBatch(
    pointArrays: Point[][],
    options: SmoothingOptions = {}
  ): Promise<SmoothingResult[]> {
    const promises = pointArrays.map(points =>
      this.smoothPoints(points, options)
    );
    return Promise.all(promises);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'terminate' });
      this.worker.terminate();
      this.worker = null;
    }

    // Reject any pending requests
    for (const [id, request] of this.pendingRequests) {
      request.reject(new Error('SmoothingManager destroyed'));
    }
    this.pendingRequests.clear();
  }

  private checkWebWorkerSupport(): boolean {
    return typeof Worker !== 'undefined';
  }

  private initializeWorker(): void {
    try {
      // Create worker from the blob URL to avoid path issues
      const workerCode = `
        ${this.getWorkerCode()}
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);

      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (e) => {
        this.handleWorkerMessage(e);
      };

      this.worker.onerror = (error) => {
        console.error('[SmoothingManager] Worker error:', error);
        // Fallback to main thread for all pending requests
        this.fallbackAllPendingRequests();
      };

    } catch (error) {
      console.warn('[SmoothingManager] Failed to initialize worker:', error);
      this.isWorkerSupported = false;
    }
  }

  private async smoothWithWorker(
    points: Point[],
    options: { sigma: number; windowSize: number; maxPoints: number },
    startTime: number
  ): Promise<SmoothingResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      const requestId = this.generateRequestId();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Smoothing request timeout'));
      }, 5000); // 5 second timeout

      this.pendingRequests.set(requestId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        startTime
      });

      this.worker.postMessage({
        type: 'smooth',
        data: {
          points,
          sigma: options.sigma,
          windowSize: options.windowSize,
          id: requestId
        }
      });
    });
  }

  private handleWorkerMessage(e: MessageEvent): void {
    const { type, data } = e.data;

    switch (type) {
      case 'smoothed':
      case 'batch_smoothed':
        const request = this.pendingRequests.get(data.id);
        if (request) {
          this.pendingRequests.delete(data.id);
          const processingTime = performance.now() - request.startTime;
          request.resolve({
            smoothedPoints: data.smoothedPoints,
            processingTime,
            usedWebWorker: true
          });
        }
        break;

      case 'error':
        const errorRequest = this.pendingRequests.get(data.id);
        if (errorRequest) {
          this.pendingRequests.delete(data.id);
          errorRequest.reject(new Error(data.error || 'Worker smoothing failed'));
        }
        break;
    }
  }

  private fallbackAllPendingRequests(): void {
    for (const [id, request] of this.pendingRequests) {
      // Try main thread fallback
      try {
        // Note: We don't have the original points here, so we reject
        request.reject(new Error('Worker failed, main thread fallback not available'));
      } catch (error) {
        request.reject(error);
      }
    }
    this.pendingRequests.clear();
  }

  private fallbackSmoothing(points: Point[], sigma: number, windowSize: number): Point[] {
    // Import the original smoothing function
    return this.gaussianSmoothFallback(points, sigma, windowSize);
  }

  private gaussianSmoothFallback(points: Point[], sigma: number, windowSize: number): Point[] {
    if (points.length < 2) return points;

    const halfWindow = Math.floor(windowSize / 2);
    const smoothedPoints: Point[] = [];

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

      if (i === 0 || i === points.length - 1) {
        smoothedPoints.push([points[i][0], points[i][1]]);
      } else {
        smoothedPoints.push([sumX / weightSum, sumY / weightSum]);
      }
    }

    return smoothedPoints;
  }

  private generateRequestId(): string {
    return `smooth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getWorkerCode(): string {
    // Return the worker code as a string
    return `
      // Worker code embedded here
      const gaussianCache = new Map();

      function getGaussianWeight(x, sigma) {
        const key = \`\${x}_\${sigma}\`;
        if (gaussianCache.has(key)) {
          return gaussianCache.get(key);
        }
        const weight = Math.exp(-(x * x) / (2 * sigma * sigma));
        gaussianCache.set(key, weight);
        if (gaussianCache.size > 10000) {
          const firstKey = gaussianCache.keys().next().value;
          gaussianCache.delete(firstKey);
        }
        return weight;
      }

      function gaussianSmoothSIMD(points, sigma, windowSize) {
        if (points.length < 2) return points;
        const halfWindow = Math.floor(windowSize / 2);
        const smoothedPoints = new Array(points.length);
        const weights = [];
        for (let i = -halfWindow; i <= halfWindow; i++) {
          weights.push(getGaussianWeight(i, sigma));
        }
        const batchSize = 32;
        for (let batchStart = 0; batchStart < points.length; batchStart += batchSize) {
          const batchEnd = Math.min(batchStart + batchSize, points.length);
          for (let i = batchStart; i < batchEnd; i++) {
            let sumX = 0, sumY = 0, weightSum = 0;
            const adaptiveWindow = Math.min(halfWindow, Math.min(i, points.length - 1 - i) + 1);
            for (let j = -adaptiveWindow; j <= adaptiveWindow; j++) {
              const idx = i + j;
              let point;
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
            if (i === 0 || i === points.length - 1) {
              smoothedPoints[i] = [points[i][0], points[i][1]];
            } else {
              smoothedPoints[i] = [sumX / weightSum, sumY / weightSum];
            }
          }
        }
        return smoothedPoints;
      }

      self.onmessage = (e) => {
        const { type, data } = e.data;
        try {
          if (type === 'smooth') {
            const { points, sigma = 1, windowSize = 5, id } = data;
            const smoothedPoints = gaussianSmoothSIMD(points, sigma, windowSize);
            self.postMessage({
              type: 'smoothed',
              data: { smoothedPoints, id }
            });
          } else if (type === 'terminate') {
            self.close();
          }
        } catch (error) {
          self.postMessage({
            type: 'error',
            data: { error: error.message, id: data.id }
          });
        }
      };
    `;
  }
}

// Singleton instance for the application
let smoothingManagerInstance: SmoothingManager | null = null;

export function getSmoothingManager(): SmoothingManager {
  if (!smoothingManagerInstance) {
    smoothingManagerInstance = new SmoothingManager();
  }
  return smoothingManagerInstance;
}

export function destroySmoothingManager(): void {
  if (smoothingManagerInstance) {
    smoothingManagerInstance.destroy();
    smoothingManagerInstance = null;
  }
}