/**
 * SVG Optimizer - Efficiently batches and optimizes SVG rendering operations
 * Reduces DOM manipulations and improves rendering performance
 */

import { PlaitBoard, PlaitElement } from '@plait/core';

export interface SVGBatchOperation {
  type: 'create' | 'update' | 'delete';
  element: PlaitElement;
  svgElement?: SVGElement;
  priority?: number;
}

export interface SVGRenderBatch {
  operations: SVGBatchOperation[];
  timestamp: number;
  estimatedCost: number;
}

export class SVGOptimizer {
  private renderQueue: SVGBatchOperation[] = [];
  private batchTimeout: number | null = null;
  private isProcessingBatch = false;
  private batchSizeLimit = 50;
  private batchTimeLimit = 16; // ~60fps

  constructor(
    private board: PlaitBoard,
    options: {
      batchSizeLimit?: number;
      batchTimeLimit?: number;
    } = {}
  ) {
    this.batchSizeLimit = options.batchSizeLimit || this.batchSizeLimit;
    this.batchTimeLimit = options.batchTimeLimit || this.batchTimeLimit;
  }

  /**
   * Queue an SVG operation for batched processing
   */
  queueOperation(operation: SVGBatchOperation): void {
    this.renderQueue.push(operation);

    // Sort by priority (higher priority first)
    this.renderQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    this.scheduleBatchProcessing();
  }

  /**
   * Queue multiple operations at once
   */
  queueOperations(operations: SVGBatchOperation[]): void {
    this.renderQueue.push(...operations);

    // Sort by priority
    this.renderQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    this.scheduleBatchProcessing();
  }

  /**
   * Process the render queue immediately
   */
  async processQueueImmediately(): Promise<void> {
    if (this.isProcessingBatch || this.renderQueue.length === 0) {
      return;
    }

    await this.processBatch();
  }

