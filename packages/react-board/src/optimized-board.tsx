/**
 * Optimized Board Component - Performance-enhanced with virtual scrolling and React optimizations
 * Provides better performance for large canvases with many elements
 */

import React, { useMemo, useCallback, memo, useRef, useEffect } from 'react';
import rough from 'roughjs/bin/rough';
import {
  BOARD_TO_AFTER_CHANGE,
  BOARD_TO_CONTEXT,
  BOARD_TO_ELEMENT_HOST,
  BOARD_TO_HOST,
  BOARD_TO_ON_CHANGE,
  BOARD_TO_ROUGH_SVG,
  HOST_CLASS_NAME,
  IS_BOARD_ALIVE,
  IS_CHROME,
  IS_FIREFOX,
  IS_SAFARI,
  PlaitBoardContext,
  initializeViewBox,
  initializeViewportContainer,
  initializeViewportOffset,
  PlaitBoard,
  KEY_TO_ELEMENT_MAP,
} from '@plait/core';
import { useBoardPluginEvent } from './hooks/use-plugin-event';
import { useBoardEvent } from './hooks/use-board-event';
import { useBoard, useListRender } from './hooks/use-board';
import { useVirtualCanvas, ViewportBounds } from '../drawnix/src/utils/virtual-canvas';
import classNames from 'classnames';
import './styles/index.scss';

export type OptimizedPlaitBoardProps = {
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  afterInit?: (board: PlaitBoard) => void;
  enableVirtualScrolling?: boolean;
  virtualCanvasOptions?: {
    viewportPadding?: number;
    maxElementsPerCell?: number;
    cellSize?: number;
  };
};

// Performance monitoring
const performanceStats = {
  renderCount: 0,
  lastRenderTime: performance.now(),
  averageRenderTime: 0,
  virtualCanvasEnabled: false
};

