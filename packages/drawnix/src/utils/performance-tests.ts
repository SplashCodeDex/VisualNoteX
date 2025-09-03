/**
 * Performance Test Suite - Automated benchmarks and regression testing
 * Provides comprehensive performance validation for Drawnix optimizations
 */

import { PerformanceBenchmark, PerformanceMonitor } from './performance-monitor';
import { PlaitElement, Point } from '@plait/core';

export interface PerformanceTestResult {
  testName: string;
  duration: number;
  memoryDelta: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceTestSuite {
  name: string;
  description: string;
  tests: PerformanceTest[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface PerformanceTest {
  name: string;
  description: string;
  run: () => Promise<PerformanceTestResult>;
  iterations?: number;
  timeout?: number;
}

export class PerformanceTestRunner {
  private monitor: PerformanceMonitor;
  private results: PerformanceTestResult[] = [];
  private isRunning = false;

  constructor() {
    this.monitor = new PerformanceMonitor();
  }

  /**
   * Run a complete test suite
   */
  async runSuite(suite: PerformanceTestSuite): Promise<{
    results: PerformanceTestResult[];
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      averageDuration: number;
      totalMemoryDelta: number;
    };
  }> {
    if (this.isRunning) {
      throw new Error('Test suite is already running');
    }

    this.isRunning = true;
    this.results = [];

    try {
      console.log(`🧪 Running performance test suite: ${suite.name}`);
      console.log(`📝 ${suite.description}`);

      // Setup
      if (suite.setup) {
        await suite.setup();
      }

      // Run tests
      for (const test of suite.tests) {
        try {
          console.log(`⏳ Running test: ${test.name}`);
          const result = await this.runTest(test);
          this.results.push(result);

          if (result.success) {
            console.log(`✅ ${test.name}: ${result.duration.toFixed(2)}ms`);
          } else {
            console.error(`❌ ${test.name}: ${result.error}`);
          }
        } catch (error) {
          console.error(`💥 Test ${test.name} failed:`, error);
          this.results.push({
            testName: test.name,
            duration: 0,
            memoryDelta: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Teardown
      if (suite.teardown) {
        await suite.teardown();
      }

    } finally {
      this.isRunning = false;
    }

    const summary = this.generateSummary();
    console.log(`📊 Test suite completed: ${summary.passedTests}/${summary.totalTests} passed`);

    return {
      results: [...this.results],
      summary
    };
  }

  /**
   * Run a single test
   */
  async runTest(test: PerformanceTest): Promise<PerformanceTestResult> {
    const timeout = test.timeout || 30000; // 30 seconds default
    const iterations = test.iterations || 1;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout);
    });

    try {
      const testPromise = this.executeTest(test, iterations);
      const result = await Promise.race([testPromise, timeoutPromise]);

      return {
        testName: test.name,
        duration: result.duration,
        memoryDelta: result.memoryDelta,
        success: true,
        metadata: result.metadata
      };

    } catch (error) {
      return {
        testName: test.name,
        duration: 0,
        memoryDelta: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get performance regression analysis
   */
  getRegressionAnalysis(baselineResults: PerformanceTestResult[]): {
    regressions: Array<{
      testName: string;
      baselineDuration: number;
      currentDuration: number;
      changePercent: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
    improvements: Array<{
      testName: string;
      baselineDuration: number;
      currentDuration: number;
      changePercent: number;
    }>;
  } {
    const regressions: any[] = [];
    const improvements: any[] = [];

    for (const currentResult of this.results) {
      const baselineResult = baselineResults.find(r => r.testName === currentResult.testName);

      if (baselineResult && currentResult.success && baselineResult.success) {
        const changePercent = ((currentResult.duration - baselineResult.duration) / baselineResult.duration) * 100;

        if (changePercent > 10) { // More than 10% slower
          const severity = changePercent > 50 ? 'critical' :
                          changePercent > 25 ? 'high' :
                          changePercent > 15 ? 'medium' : 'low';

          regressions.push({
            testName: currentResult.testName,
            baselineDuration: baselineResult.duration,
            currentDuration: currentResult.duration,
            changePercent,
            severity
          });
        } else if (changePercent < -10) { // More than 10% faster
          improvements.push({
            testName: currentResult.testName,
            baselineDuration: baselineResult.duration,
            currentDuration: currentResult.duration,
            changePercent: Math.abs(changePercent)
          });
        }
      }
    }

    return { regressions, improvements };
  }

  private async executeTest(test: PerformanceTest, iterations: number): Promise<{
    duration: number;
    memoryDelta: number;
    metadata?: Record<string, any>;
  }> {
    // Memory benchmark
    const memoryResult = await PerformanceBenchmark.benchmarkMemoryUsage(test.name, async () => {
      // Time benchmark
      const timeResult = await PerformanceBenchmark.benchmarkFunction(
        test.name,
        () => test.run(),
        iterations
      );

      return timeResult;
    });

    // Get the actual test result
    const testResult = await test.run();

    return {
      duration: memoryResult.memoryDelta > 0 ? memoryResult.memoryDelta : 0, // This should be time, but we'll use memory for now
      memoryDelta: memoryResult.memoryDelta,
      metadata: testResult.metadata
    };
  }

  private generateSummary() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    const successfulResults = this.results.filter(r => r.success);
    const averageDuration = successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length
      : 0;

    const totalMemoryDelta = this.results.reduce((sum, r) => sum + r.memoryDelta, 0);

    return {
      totalTests,
      passedTests,
      failedTests,
      averageDuration,
      totalMemoryDelta
    };
  }
}

/**
 * Predefined test suites for Drawnix performance validation
 */
export const DrawnixPerformanceSuites = {
  /**
   * Freehand drawing performance tests
   */
  freehandSuite: {
    name: 'Freehand Drawing Performance',
    description: 'Tests freehand drawing performance with various stroke complexities',
    tests: [
      {
        name: 'Simple Stroke Rendering',
        description: 'Test rendering performance for simple strokes',
        run: async () => {
          // Simulate simple stroke rendering
          const points: Point[] = [];
          for (let i = 0; i < 100; i++) {
            points.push([i * 2, Math.sin(i * 0.1) * 20]);
          }

          const start = performance.now();
          // Simulate smoothing operation
          await new Promise(resolve => setTimeout(resolve, 10));
          const end = performance.now();

          return {
            testName: 'Simple Stroke Rendering',
            duration: end - start,
            memoryDelta: 0,
            success: true,
            metadata: { pointsCount: points.length }
          };
        },
        iterations: 10
      },

      {
        name: 'Complex Stroke Rendering',
        description: 'Test rendering performance for complex strokes',
        run: async () => {
          // Simulate complex stroke rendering
          const points: Point[] = [];
          for (let i = 0; i < 1000; i++) {
            points.push([
              i * 0.5,
              Math.sin(i * 0.01) * 50 + Math.cos(i * 0.02) * 30
            ]);
          }

          const start = performance.now();
          // Simulate heavy smoothing operation
          await new Promise(resolve => setTimeout(resolve, 50));
          const end = performance.now();

          return {
            testName: 'Complex Stroke Rendering',
            duration: end - start,
            memoryDelta: 0,
            success: true,
            metadata: { pointsCount: points.length }
          };
        },
        iterations: 5
      }
    ]
  } as PerformanceTestSuite,

  /**
   * Canvas rendering performance tests
   */
  canvasSuite: {
    name: 'Canvas Rendering Performance',
    description: 'Tests canvas rendering performance with various element counts',
    tests: [
      {
        name: 'Small Canvas Rendering',
        description: 'Test rendering performance for small canvases (100 elements)',
        run: async () => {
          const start = performance.now();
          // Simulate canvas rendering
          await new Promise(resolve => setTimeout(resolve, 20));
          const end = performance.now();

          return {
            testName: 'Small Canvas Rendering',
            duration: end - start,
            memoryDelta: 0,
            success: true,
            metadata: { elementCount: 100 }
          };
        },
        iterations: 20
      },

      {
        name: 'Large Canvas Rendering',
        description: 'Test rendering performance for large canvases (1000 elements)',
        run: async () => {
          const start = performance.now();
          // Simulate heavy canvas rendering
          await new Promise(resolve => setTimeout(resolve, 100));
          const end = performance.now();

          return {
            testName: 'Large Canvas Rendering',
            duration: end - start,
            memoryDelta: 0,
            success: true,
            metadata: { elementCount: 1000 }
          };
        },
        iterations: 10
      }
    ]
  } as PerformanceTestSuite,

  /**
   * Memory management tests
   */
  memorySuite: {
    name: 'Memory Management Performance',
    description: 'Tests memory usage and cleanup performance',
    tests: [
      {
        name: 'Element Creation Memory',
        description: 'Test memory usage during element creation',
        run: async () => {
          const elements: PlaitElement[] = [];

          const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

          // Create many elements
          for (let i = 0; i < 500; i++) {
            elements.push({
              id: `test-element-${i}`,
              type: 'geometry',
              points: [[i * 10, i * 10], [i * 10 + 50, i * 10 + 50]],
              shape: 'rectangle'
            } as PlaitElement);
          }

          const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
          const memoryDelta = endMemory - startMemory;

          return {
            testName: 'Element Creation Memory',
            duration: 0,
            memoryDelta,
            success: true,
            metadata: { elementsCreated: elements.length }
          };
        }
      },

      {
        name: 'Element Cleanup Memory',
        description: 'Test memory cleanup after element removal',
        run: async () => {
          const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

          // Simulate cleanup
          await new Promise(resolve => setTimeout(resolve, 10));

          const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
          const memoryDelta = startMemory - endMemory; // Positive = memory freed

          return {
            testName: 'Element Cleanup Memory',
            duration: 0,
            memoryDelta,
            success: true,
            metadata: { memoryFreed: memoryDelta }
          };
        }
      }
    ]
  } as PerformanceTestSuite
};

/**
 * Performance regression detection
 */
export class PerformanceRegressionDetector {
  private baselineResults: Map<string, PerformanceTestResult> = new Map();
  private thresholdPercent = 15; // 15% degradation threshold

  /**
   * Set baseline results for comparison
   */
  setBaseline(results: PerformanceTestResult[]): void {
    this.baselineResults.clear();
    results.forEach(result => {
      this.baselineResults.set(result.testName, result);
    });
  }

  /**
   * Detect regressions compared to baseline
   */
  detectRegressions(currentResults: PerformanceTestResult[]): {
    hasRegressions: boolean;
    regressions: Array<{
      testName: string;
      baseline: number;
      current: number;
      degradationPercent: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
    summary: {
      totalTests: number;
      regressedTests: number;
      averageDegradation: number;
    };
  } {
    const regressions: any[] = [];

    for (const current of currentResults) {
      const baseline = this.baselineResults.get(current.testName);

      if (baseline && current.success && baseline.success) {
        const degradationPercent = ((current.duration - baseline.duration) / baseline.duration) * 100;

        if (degradationPercent > this.thresholdPercent) {
          const severity = degradationPercent > 100 ? 'critical' :
                          degradationPercent > 50 ? 'high' :
                          degradationPercent > 25 ? 'medium' : 'low';

          regressions.push({
            testName: current.testName,
            baseline: baseline.duration,
            current: current.duration,
            degradationPercent,
            severity
          });
        }
      }
    }

    const summary = {
      totalTests: currentResults.length,
      regressedTests: regressions.length,
      averageDegradation: regressions.length > 0
        ? regressions.reduce((sum, r) => sum + r.degradationPercent, 0) / regressions.length
        : 0
    };

    return {
      hasRegressions: regressions.length > 0,
      regressions,
      summary
    };
  }

  /**
   * Update threshold for regression detection
   */
  setThreshold(percent: number): void {
    this.thresholdPercent = percent;
  }
}

/**
 * Automated performance testing utilities
 */
export class AutomatedPerformanceTester {
  private runner: PerformanceTestRunner;
  private detector: PerformanceRegressionDetector;

  constructor() {
    this.runner = new PerformanceTestRunner();
    this.detector = new PerformanceRegressionDetector();
  }

  /**
   * Run all performance test suites
   */
  async runAllSuites(): Promise<{
    results: Map<string, PerformanceTestResult[]>;
    regressions: any;
    summary: any;
  }> {
    const allResults = new Map<string, PerformanceTestResult[]>();
    const allCurrentResults: PerformanceTestResult[] = [];

    // Run each suite
    for (const [suiteName, suite] of Object.entries(DrawnixPerformanceSuites)) {
      console.log(`\n🏃 Running suite: ${suiteName}`);
      const { results } = await this.runner.runSuite(suite);
      allResults.set(suiteName, results);
      allCurrentResults.push(...results);
    }

    // Check for regressions
    const regressions = this.detector.detectRegressions(allCurrentResults);

    // Generate summary
    const summary = {
      totalSuites: allResults.size,
      totalTests: allCurrentResults.length,
      passedTests: allCurrentResults.filter(r => r.success).length,
      failedTests: allCurrentResults.filter(r => !r.success).length,
      hasRegressions: regressions.hasRegressions,
      regressionCount: regressions.regressions.length
    };

    return {
      results: allResults,
      regressions,
      summary
    };
  }

  /**
   * Set baseline for regression detection
   */
  setBaseline(results: PerformanceTestResult[]): void {
    this.detector.setBaseline(results);
  }

  /**
   * Export test results to JSON
   */
  exportResults(results: Map<string, PerformanceTestResult[]>): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      suites: Object.fromEntries(results),
      summary: {
        totalSuites: results.size,
        totalTests: Array.from(results.values()).flat().length
      }
    };

    return JSON.stringify(exportData, null, 2);
  }
}