  /**
   * Clear the render queue
   */
  clearQueue(): void {
    this.renderQueue = [];
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  /**
   * Get current queue statistics
   */
  getQueueStats() {
    return {
      queueLength: this.renderQueue.length,
      isProcessing: this.isProcessingBatch,
      batchSizeLimit: this.batchSizeLimit,
      estimatedProcessingTime: this.estimateProcessingTime()
    };
  }

  private scheduleBatchProcessing(): void {
    if (this.batchTimeout || this.isProcessingBatch) {
      return;
    }

    // If queue is getting large, process immediately
    if (this.renderQueue.length >= this.batchSizeLimit) {
      this.processBatch();
      return;
    }

    // Otherwise, schedule for next frame
    this.batchTimeout = window.setTimeout(() => {
      this.processBatch();
    }, this.batchTimeLimit);
  }

  private async processBatch(): Promise<void> {
    if (this.isProcessingBatch || this.renderQueue.length === 0) {
      return;
    }

    this.isProcessingBatch = true;
    const startTime = performance.now();

    try {
      // Take a batch of operations
      const batchSize = Math.min(this.batchSizeLimit, this.renderQueue.length);
      const batch = this.renderQueue.splice(0, batchSize);

      // Group operations by type for more efficient processing
      const groupedOperations = this.groupOperationsByType(batch);

      // Process each group
      await this.processGroupedOperations(groupedOperations);

      const processingTime = performance.now() - startTime;

      // Log performance stats
      if (batch.length > 10) {
        console.log(`[SVGOptimizer] Processed ${batch.length} operations in ${processingTime.toFixed(2)}ms`);
      }

    } catch (error) {
      console.error('[SVGOptimizer] Error processing batch:', error);
    } finally {
      this.isProcessingBatch = false;
      this.batchTimeout = null;

      // Continue processing if there are more operations
      if (this.renderQueue.length > 0) {
        this.scheduleBatchProcessing();
      }
    }
  }

  private groupOperationsByType(operations: SVGBatchOperation[]) {
    const groups = {
      create: [] as SVGBatchOperation[],
      update: [] as SVGBatchOperation[],
      delete: [] as SVGBatchOperation[]
    };

    operations.forEach(op => {
      groups[op.type].push(op);
    });

    return groups;
  }

  private async processGroupedOperations(groups: ReturnType<typeof this.groupOperationsByType>) {
    const elementHost = PlaitBoard.getElementHost(this.board);

    // Process deletions first (cleanup)
    if (groups.delete.length > 0) {
      this.processDeletions(groups.delete, elementHost);
    }

    // Process creations
    if (groups.create.length > 0) {
      await this.processCreations(groups.create, elementHost);
    }

    // Process updates
    if (groups.update.length > 0) {
      await this.processUpdates(groups.update, elementHost);
    }
  }

  private processDeletions(operations: SVGBatchOperation[], elementHost: SVGGElement) {
    operations.forEach(op => {
      if (op.svgElement && op.svgElement.parentNode) {
        op.svgElement.parentNode.removeChild(op.svgElement);
      }
    });
  }

  private async processCreations(operations: SVGBatchOperation[], elementHost: SVGGElement) {
    // Create a document fragment for batch insertion
    const fragment = document.createDocumentFragment();

    for (const op of operations) {
      if (op.svgElement) {
        // Add data attributes for element identification
        op.svgElement.setAttribute('data-element-id', op.element.id);
        op.svgElement.setAttribute('data-element-type', op.element.type);

        fragment.appendChild(op.svgElement);
      }
    }

    // Batch insert all elements at once
    if (fragment.children.length > 0) {
      elementHost.appendChild(fragment);
    }
  }

  private async processUpdates(operations: SVGBatchOperation[], elementHost: SVGGElement) {
    // For updates, we need to be more careful about DOM manipulation
    // Group by parent element to minimize reflows

    const updatesByParent = new Map<SVGElement, SVGBatchOperation[]>();

    operations.forEach(op => {
      if (op.svgElement && op.svgElement.parentNode) {
        const parent = op.svgElement.parentNode as SVGElement;
        if (!updatesByParent.has(parent)) {
          updatesByParent.set(parent, []);
        }
        updatesByParent.get(parent)!.push(op);
      }
    });

    // Process updates for each parent group
    for (const [parent, ops] of updatesByParent) {
      // Use requestAnimationFrame for smooth updates
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          ops.forEach(op => {
            if (op.svgElement) {
              // Update element attributes efficiently
              this.updateSVGElementAttributes(op.svgElement, op.element);
            }
          });
          resolve(void 0);
        });
      });
    }
  }

  private updateSVGElementAttributes(svgElement: SVGElement, element: PlaitElement) {
    // Update only the attributes that actually changed
    // This is a simplified version - in practice, you'd compare old vs new values

    svgElement.setAttribute('data-element-id', element.id);
    svgElement.setAttribute('data-element-type', element.type);

    // Add transform if element has rotation/scale
    if (element.angle || (element as any).scaleX || (element as any).scaleY) {
      const transforms: string[] = [];

      if (element.angle) {
        transforms.push(`rotate(${element.angle})`);
      }

      if ((element as any).scaleX || (element as any).scaleY) {
        const scaleX = (element as any).scaleX || 1;
        const scaleY = (element as any).scaleY || 1;
        transforms.push(`scale(${scaleX}, ${scaleY})`);
      }

      if (transforms.length > 0) {
        svgElement.setAttribute('transform', transforms.join(' '));
      }
    }
  }

  private estimateProcessingTime(): number {
    // Rough estimation based on operation count and complexity
    const baseTimePerOperation = 0.5; // ms
    const complexityMultiplier = 1 + (this.renderQueue.length / this.batchSizeLimit);

    return this.renderQueue.length * baseTimePerOperation * complexityMultiplier;
  }
}

/**
 * React hook for using SVG optimizer
 */
import { useMemo, useRef, useCallback } from 'react';

export function useSVGOptimizer(board: PlaitBoard) {
  const optimizerRef = useRef<SVGOptimizer>();

  const optimizer = useMemo(() => {
    if (!optimizerRef.current) {
      optimizerRef.current = new SVGOptimizer(board);
    }
    return optimizerRef.current;
  }, [board]);

  const queueOperation = useCallback((operation: SVGBatchOperation) => {
    optimizer.queueOperation(operation);
  }, [optimizer]);

  const queueOperations = useCallback((operations: SVGBatchOperation[]) => {
    optimizer.queueOperations(operations);
  }, [optimizer]);

  const processQueue = useCallback(() => {
    return optimizer.processQueueImmediately();
  }, [optimizer]);

  const getStats = useCallback(() => {
    return optimizer.getQueueStats();
  }, [optimizer]);

  return {
    queueOperation,
    queueOperations,
    processQueue,
    getStats
  };
}

/**
 * Utility function to create optimized SVG operations
 */
export function createSVGBatchOperation(
  type: SVGBatchOperation['type'],
  element: PlaitElement,
  svgElement?: SVGElement,
  priority = 0
): SVGBatchOperation {
  return {
    type,
    element,
    svgElement,
    priority
  };
}

/**
 * Batch multiple SVG operations for better performance
 */
export function createBatchSVGBatchOperations(
  operations: Array<{
    type: SVGBatchOperation['type'];
    element: PlaitElement;
    svgElement?: SVGElement;
  }>
): SVGBatchOperation[] {
  return operations.map(({ type, element, svgElement }) =>
    createSVGBatchOperation(type, element, svgElement)
  );
}