export const OptimizedBoard: React.FC<OptimizedPlaitBoardProps> = memo(({
  style,
  className,
  children,
  afterInit,
  enableVirtualScrolling = true,
  virtualCanvasOptions
}) => {
  const renderStartTime = performance.now();
  const hostRef = useRef<SVGSVGElement>(null);
  const elementLowerHostRef = useRef<SVGGElement>(null);
  const elementHostRef = useRef<SVGGElement>(null);
  const elementUpperHostRef = useRef<SVGGElement>(null);
  const elementTopHostRef = useRef<SVGGElement>(null);
  const activeHostRef = useRef<SVGGElement>(null);
  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  const board = useBoard();
  const listRender = useListRender();

  // Virtual canvas integration
  const virtualCanvas = useVirtualCanvas(
    listRender?.elements || [],
    virtualCanvasOptions
  );

  // Memoize viewport bounds calculation
  const viewportBounds = useMemo((): ViewportBounds | null => {
    if (!board || !viewportContainerRef.current) return null;

    const container = viewportContainerRef.current;
    const rect = container.getBoundingClientRect();

    return {
      x: board.viewport?.offsetX || 0,
      y: board.viewport?.offsetY || 0,
      width: rect.width,
      height: rect.height,
      zoom: board.viewport?.zoom || 1
    };
  }, [board?.viewport]);

  // Update virtual canvas when viewport changes
  useEffect(() => {
    if (viewportBounds && enableVirtualScrolling) {
      virtualCanvas.updateViewport(viewportBounds);
    }
  }, [viewportBounds, virtualCanvas, enableVirtualScrolling]);

  // Memoize visible elements calculation
  const visibleElements = useMemo(() => {
    if (!enableVirtualScrolling || !viewportBounds) {
      return listRender?.elements || [];
    }

    return virtualCanvas.getVisibleElements(viewportBounds);
  }, [enableVirtualScrolling, viewportBounds, virtualCanvas, listRender?.elements]);

  // Performance monitoring
  useEffect(() => {
    performanceStats.renderCount++;
    const renderTime = performance.now() - renderStartTime;
    performanceStats.averageRenderTime =
      (performanceStats.averageRenderTime + renderTime) / 2;
    performanceStats.virtualCanvasEnabled = enableVirtualScrolling;

    if (performanceStats.renderCount % 30 === 0) {
      const stats = virtualCanvas.getPerformanceStats();
      console.log('[OptimizedBoard] Performance stats:', {
        renderTime: renderTime.toFixed(2) + 'ms',
        averageRenderTime: performanceStats.averageRenderTime.toFixed(2) + 'ms',
        virtualCanvas: stats,
        totalElements: listRender?.elements?.length || 0
      });
    }
  });

  useEffect(() => {
    const roughSVG = rough.svg(hostRef.current!, {
      options: { roughness: 0, strokeWidth: 1 },
    });
    BOARD_TO_ROUGH_SVG.set(board, roughSVG);
    BOARD_TO_HOST.set(board, hostRef.current!);
    IS_BOARD_ALIVE.set(board, true);
    BOARD_TO_ELEMENT_HOST.set(board, {
      lowerHost: elementLowerHostRef.current!,
      host: elementHostRef.current!,
      upperHost: elementUpperHostRef.current!,
      topHost: elementTopHostRef.current!,
      activeHost: activeHostRef.current!,
      container: boardContainerRef.current!,
      viewportContainer: viewportContainerRef.current!,
    });
    const context = new PlaitBoardContext();
    BOARD_TO_CONTEXT.set(board, context);
    KEY_TO_ELEMENT_MAP.set(board, new Map());

    if (!listRender.initialized) {
      listRender.initialize(visibleElements, {
        board: board,
        parent: board,
        parentG: PlaitBoard.getElementHost(board),
      });
      if (afterInit) {
        afterInit(board);
      }
    }

    initializeViewportContainer(board);
    initializeViewBox(board);
    initializeViewportOffset(board);

    return () => {
      BOARD_TO_CONTEXT.delete(board);
      BOARD_TO_AFTER_CHANGE.delete(board);
      BOARD_TO_ON_CHANGE.delete(board);
      BOARD_TO_ELEMENT_HOST.delete(board);
      IS_BOARD_ALIVE.delete(board);
      BOARD_TO_HOST.delete(board);
      BOARD_TO_ROUGH_SVG.delete(board);
      KEY_TO_ELEMENT_MAP.delete(board);
    };
  }, [board, listRender, visibleElements, afterInit]);

  // Memoize event handlers
  const memoizedPluginEvent = useMemo(() =>
    useBoardPluginEvent(board, viewportContainerRef, hostRef),
    [board]
  );

  const memoizedBoardEvent = useMemo(() =>
    useBoardEvent(board, viewportContainerRef),
    [board]
  );

  // Apply memoized event handlers
  useEffect(() => {
    memoizedPluginEvent();
    memoizedBoardEvent();
  }, [memoizedPluginEvent, memoizedBoardEvent]);

  // Memoize browser class detection
  const browserClass = useMemo(() => getBrowserClassName(), []);

  // Memoize class names
  const containerClassName = useMemo(() => classNames(
    className,
    HOST_CLASS_NAME,
    browserClass,
    `theme-${board.theme?.themeColorMode}`,
    `pointer-${board.pointer}`,
    {
      focused: PlaitBoard.isFocus(board),
      readonly: PlaitBoard.isReadonly(board),
      'disabled-scroll':
        board.options?.disabledScrollOnNonFocus &&
        !PlaitBoard.isFocus(board),
      'virtual-scrolling': enableVirtualScrolling
    }
  ), [className, browserClass, board.theme?.themeColorMode, board.pointer, board.options, enableVirtualScrolling]);

  return (
    <div
      className={containerClassName}
      ref={boardContainerRef}
      style={style}
    >
      <div
        className="viewport-container"
        ref={viewportContainerRef}
        style={{ width: '100%', height: '100%', overflow: 'auto' }}
      >
        <svg
          ref={hostRef}
          width="100%"
          height="100%"
          style={{ position: 'relative' }}
          className="board-host-svg"
        >
          <g className="element-lower-host" ref={elementLowerHostRef}></g>
          <g className="element-host" ref={elementHostRef}></g>
          <g className="element-upper-host" ref={elementUpperHostRef}></g>
          <g className="element-top-host" ref={elementTopHostRef}></g>
        </svg>
        <svg width="100%" height="100%" className="board-active-svg">
          <g className="active-host-g" ref={activeHostRef}></g>
        </svg>
        {children}
      </div>

      {/* Performance debug overlay (development only) */}
      {process.env.NODE_ENV === 'development' && enableVirtualScrolling && (
        <div className="performance-debug-overlay">
          <div className="performance-stats">
            <span>Elements: {visibleElements.length}</span>
            <span>Render: {performanceStats.averageRenderTime.toFixed(1)}ms</span>
          </div>
        </div>
      )}
    </div>
  );
});

OptimizedBoard.displayName = 'OptimizedBoard';

const getBrowserClassName = () => {
  if (IS_SAFARI) {
    return 'safari';
  }
  if (IS_CHROME) {
    return 'chrome';
  }
  if (IS_FIREFOX) {
    return 'firefox';
  }
  return '';
};

// Performance monitoring utilities
export const getBoardPerformanceStats = () => {
  return {
    renderCount: performanceStats.renderCount,
    averageRenderTime: performanceStats.averageRenderTime,
    virtualCanvasEnabled: performanceStats.virtualCanvasEnabled
  };
};

export const resetBoardPerformanceStats = () => {
  performanceStats.renderCount = 0;
  performanceStats.averageRenderTime = 0;
  performanceStats.lastRenderTime = performance.now();
};