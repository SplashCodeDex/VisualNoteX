/**
 * Error Tracking - Comprehensive error monitoring and alerting system
 * Tracks, analyzes, and reports application errors with performance context
 */

export interface ErrorEvent {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  type: 'javascript' | 'performance' | 'network' | 'resource' | 'user_action';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userAgent: string;
  url: string;
  userId?: string;
  sessionId: string;
  context: {
    component?: string;
    action?: string;
    performanceMetrics?: {
      fps: number;
      memoryUsage: number;
      renderTime: number;
    };
    userInteraction?: {
      element: string;
      action: string;
      timestamp: number;
    };
  };
  tags: Record<string, string>;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface ErrorAlert {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  severity: ErrorEvent['severity'];
  errorCount: number;
  affectedUsers: number;
  firstOccurrence: number;
  lastOccurrence: number;
  errorIds: string[];
  status: 'active' | 'acknowledged' | 'resolved';
  assignedTo?: string;
  tags: string[];
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByComponent: Record<string, number>;
  topErrors: Array<{
    message: string;
    count: number;
    severity: ErrorEvent['severity'];
    lastOccurrence: number;
  }>;
  errorTrends: Array<{
    date: string;
    count: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  userImpact: {
    affectedUsers: number;
    errorRate: number; // errors per user session
    crashRate: number;
  };
}

export class ErrorTracker {
  private errors: ErrorEvent[] = [];
  private alerts: ErrorAlert[] = [];
  private maxErrors = 1000;
  private sessionId: string;
  private userId?: string;

  constructor(userId?: string) {
    this.sessionId = this.generateSessionId();
    this.userId = userId;
    this.initializeErrorTracking();
  }

  /**
   * Track a new error
   */
  trackError(
    error: Error | string,
    context: Partial<ErrorEvent['context']> = {},
    tags: Record<string, string> = {}
  ): string {
    const errorEvent: ErrorEvent = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      type: this.classifyError(error),
      severity: this.calculateSeverity(error, context),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.userId,
      sessionId: this.sessionId,
      context: {
        ...context,
        performanceMetrics: this.getCurrentPerformanceMetrics()
      },
      tags: {
        ...tags,
        browser: this.getBrowserInfo(),
        platform: navigator.platform
      },
      resolved: false
    };

    this.errors.push(errorEvent);

    // Maintain error limit
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Check for alert conditions
    this.checkAlertConditions(errorEvent);

    console.error('🚨 Error tracked:', errorEvent.message, errorEvent);

    return errorEvent.id;
  }

  /**
   * Track performance-related errors
   */
  trackPerformanceError(
    metric: string,
    value: number,
    threshold: number,
    context: Partial<ErrorEvent['context']> = {}
  ): string {
    const message = `Performance threshold exceeded: ${metric} = ${value} (threshold: ${threshold})`;

    return this.trackError(
      message,
      {
        ...context,
        action: 'performance_monitoring'
      },
      {
        metric,
        value: value.toString(),
        threshold: threshold.toString(),
        category: 'performance'
      }
    );
  }

  /**
   * Track user interaction errors
   */
  trackUserInteractionError(
    action: string,
    element: string,
    error: Error | string,
    context: Partial<ErrorEvent['context']> = {}
  ): string {
    return this.trackError(
      error,
      {
        ...context,
        action,
        userInteraction: {
          element,
          action,
          timestamp: Date.now()
        }
      },
      {
        interaction: action,
        element,
        category: 'user_interaction'
      }
    );
  }

  /**
   * Get error analytics
   */
  getAnalytics(timeRange: number = 24 * 60 * 60 * 1000): ErrorAnalytics {
    const cutoff = Date.now() - timeRange;
    const recentErrors = this.errors.filter(e => e.timestamp >= cutoff);

    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    const errorsByComponent: Record<string, number> = {};

    recentErrors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;

      const component = error.context.component || 'unknown';
      errorsByComponent[component] = (errorsByComponent[component] || 0) + 1;
    });

    // Calculate top errors
    const errorGroups = new Map<string, ErrorEvent[]>();
    recentErrors.forEach(error => {
      const key = `${error.message}_${error.type}`;
      if (!errorGroups.has(key)) {
        errorGroups.set(key, []);
      }
      errorGroups.get(key)!.push(error);
    });

