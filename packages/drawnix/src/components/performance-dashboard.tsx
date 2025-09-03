/**
 * Performance Dashboard - Real-time performance monitoring and visualization
 * Provides insights into application performance with interactive charts and alerts
 */

import React, { useState, useEffect, useMemo } from 'react';
import { usePerformanceMonitor, PerformanceReport, PerformanceAlert } from '../utils/performance-monitor';
import { AutomatedPerformanceTester, DrawnixPerformanceSuites } from '../utils/performance-tests';
import classNames from 'classnames';
import './performance-dashboard.scss';

interface PerformanceDashboardProps {
  isVisible?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
  compact?: boolean;
  className?: string;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  isVisible = true,
  autoRefresh = true,
  refreshInterval = 2000,
  compact = false,
  className
}) => {
  const { report, recordMetric, getReport, exportData } = usePerformanceMonitor(autoRefresh);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'metrics' | 'alerts' | 'tests'>('overview');
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Force refresh of performance data
      getReport();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, getReport]);

  // Run performance tests
  const runPerformanceTests = async () => {
    setIsRunningTests(true);
    try {
      const tester = new AutomatedPerformanceTester();
      const results = await tester.runAllSuites();
      setTestResults(results);
    } catch (error) {
      console.error('Performance tests failed:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Export performance data
  const exportPerformanceData = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawnix-performance-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
  };

  if (!isVisible) return null;

  return (
    <div className={classNames('performance-dashboard', { 'performance-dashboard--compact': compact }, className)}>
      <div className="performance-dashboard__header">
        <h3 className="performance-dashboard__title">
          🚀 Performance Dashboard
        </h3>
        <div className="performance-dashboard__actions">
          <button
            className="performance-dashboard__action-btn"
            onClick={runPerformanceTests}
            disabled={isRunningTests}
          >
            {isRunningTests ? '⏳ Running Tests...' : '🧪 Run Tests'}
          </button>
          <button
            className="performance-dashboard__action-btn"
            onClick={() => setShowExportDialog(true)}
          >
            📊 Export Data
          </button>
        </div>
      </div>

      <div className="performance-dashboard__tabs">
        {(['overview', 'metrics', 'alerts', 'tests'] as const).map(tab => (
          <button
            key={tab}
            className={classNames('performance-dashboard__tab', {
              'performance-dashboard__tab--active': selectedTab === tab
            })}
            onClick={() => setSelectedTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="performance-dashboard__content">
        {selectedTab === 'overview' && (
          <PerformanceOverview report={report} compact={compact} />
        )}

        {selectedTab === 'metrics' && (
          <PerformanceMetrics report={report} />
        )}

        {selectedTab === 'alerts' && (
          <PerformanceAlerts alerts={report?.alerts || []} />
        )}

        {selectedTab === 'tests' && (
          <PerformanceTests
            testResults={testResults}
            isRunning={isRunningTests}
            onRunTests={runPerformanceTests}
          />
        )}
      </div>

      {showExportDialog && (
        <ExportDialog
          onExport={exportPerformanceData}
          onCancel={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
};

// Overview Component
const PerformanceOverview: React.FC<{ report: PerformanceReport | null; compact: boolean }> = ({
  report,
  compact
}) => {
  const performanceScore = useMemo(() => {
    if (!report) return 0;
    // Calculate overall performance score (0-100)
    const fpsScore = Math.min(100, (report.summary.averageFPS / 60) * 100);
    const memoryScore = Math.max(0, 100 - (report.summary.memoryUsage / (50 * 1024 * 1024)) * 100);
    const renderScore = Math.max(0, 100 - (report.summary.renderTime / 16.67) * 100);
    const interactionScore = Math.max(0, 100 - (report.summary.interactionLatency / 100) * 100);

    return Math.round((fpsScore + memoryScore + renderScore + interactionScore) / 4);
  }, [report]);

  if (!report) {
    return <div className="performance-dashboard__loading">Loading performance data...</div>;
  }

  return (
    <div className="performance-overview">
      <div className="performance-overview__score">
        <div className="performance-score">
          <div className="performance-score__value">{performanceScore}</div>
          <div className="performance-score__label">Performance Score</div>
        </div>
        <div className="performance-score__indicator">
          <div
            className={classNames('performance-score__bar', {
              'performance-score__bar--good': performanceScore >= 80,
              'performance-score__bar--warning': performanceScore >= 60 && performanceScore < 80,
              'performance-score__bar--poor': performanceScore < 60
            })}
            style={{ width: `${performanceScore}%` }}
          />
        </div>
      </div>

      {!compact && (
        <div className="performance-overview__metrics">
          <MetricCard
            title="FPS"
            value={report.summary.averageFPS.toFixed(1)}
            unit="fps"
            status={report.summary.averageFPS >= 50 ? 'good' : report.summary.averageFPS >= 30 ? 'warning' : 'poor'}
          />
          <MetricCard
            title="Memory"
            value={(report.summary.memoryUsage / 1024 / 1024).toFixed(1)}
            unit="MB"
            status={report.summary.memoryUsage < 50 * 1024 * 1024 ? 'good' : report.summary.memoryUsage < 100 * 1024 * 1024 ? 'warning' : 'poor'}
          />
          <MetricCard
            title="Render Time"
            value={report.summary.renderTime.toFixed(1)}
            unit="ms"
            status={report.summary.renderTime <= 16.67 ? 'good' : report.summary.renderTime <= 33.33 ? 'warning' : 'poor'}
          />
          <MetricCard
            title="Interaction"
            value={report.summary.interactionLatency.toFixed(1)}
            unit="ms"
            status={report.summary.interactionLatency <= 50 ? 'good' : report.summary.interactionLatency <= 100 ? 'warning' : 'poor'}
          />
        </div>
      )}

      {report.recommendations.length > 0 && (
        <div className="performance-overview__recommendations">
          <h4>💡 Recommendations</h4>
          <ul>
            {report.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Metrics Component
const PerformanceMetrics: React.FC<{ report: PerformanceReport | null }> = ({ report }) => {
  if (!report) return null;

  const metricsByCategory = useMemo(() => {
    const categories: Record<string, typeof report.metrics> = {};
    report.metrics.forEach(metric => {
      if (!categories[metric.category]) {
        categories[metric.category] = [];
      }
      categories[metric.category].push(metric);
    });
    return categories;
  }, [report.metrics]);

  return (
    <div className="performance-metrics">
      {Object.entries(metricsByCategory).map(([category, metrics]) => (
        <div key={category} className="performance-metrics__category">
          <h4 className="performance-metrics__category-title">
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </h4>
          <div className="performance-metrics__grid">
            {metrics.slice(-10).map((metric, index) => (
              <div key={index} className="performance-metrics__item">
                <div className="performance-metrics__name">{metric.name}</div>
                <div className="performance-metrics__value">
                  {typeof metric.value === 'number' ? metric.value.toFixed(2) : metric.value}
                </div>
                <div className="performance-metrics__timestamp">
                  {new Date(metric.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Alerts Component
const PerformanceAlerts: React.FC<{ alerts: PerformanceAlert[] }> = ({ alerts }) => {
  return (
    <div className="performance-alerts">
      {alerts.length === 0 ? (
        <div className="performance-alerts__empty">
          ✅ No performance alerts at this time
        </div>
      ) : (
        <div className="performance-alerts__list">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={classNames('performance-alerts__item', {
                'performance-alerts__item--critical': alert.type === 'critical',
                'performance-alerts__item--warning': alert.type === 'warning',
                'performance-alerts__item--info': alert.type === 'info'
              })}
            >
              <div className="performance-alerts__header">
                <span className="performance-alerts__type">{alert.type.toUpperCase()}</span>
                <span className="performance-alerts__metric">{alert.metric}</span>
                <span className="performance-alerts__time">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="performance-alerts__message">{alert.message}</div>
              <div className="performance-alerts__details">
                Threshold: {alert.threshold}, Current: {alert.currentValue}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Tests Component
const PerformanceTests: React.FC<{
  testResults: any;
  isRunning: boolean;
  onRunTests: () => void;
}> = ({ testResults, isRunning, onRunTests }) => {
  return (
    <div className="performance-tests">
      <div className="performance-tests__header">
        <h4>🧪 Performance Test Suites</h4>
        <button
          className="performance-tests__run-btn"
          onClick={onRunTests}
          disabled={isRunning}
        >
          {isRunning ? '⏳ Running...' : '▶️ Run All Tests'}
        </button>
      </div>

      {testResults ? (
        <div className="performance-tests__results">
          <div className="performance-tests__summary">
            <div className="performance-tests__stat">
              <span className="performance-tests__stat-label">Total Tests:</span>
              <span className="performance-tests__stat-value">{testResults.summary.totalTests}</span>
            </div>
            <div className="performance-tests__stat">
              <span className="performance-tests__stat-label">Passed:</span>
              <span className="performance-tests__stat-value performance-tests__stat-value--success">
                {testResults.summary.passedTests}
              </span>
            </div>
            <div className="performance-tests__stat">
              <span className="performance-tests__stat-label">Failed:</span>
              <span className="performance-tests__stat-value performance-tests__stat-value--error">
                {testResults.summary.failedTests}
              </span>
            </div>
          </div>

          {testResults.regressions.hasRegressions && (
            <div className="performance-tests__regressions">
              <h5>⚠️ Performance Regressions Detected</h5>
              {testResults.regressions.regressions.map((regression: any, index: number) => (
                <div key={index} className="performance-tests__regression">
                  <div className="performance-tests__regression-name">{regression.testName}</div>
                  <div className="performance-tests__regression-details">
                    Degradation: +{regression.degradationPercent.toFixed(1)}%
                    (Severity: {regression.severity})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="performance-tests__empty">
          {isRunning ? 'Running performance tests...' : 'Click "Run All Tests" to start performance validation'}
        </div>
      )}
    </div>
  );
};

// Metric Card Component
const MetricCard: React.FC<{
  title: string;
  value: string;
  unit: string;
  status: 'good' | 'warning' | 'poor';
}> = ({ title, value, unit, status }) => (
  <div className={classNames('metric-card', `metric-card--${status}`)}>
    <div className="metric-card__title">{title}</div>
    <div className="metric-card__value">{value}</div>
    <div className="metric-card__unit">{unit}</div>
  </div>
);

// Export Dialog Component
const ExportDialog: React.FC<{
  onExport: () => void;
  onCancel: () => void;
}> = ({ onExport, onCancel }) => (
  <div className="export-dialog-overlay">
    <div className="export-dialog">
      <h4>📊 Export Performance Data</h4>
      <p>Export current performance metrics and test results to a JSON file?</p>
      <div className="export-dialog__actions">
        <button className="export-dialog__btn export-dialog__btn--cancel" onClick={onCancel}>
          Cancel
        </button>
        <button className="export-dialog__btn export-dialog__btn--export" onClick={onExport}>
          Export
        </button>
      </div>
    </div>
  </div>
);

export default PerformanceDashboard;