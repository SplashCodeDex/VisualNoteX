/**
 * Event Optimizer - Advanced event handling with throttling, debouncing, and performance optimization
 * Provides efficient event processing for smooth user interactions
 */

export interface EventOptimizationOptions {
  throttleMs?: number;
  debounceMs?: number;
  maxFrequency?: number;
  enablePointerEvents?: boolean;
  enableWheelEvents?: boolean;
  enableKeyboardEvents?: boolean;
  adaptiveThrottling?: boolean;
}

export interface EventMetrics {
  eventType: string;
  processedCount: number;
  throttledCount: number;
  averageProcessingTime: number;
  peakFrequency: number;
}

export class EventOptimizer {
  private throttledFunctions = new Map<string, { func: Function; timeout: number | null }>();
  private debouncedFunctions = new Map<string, { func: Function; timeout: number | null }>();
  private eventMetrics = new Map<string, EventMetrics>();
  private eventHistory: Array<{ type: string; timestamp: number }> = [];
  private maxHistorySize = 1000;
  private adaptiveMode = false;

  constructor(private options: Required<EventOptimizationOptions>) {
    this.options = {
      throttleMs: 16, // ~60fps
      debounceMs: 100,
      maxFrequency: 60,
      enablePointerEvents: true,
      enableWheelEvents: true,
      enableKeyboardEvents: true,
      adaptiveThrottling: true,
      ...options
    };

    this.adaptiveMode = this.options.adaptiveThrottling;
  }

  /**
   * Throttle a function to limit execution frequency
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    key: string,
    customThrottleMs?: number
  ): T {
    const throttleMs = customThrottleMs || this.options.throttleMs;

    if (this.throttledFunctions.has(key)) {
      return this.throttledFunctions.get(key)!.func as T;
    }

    let lastExecution = 0;
    let scheduledExecution: number | null = null;

    const throttledFunc = ((...args: any[]) => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecution;

      if (timeSinceLastExecution >= throttleMs) {
        // Execute immediately
        this.recordEventExecution(key, 'throttled_immediate');
        lastExecution = now;
        return func(...args);
      } else {
        // Schedule for later
        if (scheduledExecution) {
          clearTimeout(scheduledExecution);
        }

        scheduledExecution = window.setTimeout(() => {
          this.recordEventExecution(key, 'throttled_delayed');
          lastExecution = Date.now();
          scheduledExecution = null;
          func(...args);
        }, throttleMs - timeSinceLastExecution);
      }
    }) as T;

    this.throttledFunctions.set(key, {
      func: throttledFunc,
      timeout: null
    });

    return throttledFunc;
  }

  /**
   * Debounce a function to delay execution until after wait time
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    key: string,
    customDebounceMs?: number
  ): T {
    const debounceMs = customDebounceMs || this.options.debounceMs;

    if (this.debouncedFunctions.has(key)) {
      return this.debouncedFunctions.get(key)!.func as T;
    }

    let timeout: number | null = null;

    const debouncedFunc = ((...args: any[]) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = window.setTimeout(() => {
        this.recordEventExecution(key, 'debounced');
        func(...args);
        timeout = null;
      }, debounceMs);
    }) as T;

    this.debouncedFunctions.set(key, {
      func: debouncedFunc,
      timeout
    });

    return debouncedFunc;
  }

  /**
   * Create an optimized pointer event handler
   */
  createPointerHandler(
    handler: (event: PointerEvent) => void,
    options: {
      passive?: boolean;
      capture?: boolean;
      throttleMs?: number;
    } = {}
  ) {
    if (!this.options.enablePointerEvents) {
      return handler;
    }

    const { passive = true, capture = false, throttleMs } = options;
    const throttledHandler = this.throttle(handler, `pointer_${handler.name}`, throttleMs);

    return (event: PointerEvent) => {
      // Adaptive throttling based on event frequency
      if (this.adaptiveMode) {
        const recentEvents = this.getRecentEvents('pointer', 100);
        if (recentEvents.length > 10) {
          // High frequency - increase throttling
          const adaptiveThrottle = Math.min(throttleMs || this.options.throttleMs * 2, 100);
          return this.throttle(handler, `pointer_adaptive_${handler.name}`, adaptiveThrottle)(event);
        }
      }

      return throttledHandler(event);
    };
  }

  /**
   * Create an optimized wheel event handler
   */
  createWheelHandler(
    handler: (event: WheelEvent) => void,
    options: {
      passive?: boolean;
      capture?: boolean;
      debounceMs?: number;
    } = {}
  ) {
    if (!this.options.enableWheelEvents) {
      return handler;
    }

    const { passive = true, capture = false, debounceMs = 16 } = options;
    return this.debounce(handler, `wheel_${handler.name}`, debounceMs);
  }

  /**
   * Create an optimized keyboard event handler
   */
  createKeyboardHandler(
    handler: (event: KeyboardEvent) => void,
    options: {
      throttleMs?: number;
      ignoreRepeat?: boolean;
    } = {}
  ) {
    if (!this.options.enableKeyboardEvents) {
      return handler;
    }

    const { throttleMs = 50, ignoreRepeat = true } = options;

    const optimizedHandler = (event: KeyboardEvent) => {
      if (ignoreRepeat && event.repeat) {
        return;
      }
      return handler(event);
    };

    return this.throttle(optimizedHandler, `keyboard_${handler.name}`, throttleMs);
  }