    const topErrors = Array.from(errorGroups.entries())
      .map(([key, errors]) => ({
        message: errors[0].message,
        count: errors.length,
        severity: errors[0].severity,
        lastOccurrence: Math.max(...errors.map(e => e.timestamp))
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate user impact
    const uniqueUsers = new Set(recentErrors.map(e => e.userId || e.sessionId)).size;
    const uniqueSessions = new Set(recentErrors.map(e => e.sessionId)).size;
    const crashErrors = recentErrors.filter(e => e.severity === 'critical').length;

    return {
      totalErrors: recentErrors.length,
      errorsByType,
      errorsBySeverity,
      errorsByComponent,
      topErrors,
      errorTrends: this.calculateErrorTrends(recentErrors, timeRange),
      userImpact: {
        affectedUsers: uniqueUsers,
        errorRate: uniqueSessions > 0 ? recentErrors.length / uniqueSessions : 0,
        crashRate: uniqueSessions > 0 ? crashErrors / uniqueSessions : 0
      }
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): ErrorAlert[] {
    return this.alerts.filter(alert => alert.status === 'active');
  }

  /**
   * Resolve an error
   */
  resolveError(errorId: string, resolvedBy?: string): boolean {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      error.resolvedAt = Date.now();
      error.resolvedBy = resolvedBy;

      // Update related alerts
      const relatedAlerts = this.alerts.filter(alert =>
        alert.errorIds.includes(errorId) && alert.status === 'active'
      );

      relatedAlerts.forEach(alert => {
        alert.status = 'resolved';
      });

      return true;
    }
    return false;
  }

  /**
   * Export error data
   */
  exportData(): {
    errors: ErrorEvent[];
    alerts: ErrorAlert[];
    analytics: ErrorAnalytics;
  } {
    return {
      errors: [...this.errors],
      alerts: [...this.alerts],
      analytics: this.getAnalytics()
    };
  }

  /**
   * Clear old data
   */
  clearOldData(maxAge: number = 30 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    this.errors = this.errors.filter(e => e.timestamp >= cutoff);
    this.alerts = this.alerts.filter(a => a.lastOccurrence >= cutoff);
  }

  private initializeErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError(
        event.error || event.message,
        {
          component: 'global',
          action: 'uncaught_error'
        },
        {
          filename: event.filename,
          lineno: event.lineno?.toString(),
          colno: event.colno?.toString()
        }
      );
    });

    // Promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(
        event.reason || 'Unhandled promise rejection',
        {
          component: 'global',
          action: 'unhandled_promise_rejection'
        },
        {
          category: 'promise'
        }
      );
    });

    // Performance error tracking
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'measure' && entry.duration > 100) {
              this.trackPerformanceError(
                'long_task',
                entry.duration,
                100,
                {
                  component: 'performance',
                  action: 'long_task_detected'
                }
              );
            }
          });
        });

        observer.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance observer not supported:', error);
      }
    }
  }

  private classifyError(error: Error | string): ErrorEvent['type'] {
    const message = error instanceof Error ? error.message : error;

    if (message.includes('fetch') || message.includes('network') || message.includes('404')) {
      return 'network';
    }

    if (message.includes('performance') || message.includes('fps') || message.includes('memory')) {
      return 'performance';
    }

    if (message.includes('user') || message.includes('click') || message.includes('interaction')) {
      return 'user_action';
    }

    if (message.includes('script') || message.includes('style') || message.includes('resource')) {
      return 'resource';
    }

    return 'javascript';
  }

  private calculateSeverity(
    error: Error | string,
    context: Partial<ErrorEvent['context']>
  ): ErrorEvent['severity'] {
    const message = error instanceof Error ? error.message : error;

    // Critical errors
    if (message.includes('out of memory') || message.includes('stack overflow')) {
      return 'critical';
    }

    // High severity
    if (message.includes('network') || message.includes('timeout') ||
        context.performanceMetrics?.fps && context.performanceMetrics.fps < 10) {
      return 'high';
    }

    // Medium severity
    if (message.includes('undefined') || message.includes('null') ||
        context.performanceMetrics?.memoryUsage && context.performanceMetrics.memoryUsage > 100 * 1024 * 1024) {
      return 'medium';
    }

    // Low severity (default)
    return 'low';
  }

  private checkAlertConditions(error: ErrorEvent): void {
    // Check for error frequency
    const recentErrors = this.errors.filter(e =>
      e.timestamp > Date.now() - 5 * 60 * 1000 && // Last 5 minutes
      e.message === error.message &&
      e.type === error.type
    );

    if (recentErrors.length >= 5) { // 5+ similar errors in 5 minutes
      this.createAlert(error, recentErrors);
    }

    // Check for critical errors
    if (error.severity === 'critical') {
      this.createAlert(error, [error], 'Critical error detected');
    }
  }

  private createAlert(
    error: ErrorEvent,
    relatedErrors: ErrorEvent[],
    customTitle?: string
  ): void {
    const alertId = this.generateAlertId();
    const errorIds = relatedErrors.map(e => e.id);

    const alert: ErrorAlert = {
      id: alertId,
      timestamp: Date.now(),
      title: customTitle || `Multiple ${error.type} errors: ${error.message}`,
      description: `Detected ${relatedErrors.length} similar errors in the last 5 minutes`,
      severity: error.severity,
      errorCount: relatedErrors.length,
      affectedUsers: new Set(relatedErrors.map(e => e.userId || e.sessionId)).size,
      firstOccurrence: Math.min(...relatedErrors.map(e => e.timestamp)),
      lastOccurrence: Math.max(...relatedErrors.map(e => e.timestamp)),
      errorIds,
      status: 'active',
      tags: Object.keys(error.tags)
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    console.warn('🚨 Error Alert Created:', alert.title);
  }

  private getCurrentPerformanceMetrics() {
    const memInfo = (performance as any).memory;
    return {
      fps: 60, // Placeholder - would need actual FPS calculation
      memoryUsage: memInfo ? memInfo.usedJSHeapSize : 0,
      renderTime: 16.67 // Placeholder - would need actual render time
    };
  }

  private getBrowserInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private calculateErrorTrends(errors: ErrorEvent[], timeRange: number): ErrorAnalytics['errorTrends'] {
    const hours = Math.floor(timeRange / (60 * 60 * 1000));
    const trends: ErrorAnalytics['errorTrends'] = [];

    for (let i = 0; i < hours; i++) {
      const hourStart = Date.now() - (i + 1) * 60 * 60 * 1000;
      const hourEnd = Date.now() - i * 60 * 60 * 1000;

      const hourErrors = errors.filter(e => e.timestamp >= hourStart && e.timestamp < hourEnd);

      ['low', 'medium', 'high', 'critical'].forEach(severity => {
        const count = hourErrors.filter(e => e.severity === severity).length;
        if (count > 0) {
          trends.push({
            date: new Date(hourStart).toISOString().split('T')[0],
            count,
            severity: severity as any
          });
        }
      });
    }

    return trends;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Error tracking hook for React components
 */
import { useEffect, useCallback } from 'react';

export function useErrorTracking(userId?: string) {
  const tracker = useEffect(() => new ErrorTracker(userId), [userId]);

  const trackError = useCallback((
    error: Error | string,
    context?: Partial<ErrorEvent['context']>,
    tags?: Record<string, string>
  ) => {
    return tracker.trackError(error, context, tags);
  }, [tracker]);

  const trackPerformanceError = useCallback((
    metric: string,
    value: number,
    threshold: number,
    context?: Partial<ErrorEvent['context']>
  ) => {
    return tracker.trackPerformanceError(metric, value, threshold, context);
  }, [tracker]);

  const trackUserInteractionError = useCallback((
    action: string,
    element: string,
    error: Error | string,
    context?: Partial<ErrorEvent['context']>
  ) => {
    return tracker.trackUserInteractionError(action, element, error, context);
  }, [tracker]);

  const getAnalytics = useCallback((timeRange?: number) => {
    return tracker.getAnalytics(timeRange);
  }, [tracker]);

  const getActiveAlerts = useCallback(() => {
    return tracker.getActiveAlerts();
  }, [tracker]);

  return {
    trackError,
    trackPerformanceError,
    trackUserInteractionError,
    getAnalytics,
    getActiveAlerts,
    exportData: () => tracker.exportData(),
    clearOldData: (maxAge?: number) => tracker.clearOldData(maxAge)
  };
}

/**
 * Global error boundary component
 */
import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Track the error
    const tracker = new ErrorTracker();
    tracker.trackError(error, {
      component: 'error_boundary',
      action: 'react_error_boundary'
    }, {
      componentStack: errorInfo.componentStack,
      errorBoundary: 'true'
    });

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <div style={{
          padding: '20px',
          margin: '20px',
          border: '1px solid #f44336',
          borderRadius: '8px',
          backgroundColor: '#ffebee',
          color: '#c62828'
        }}>
          <h3>🚨 Something went wrong</h3>
          <p>{this.state.error.message}</p>
          <button
            onClick={this.resetError}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
export const DefaultErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({
  error,
  resetError
}) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '48px', marginBottom: '16px' }}>😵</div>
    <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>Oops! Something went wrong</h3>
    <p style={{ margin: '0 0 16px 0', color: '#666' }}>{error.message}</p>
    <button
      onClick={resetError}
      style={{
        padding: '10px 20px',
        backgroundColor: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500'
      }}
    >
      🔄 Try Again
    </button>
  </div>
);