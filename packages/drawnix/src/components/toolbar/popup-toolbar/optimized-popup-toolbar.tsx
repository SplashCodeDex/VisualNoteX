/**
 * Optimized Popup Toolbar - Performance-enhanced with React.memo and selective re-rendering
 * Reduces unnecessary re-renders during drawing operations
 */

import React, { useMemo, useCallback, memo, useRef } from 'react';
import { PlaitBoard, PlaitPluginElementContext } from '@plait/core';
import { useDrawnix } from '../../../hooks/use-drawnix';
import { ToolButton } from '../tool-button';
import { FillButton } from './fill-button';
import { StrokeButton } from './stroke-button';
import { FontColorButton } from './font-color-button';
import { LinkButton } from './link-button';
import classNames from 'classnames';
import './popup-toolbar.scss';

export interface OptimizedPopupToolbarProps {
  board: PlaitBoard;
  elementContexts: PlaitPluginElementContext[];
  className?: string;
  style?: React.CSSProperties;
}

// Memoized individual toolbar buttons to prevent unnecessary re-renders
const MemoizedFillButton = memo(FillButton);
const MemoizedStrokeButton = memo(StrokeButton);
const MemoizedFontColorButton = memo(FontColorButton);
const MemoizedLinkButton = memo(LinkButton);

// Performance monitoring ref
const renderStatsRef = {
  renderCount: 0,
  lastRenderTime: performance.now(),
  averageRenderTime: 0
};

export const OptimizedPopupToolbar: React.FC<OptimizedPopupToolbarProps> = memo(({
  board,
  elementContexts,
  className,
  style
}) => {
  const renderStartTime = performance.now();

  // Memoize element analysis to prevent recalculation on every render
  const elementAnalysis = useMemo(() => {
    if (!elementContexts || elementContexts.length === 0) {
      return { hasElements: false, hasText: false, hasShapes: false, hasImages: false };
    }

    const hasText = elementContexts.some(ctx =>
      ctx.element.type === 'text' || ctx.element.type === 'mind'
    );
    const hasShapes = elementContexts.some(ctx =>
      ctx.element.type === 'geometry' || ctx.element.type === 'freehand'
    );
    const hasImages = elementContexts.some(ctx =>
      ctx.element.type === 'image'
    );

    return {
      hasElements: true,
      hasText,
      hasShapes,
      hasImages
    };
  }, [elementContexts]);

  // Memoize toolbar visibility and position
  const toolbarState = useMemo(() => {
    if (!elementAnalysis.hasElements) {
      return { visible: false, position: { x: 0, y: 0 } };
    }

    // Calculate optimal position based on element bounds
    const bounds = calculateElementBounds(elementContexts);
    const position = {
      x: bounds.centerX,
      y: bounds.top - 50 // Position above elements
    };

    return { visible: true, position };
  }, [elementAnalysis.hasElements, elementContexts]);

  // Early return for invisible toolbar
  if (!toolbarState.visible) {
    return null;
  }

  // Memoize button rendering based on element types
  const toolbarButtons = useMemo(() => {
    const buttons: React.ReactNode[] = [];

    if (elementAnalysis.hasShapes || elementAnalysis.hasText) {
      buttons.push(
        <MemoizedFillButton
          key="fill"
          board={board}
          elementContexts={elementContexts}
        />,
        <MemoizedStrokeButton
          key="stroke"
          board={board}
          elementContexts={elementContexts}
        />
      );
    }

    if (elementAnalysis.hasText) {
      buttons.push(
        <MemoizedFontColorButton
          key="font-color"
          board={board}
          elementContexts={elementContexts}
        />
      );
    }

    if (elementAnalysis.hasText) {
      buttons.push(
        <MemoizedLinkButton
          key="link"
          board={board}
          elementContexts={elementContexts}
        />
      );
    }

    return buttons;
  }, [elementAnalysis, board, elementContexts]);

  // Performance monitoring
  const renderTime = performance.now() - renderStartTime;
  renderStatsRef.renderCount += 1;
  renderStatsRef.averageRenderTime =
    (renderStatsRef.averageRenderTime + renderTime) / 2;

  // Log performance stats periodically
  if (renderStatsRef.renderCount % 20 === 0) {
    console.log(`[OptimizedPopupToolbar] Avg render time: ${renderStatsRef.averageRenderTime.toFixed(2)}ms`);
  }

  return (
    <div
      className={classNames('popup-toolbar', 'popup-toolbar--optimized', className)}
      style={{
        ...style,
        left: toolbarState.position.x,
        top: toolbarState.position.y,
        transform: 'translateX(-50%)'
      }}
      role="toolbar"
      aria-label="Element formatting tools"
    >
      <div className="popup-toolbar-content">
        {toolbarButtons}
      </div>

      {/* Performance indicator (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="popup-toolbar-performance-indicator">
          {renderTime.toFixed(1)}ms
        </div>
      )}
    </div>
  );
});

OptimizedPopupToolbar.displayName = 'OptimizedPopupToolbar';

// Optimized bounds calculation
function calculateElementBounds(elementContexts: PlaitPluginElementContext[]) {
  if (!elementContexts || elementContexts.length === 0) {
    return { centerX: 0, top: 0, bottom: 0, left: 0, right: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  elementContexts.forEach(ctx => {
    if (ctx.element.points && ctx.element.points.length > 0) {
      ctx.element.points.forEach(point => {
        minX = Math.min(minX, point[0]);
        maxX = Math.max(maxX, point[0]);
        minY = Math.min(minY, point[1]);
        maxY = Math.max(maxY, point[1]);
      });
    }
  });

  return {
    centerX: (minX + maxX) / 2,
    top: minY,
    bottom: maxY,
    left: minX,
    right: maxX
  };
}

// Hook for external performance monitoring
export const usePopupToolbarPerformance = () => {
  return {
    renderCount: renderStatsRef.renderCount,
    averageRenderTime: renderStatsRef.averageRenderTime,
    resetStats: () => {
      renderStatsRef.renderCount = 0;
      renderStatsRef.averageRenderTime = 0;
      renderStatsRef.lastRenderTime = performance.now();
    }
  };
};