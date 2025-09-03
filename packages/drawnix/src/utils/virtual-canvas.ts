/**
 * Virtual Canvas System - Efficiently handles large canvases with many elements
 * Implements spatial indexing and viewport culling for optimal performance
 */

import { PlaitElement, Point, RectangleClient } from '@plait/core';

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export interface VirtualCanvasOptions {
  viewportPadding?: number;
  maxElementsPerCell?: number;
  cellSize?: number;
  enableCulling?: boolean;
}

export interface SpatialIndexCell {
  bounds: RectangleClient;
  elements: PlaitElement[];
  elementCount: number;
}

export class VirtualCanvasSystem {
  private spatialIndex: Map<string, SpatialIndexCell> = new Map();
  private options: Required<VirtualCanvasOptions>;
  private viewportBounds: ViewportBounds | null = null;

  constructor(options: VirtualCanvasOptions = {}) {
    this.options = {
      viewportPadding: 100,
      maxElementsPerCell: 50,
      cellSize: 500,
      enableCulling: true,
      ...options
    };
  }

  /**
   * Update the spatial index with new elements
   */
  updateElements(elements: PlaitElement[]): void {
    this.spatialIndex.clear();

    elements.forEach(element => {
      const cellKey = this.getCellKeyForElement(element);
      if (!this.spatialIndex.has(cellKey)) {
        const cellBounds = this.getCellBounds(cellKey);
        this.spatialIndex.set(cellKey, {
          bounds: cellBounds,
          elements: [],
          elementCount: 0
        });
      }

      const cell = this.spatialIndex.get(cellKey)!;
      cell.elements.push(element);
      cell.elementCount++;
    });

    // Split overcrowded cells
    this.optimizeSpatialIndex();
  }

  /**
   * Get visible elements for the current viewport
   */
  getVisibleElements(viewport: ViewportBounds): PlaitElement[] {
    if (!this.options.enableCulling) {
      return Array.from(this.spatialIndex.values()).flatMap(cell => cell.elements);
    }

    this.viewportBounds = viewport;
    const visibleCells = this.getVisibleCells(viewport);
    const visibleElements: PlaitElement[] = [];

    visibleCells.forEach(cellKey => {
      const cell = this.spatialIndex.get(cellKey);
      if (cell) {
        // For cells near viewport edges, include all elements
        // For cells fully within viewport, we could implement more sophisticated culling
        visibleElements.push(...cell.elements);
      }
    });

    return visibleElements;
  }

  /**
   * Get elements near a specific point (for hover/selection)
   */
  getElementsNearPoint(point: Point, radius: number = 50): PlaitElement[] {
    const nearbyElements: PlaitElement[] = [];
    const searchBounds = {
      x: point[0] - radius,
      y: point[1] - radius,
      width: radius * 2,
      height: radius * 2
    };

    const nearbyCells = this.getVisibleCells(searchBounds as ViewportBounds);

    nearbyCells.forEach(cellKey => {
      const cell = this.spatialIndex.get(cellKey);
      if (cell) {
        // Filter elements that are actually within the search radius
        cell.elements.forEach(element => {
          if (this.isElementNearPoint(element, point, radius)) {
            nearbyElements.push(element);
          }
        });
      }
    });

    return nearbyElements;
  }