  /**
   * Get performance metrics for event handling
   */
  getEventMetrics(): Record<string, EventMetrics> {
    const metrics: Record<string, EventMetrics> = {};

    for (const [eventType, metric] of this.eventMetrics) {
      metrics[eventType] = { ...metric };
    }

    return metrics;
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.eventMetrics.clear();
    this.eventHistory = [];
  }

  /**
   * Enable or disable adaptive throttling
   */
  setAdaptiveMode(enabled: boolean): void {
    this.adaptiveMode = enabled && this.options.adaptiveThrottling;
  }

  /**
   * Update optimization options
   */
  updateOptions(newOptions: Partial<EventOptimizationOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all timeouts
    for (const [key, { timeout }] of this.throttledFunctions) {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    for (const [key, { timeout }] of this.debouncedFunctions) {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

    this.throttledFunctions.clear();
    this.debouncedFunctions.clear();
    this.eventMetrics.clear();
    this.eventHistory = [];
  }

  private recordEventExecution(eventType: string, executionType: string): void {
    const now = Date.now();

    // Record in history
    this.eventHistory.push({ type: eventType, timestamp: now });

    // Maintain history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Update metrics
    if (!this.eventMetrics.has(eventType)) {
      this.eventMetrics.set(eventType, {
        eventType,
        processedCount: 0,
        throttledCount: 0,
        averageProcessingTime: 0,
        peakFrequency: 0
      });
    }

    const metrics = this.eventMetrics.get(eventType)!;

    if (executionType.includes('throttled')) {
      metrics.throttledCount++;
    } else {
      metrics.processedCount++;
    }

    // Calculate frequency
    const recentEvents = this.getRecentEvents(eventType, 1000); // Last second
    const frequency = recentEvents.length;
    metrics.peakFrequency = Math.max(metrics.peakFrequency, frequency);
  }

  private getRecentEvents(eventType: string, timeWindow: number): Array<{ type: string; timestamp: number }> {
    const now = Date.now();
    const cutoff = now - timeWindow;

    return this.eventHistory.filter(event =>
      event.type === eventType && event.timestamp >= cutoff
    );
  }
}

/**
 * React hook for using event optimizer
 */
import { useMemo, useRef, useCallback, useEffect } from 'react';

export function useEventOptimizer(options: EventOptimizationOptions = {}) {
  const optimizerRef = useRef<EventOptimizer>();

  const optimizer = useMemo(() => {
    if (!optimizerRef.current) {
      optimizerRef.current = new EventOptimizer(options);
    }
    return optimizerRef.current;
  }, [options]);

  // Update options when they change
  useEffect(() => {
    optimizer.updateOptions(options);
  }, [optimizer, options]);

  const throttle = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    key: string,
    throttleMs?: number
  ) => {
    return optimizer.throttle(func, key, throttleMs);
  }, [optimizer]);

  const debounce = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    key: string,
    debounceMs?: number
  ) => {
    return optimizer.debounce(func, key, debounceMs);
  }, [optimizer]);

  const createPointerHandler = useCallback((
    handler: (event: PointerEvent) => void,
    options?: Parameters<EventOptimizer['createPointerHandler']>[1]
  ) => {
    return optimizer.createPointerHandler(handler, options);
  }, [optimizer]);

  const createWheelHandler = useCallback((
    handler: (event: WheelEvent) => void,
    options?: Parameters<EventOptimizer['createWheelHandler']>[1]
  ) => {
    return optimizer.createWheelHandler(handler, options);
  }, [optimizer]);

  const createKeyboardHandler = useCallback((
    handler: (event: KeyboardEvent) => void,
    options?: Parameters<EventOptimizer['createKeyboardHandler']>[1]
  ) => {
    return optimizer.createKeyboardHandler(handler, options);
  }, [optimizer]);

  const getMetrics = useCallback(() => {
    return optimizer.getEventMetrics();
  }, [optimizer]);

  const resetMetrics = useCallback(() => {
    optimizer.resetMetrics();
  }, [optimizer]);

  const setAdaptiveMode = useCallback((enabled: boolean) => {
    optimizer.setAdaptiveMode(enabled);
  }, [optimizer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      optimizer.destroy();
    };
  }, [optimizer]);

  return {
    throttle,
    debounce,
    createPointerHandler,
    createWheelHandler,
    createKeyboardHandler,
    getMetrics,
    resetMetrics,
    setAdaptiveMode
  };
}

/**
 * Performance presets for different use cases
 */
export const EventOptimizationPresets = {
  // For smooth drawing operations
  drawing: {
    throttleMs: 8, // ~120fps
    debounceMs: 16,
    maxFrequency: 120,
    adaptiveThrottling: true
  },

  // For UI interactions
  ui: {
    throttleMs: 16, // ~60fps
    debounceMs: 100,
    maxFrequency: 60,
    adaptiveThrottling: true
  },

  // For text input
  text: {
    throttleMs: 50,
    debounceMs: 300,
    maxFrequency: 20,
    adaptiveThrottling: false
  },

  // For scroll/zoom operations
  navigation: {
    throttleMs: 16,
    debounceMs: 50,
    maxFrequency: 60,
    adaptiveThrottling: true
  }
} as const;