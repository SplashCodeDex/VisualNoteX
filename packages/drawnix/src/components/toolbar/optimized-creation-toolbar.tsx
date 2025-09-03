/**
 * Optimized Creation Toolbar - Performance-enhanced with React.memo and useMemo
 * Provides better rendering performance for toolbar interactions
 */

import React, { useMemo, useCallback, memo } from 'react';
import { useDrawnix } from '../../hooks/use-drawnix';
import { FreehandShape } from '../../plugins/freehand/type';
import { getFreehandPointers } from '../../plugins/freehand/utils';
import { ToolButton } from './tool-button';
import { useSetPointer } from '../../hooks/use-drawnix';
import classNames from 'classnames';
import './creation-toolbar.scss';

export interface OptimizedCreationToolbarProps {
  className?: string;
  style?: React.CSSProperties;
}

// Memoized toolbar button component
const ToolbarButton = memo<{
  shape: FreehandShape;
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}>(({ shape, isActive, onClick, children }) => {
  return (
    <ToolButton
      key={shape}
      type="button"
      className={classNames('creation-toolbar-button', {
        'creation-toolbar-button--active': isActive,
      })}
      onClick={onClick}
      title={`Draw ${shape}`}
    >
      {children}
    </ToolButton>
  );
});

ToolbarButton.displayName = 'ToolbarButton';

// Main optimized toolbar component
export const OptimizedCreationToolbar: React.FC<OptimizedCreationToolbarProps> = memo(({
  className,
  style
}) => {
  const { appState } = useDrawnix();
  const setPointer = useSetPointer();

  // Memoize pointer options to prevent unnecessary re-computations
  const pointerOptions = useMemo(() => getFreehandPointers(), []);

  // Memoize current pointer state
  const currentPointer = useMemo(() => appState.pointer, [appState.pointer]);

  // Memoized click handlers to prevent recreation on every render
  const handlePointerClick = useCallback((shape: FreehandShape) => {
    setPointer(shape);
  }, [setPointer]);

  // Memoized button rendering
  const toolbarButtons = useMemo(() =>
    pointerOptions.map((shape) => {
      const isActive = currentPointer === shape;
      const icon = getShapeIcon(shape);

      return (
        <ToolbarButton
          key={shape}
          shape={shape}
          isActive={isActive}
          onClick={() => handlePointerClick(shape)}
        >
          {icon}
        </ToolbarButton>
      );
    }), [pointerOptions, currentPointer, handlePointerClick]
  );

  return (
    <div
      className={classNames('creation-toolbar', className)}
      style={style}
      role="toolbar"
      aria-label="Drawing tools"
    >
      <div className="creation-toolbar-group">
        {toolbarButtons}
      </div>
    </div>
  );
});

OptimizedCreationToolbar.displayName = 'OptimizedCreationToolbar';

// Optimized icon rendering function
function getShapeIcon(shape: FreehandShape): React.ReactNode {
  switch (shape) {
    case FreehandShape.feltTipPen:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
          <path d="M18 13l-1.5-7.5L2 3l3.5 14.5L9 21l4.5-4.5"/>
          <path d="M2 3l7.586 7.586"/>
          <circle cx="11" cy="11" r="2"/>
        </svg>
      );
    case FreehandShape.eraser:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 20H7L3 16V4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2Z"/>
          <path d="M9 12l2 2 4-4"/>
          <path d="M21 15V4"/>
        </svg>
      );
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      );
  }
}

// Performance monitoring hook (can be used for debugging)
export const useToolbarPerformance = () => {
  const renderCount = React.useRef(0);
  const lastRenderTime = React.useRef(performance.now());

  React.useEffect(() => {
    renderCount.current += 1;
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTime.current;

    if (renderCount.current % 10 === 0) {
      console.log(`[OptimizedCreationToolbar] Render #${renderCount.current}, time since last: ${timeSinceLastRender.toFixed(2)}ms`);
    }

    lastRenderTime.current = now;
  });

  return {
    renderCount: renderCount.current,
    averageRenderTime: performance.now() - lastRenderTime.current
  };
};