  /**
   * Update viewport and trigger visibility optimizations
   */
  updateViewport(viewport: ViewportBounds): void {
    this.viewportBounds = viewport;

    if (this.options.enableCulling) {
      // Pre-load elements that might become visible soon
      this.prefetchNearbyElements(viewport);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const totalElements = Array.from(this.spatialIndex.values())
      .reduce((sum, cell) => sum + cell.elementCount, 0);

    const visibleElements = this.viewportBounds
      ? this.getVisibleElements(this.viewportBounds).length
      : 0;

    return {
      totalElements,
      visibleElements,
      totalCells: this.spatialIndex.size,
      averageElementsPerCell: totalElements / Math.max(1, this.spatialIndex.size),
      cullingRatio: visibleElements / Math.max(1, totalElements)
    };
  }

  private getCellKeyForElement(element: PlaitElement): string {
    if (!element.points || element.points.length === 0) {
      return '0_0';
    }

    // Calculate center point of element
    const bounds = RectangleClient.getRectangleByPoints(element.points);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    // Convert to cell coordinates
    const cellX = Math.floor(centerX / this.options.cellSize);
    const cellY = Math.floor(centerY / this.options.cellSize);

    return `${cellX}_${cellY}`;
  }

  private getCellBounds(cellKey: string): RectangleClient {
    const [cellX, cellY] = cellKey.split('_').map(Number);
    return {
      x: cellX * this.options.cellSize,
      y: cellY * this.options.cellSize,
      width: this.options.cellSize,
      height: this.options.cellSize
    };
  }

  private getVisibleCells(viewport: ViewportBounds): string[] {
    const visibleCells: string[] = [];

    // Calculate viewport bounds with padding
    const paddedViewport = {
      x: viewport.x - this.options.viewportPadding,
      y: viewport.y - this.options.viewportPadding,
      width: viewport.width + 2 * this.options.viewportPadding,
      height: viewport.height + 2 * this.options.viewportPadding
    };

    // Calculate cell range
    const startCellX = Math.floor(paddedViewport.x / this.options.cellSize);
    const endCellX = Math.floor((paddedViewport.x + paddedViewport.width) / this.options.cellSize);
    const startCellY = Math.floor(paddedViewport.y / this.options.cellSize);
    const endCellY = Math.floor((paddedViewport.y + paddedViewport.height) / this.options.cellSize);

    // Collect visible cell keys
    for (let x = startCellX; x <= endCellX; x++) {
      for (let y = startCellY; y <= endCellY; y++) {
        visibleCells.push(`${x}_${y}`);
      }
    }

    return visibleCells;
  }

  private optimizeSpatialIndex(): void {
    const overcrowdedCells: string[] = [];

    this.spatialIndex.forEach((cell, key) => {
      if (cell.elementCount > this.options.maxElementsPerCell) {
        overcrowdedCells.push(key);
      }
    });

    // For now, we'll keep overcrowded cells as-is
    // In a more advanced implementation, we could subdivide them further
    if (overcrowdedCells.length > 0) {
      console.warn(`[VirtualCanvasSystem] ${overcrowdedCells.length} cells are overcrowded`);
    }
  }

  private isElementNearPoint(element: PlaitElement, point: Point, radius: number): boolean {
    if (!element.points || element.points.length === 0) {
      return false;
    }

    const bounds = RectangleClient.getRectangleByPoints(element.points);

    // Simple bounding box check first
    if (point[0] < bounds.x - radius || point[0] > bounds.x + bounds.width + radius ||
        point[1] < bounds.y - radius || point[1] > bounds.y + bounds.height + radius) {
      return false;
    }

    // More precise distance check to element points
    return element.points.some(elementPoint => {
      const distance = Math.sqrt(
        Math.pow(elementPoint[0] - point[0], 2) +
        Math.pow(elementPoint[1] - point[1], 2)
      );
      return distance <= radius;
    });
  }

  private prefetchNearbyElements(viewport: ViewportBounds): void {
    // In a more advanced implementation, this could prefetch elements
    // that are likely to become visible based on user movement patterns
    // For now, this is a placeholder for future optimization
  }
}

/**
 * React hook for using virtual canvas system
 */
import { useMemo, useRef, useCallback } from 'react';

export function useVirtualCanvas(
  elements: PlaitElement[],
  options?: VirtualCanvasOptions
) {
  const virtualCanvasRef = useRef<VirtualCanvasSystem>();

  const virtualCanvas = useMemo(() => {
    if (!virtualCanvasRef.current) {
      virtualCanvasRef.current = new VirtualCanvasSystem(options);
    }
    return virtualCanvasRef.current;
  }, [options]);

  // Update elements when they change
  useMemo(() => {
    virtualCanvas.updateElements(elements);
  }, [virtualCanvas, elements]);

  const getVisibleElements = useCallback((viewport: ViewportBounds) => {
    return virtualCanvas.getVisibleElements(viewport);
  }, [virtualCanvas]);

  const getElementsNearPoint = useCallback((point: Point, radius?: number) => {
    return virtualCanvas.getElementsNearPoint(point, radius);
  }, [virtualCanvas]);

  const updateViewport = useCallback((viewport: ViewportBounds) => {
    virtualCanvas.updateViewport(viewport);
  }, [virtualCanvas]);

  const getPerformanceStats = useCallback(() => {
    return virtualCanvas.getPerformanceStats();
  }, [virtualCanvas]);

  return {
    getVisibleElements,
    getElementsNearPoint,
    updateViewport,
    getPerformanceStats
  };
}