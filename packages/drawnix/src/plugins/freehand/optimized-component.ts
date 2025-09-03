/**
 * Optimized Freehand Component - Performance-enhanced version with Web Worker support
 * Provides better rendering performance for large freehand strokes
 */

import {
  PlaitBoard,
  PlaitPluginElementContext,
  OnContextChanged,
  RectangleClient,
  isSelectionMoving,
  ACTIVE_STROKE_WIDTH,
} from '@plait/core';
import {
  ActiveGenerator,
  CommonElementFlavour,
  createActiveGenerator,
  hasResizeHandle,
} from '@plait/common';
import { Freehand } from './type';
import { OptimizedFreehandGenerator, createOptimizedFreehandGenerator } from './optimized-generator';

export class OptimizedFreehandComponent
  extends CommonElementFlavour<Freehand, PlaitBoard>
  implements OnContextChanged<Freehand, PlaitBoard>
{
  private activeGenerator!: ActiveGenerator<Freehand>;
  private generator!: OptimizedFreehandGenerator;
  private isOptimized: boolean;

  constructor() {
    super();
    // Feature detection for optimization
    this.isOptimized = this.shouldUseOptimization();
  }

  private shouldUseOptimization(): boolean {
    // Use optimization if Web Workers are supported and not in readonly mode
    return typeof Worker !== 'undefined' &&
           !this.board?.options?.readonly &&
           // Check if the stroke has enough points to benefit from optimization
           this.element?.points?.length > 20;
  }

  initializeGenerator() {
    this.activeGenerator = createActiveGenerator(this.board, {
      getRectangle: (element: Freehand) => {
        return RectangleClient.getRectangleByPoints(element.points);
      },
      getStrokeWidth: () => ACTIVE_STROKE_WIDTH,
      getStrokeOpacity: () => 1,
      hasResizeHandle: () => {
        return hasResizeHandle(this.board, this.element);
      },
    });

    this.generator = createOptimizedFreehandGenerator(this.board);
  }

  async initialize(): Promise<void> {
    super.initialize();
    this.initializeGenerator();

    try {
      await this.generator.processDrawing(this.element, this.getElementG());
    } catch (error) {
      console.warn('[OptimizedFreehandComponent] Optimized rendering failed, using fallback:', error);
      // Fallback to basic rendering if optimized version fails
      this.fallbackRender();
    }
  }

  async onContextChanged(
    value: PlaitPluginElementContext<Freehand, PlaitBoard>,
    previous: PlaitPluginElementContext<Freehand, PlaitBoard>
  ) {
    if (value.element !== previous.element || value.hasThemeChanged) {
      try {
        await this.generator.processDrawing(this.element, this.getElementG());
        this.activeGenerator.processDrawing(
          this.element,
          PlaitBoard.getActiveHost(this.board),
          {
            selected: this.selected,
          }
        );
      } catch (error) {
        console.warn('[OptimizedFreehandComponent] Context change rendering failed:', error);
        this.fallbackRender();
      }
    } else {
      const needUpdate = value.selected !== previous.selected;
      if (needUpdate || value.selected) {
        this.activeGenerator.processDrawing(
          this.element,
          PlaitBoard.getActiveHost(this.board),
          {
            selected: this.selected,
          }
        );
      }
    }
  }

  /**
   * Fallback rendering method when optimization fails
   */
  private fallbackRender(): void {
    try {
      // Clear existing content
      const elementG = this.getElementG();
      while (elementG.firstChild) {
        elementG.removeChild(elementG.firstChild);
      }

      // Simple line rendering as fallback
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const pathData = this.element.points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0]} ${point[1]}`)
        .join(' ');

      path.setAttribute('d', pathData);
      path.setAttribute('stroke', '#000');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');

      elementG.appendChild(path);
    } catch (error) {
      console.error('[OptimizedFreehandComponent] Fallback rendering failed:', error);
    }
  }

  destroy(): void {
    super.destroy();
    this.activeGenerator?.destroy();
    this.generator?.destroy();
  }

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics() {
    return {
      isOptimized: this.isOptimized,
      pointCount: this.element?.points?.length || 0,
      webWorkerSupported: typeof Worker !== 'undefined',
      readonly: this.board?.options?.readonly || false,
    };
  }
}

/**
 * Factory function to create appropriate component based on performance needs
 */
export function createFreehandComponent(board: PlaitBoard, element: Freehand): OptimizedFreehandComponent {
  // Check if optimization is beneficial
  const shouldOptimize = typeof Worker !== 'undefined' &&
                         !board.options?.readonly &&
                         element.points.length > 20;

  if (shouldOptimize) {
    return new OptimizedFreehandComponent();
  }

  // For smaller strokes or unsupported environments, use optimized component
  // but with optimization disabled
  const component = new OptimizedFreehandComponent();
  (component as any).isOptimized = false;
  return component;
}