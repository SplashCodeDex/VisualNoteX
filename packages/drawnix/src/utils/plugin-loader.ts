/**
 * Plugin Loader - Lazy loading system for Drawnix plugins
 * Provides efficient loading and management of plugins with performance optimization
 */

import { PlaitPlugin } from '@plait/core';

export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  loadPriority?: number;
  estimatedLoadTime?: number;
  memoryUsage?: number;
}

export interface PluginLoadOptions {
  timeout?: number;
  retries?: number;
  preload?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

export interface PluginLoadResult {
  plugin: PlaitPlugin;
  metadata: PluginMetadata;
  loadTime: number;
  memoryUsage: number;
  success: boolean;
  error?: Error;
}

export class PluginLoader {
  private loadedPlugins = new Map<string, PlaitPlugin>();
  private loadingPromises = new Map<string, Promise<PluginLoadResult>>();
  private pluginMetadata = new Map<string, PluginMetadata>();
  private preloadQueue: string[] = [];
  private isPreloading = false;

  constructor() {
    this.initializeCorePlugins();
  }

  /**
   * Load a plugin lazily with performance monitoring
   */
  async loadPlugin(
    pluginName: string,
    options: PluginLoadOptions = {}
  ): Promise<PluginLoadResult> {
    const {
      timeout = 10000,
      retries = 2,
      preload = false,
      priority = 'normal'
    } = options;

    // Check if already loaded
    if (this.loadedPlugins.has(pluginName)) {
      const metadata = this.pluginMetadata.get(pluginName)!;
      return {
        plugin: this.loadedPlugins.get(pluginName)!,
        metadata,
        loadTime: 0,
        memoryUsage: 0,
        success: true
      };
    }

    // Check if currently loading
    if (this.loadingPromises.has(pluginName)) {
      return this.loadingPromises.get(pluginName)!;
    }

    // Start loading process
    const loadPromise = this.performPluginLoad(pluginName, {
      timeout,
      retries,
      preload,
      priority
    });

    this.loadingPromises.set(pluginName, loadPromise);

    try {
      const result = await loadPromise;
      this.loadingPromises.delete(pluginName);

      if (result.success) {
        this.loadedPlugins.set(pluginName, result.plugin);
      }

      return result;
    } catch (error) {
      this.loadingPromises.delete(pluginName);
      throw error;
    }
  }

  /**
   * Load multiple plugins in parallel with dependency resolution
   */
  async loadPlugins(
    pluginNames: string[],
    options: PluginLoadOptions = {}
  ): Promise<PluginLoadResult[]> {
    // Resolve dependencies and create loading order
    const loadOrder = this.resolveDependencies(pluginNames);

    // Load plugins in dependency order
    const results: PluginLoadResult[] = [];

    for (const pluginName of loadOrder) {
      try {
        const result = await this.loadPlugin(pluginName, options);
        results.push(result);
      } catch (error) {
        console.error(`[PluginLoader] Failed to load plugin ${pluginName}:`, error);
        results.push({
          plugin: [] as PlaitPlugin, // Empty plugin array as fallback
          metadata: { name: pluginName, version: '0.0.0' },
          loadTime: 0,
          memoryUsage: 0,
          success: false,
          error: error as Error
        });
      }
    }

    return results;
  }

  /**
   * Preload plugins in the background for better UX
   */
  async preloadPlugins(pluginNames: string[]): Promise<void> {
    if (this.isPreloading) return;

    this.isPreloading = true;
    this.preloadQueue = [...pluginNames];

    try {
      // Load plugins with low priority in background
      await this.loadPlugins(this.preloadQueue, {
        priority: 'low',
        preload: true
      });
    } finally {
      this.isPreloading = false;
      this.preloadQueue = [];
    }
  }

  /**
   * Get plugin loading statistics
   */
  getLoadingStats() {
    return {
      loadedPlugins: Array.from(this.loadedPlugins.keys()),
      loadingPlugins: Array.from(this.loadingPromises.keys()),
      preloadQueue: [...this.preloadQueue],
      totalPlugins: this.pluginMetadata.size
    };
  }

  /**
   * Unload a plugin to free memory
   */
  unloadPlugin(pluginName: string): boolean {
    if (this.loadedPlugins.has(pluginName)) {
      this.loadedPlugins.delete(pluginName);
      console.log(`[PluginLoader] Unloaded plugin: ${pluginName}`);
      return true;
    }
    return false;
  }

  /**
   * Get plugin metadata
   */
  getPluginMetadata(pluginName: string): PluginMetadata | null {
    return this.pluginMetadata.get(pluginName) || null;
  }

  private async performPluginLoad(
    pluginName: string,
    options: Required<PluginLoadOptions>
  ): Promise<PluginLoadResult> {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= options.retries; attempt++) {
      try {
        const plugin = await this.loadPluginModule(pluginName, options.timeout);
        const metadata = this.pluginMetadata.get(pluginName)!;

        const loadTime = performance.now() - startTime;
        const memoryUsage = ((performance as any).memory?.usedJSHeapSize || 0) - startMemory;

        return {
          plugin,
          metadata,
          loadTime,
          memoryUsage,
          success: true
        };

      } catch (error) {
        lastError = error as Error;
        console.warn(`[PluginLoader] Attempt ${attempt + 1} failed for ${pluginName}:`, error);

        if (attempt < options.retries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // All retries failed
    return {
      plugin: [] as PlaitPlugin,
      metadata: { name: pluginName, version: '0.0.0' },
      loadTime: performance.now() - startTime,
      memoryUsage: 0,
      success: false,
      error: lastError || new Error(`Failed to load plugin ${pluginName}`)
    };
  }

  private async loadPluginModule(
    pluginName: string,
    timeout: number
  ): Promise<PlaitPlugin> {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Plugin load timeout: ${pluginName}`)), timeout);
    });

    // Create the actual load promise
    const loadPromise = this.importPlugin(pluginName);

    // Race between loading and timeout
    return Promise.race([loadPromise, timeoutPromise]);
  }

  private async importPlugin(pluginName: string): Promise<PlaitPlugin> {
    // Dynamic imports for lazy loading
    switch (pluginName) {
      case 'freehand':
        const { withOptimizedFreehand } = await import('../plugins/freehand/with-optimized-freehand');
        return withOptimizedFreehand(null!); // Board will be provided when plugin is applied

      case 'mind':
        const { withMind } = await import('@plait/mind');
        return withMind();

      case 'draw':
        const { withDraw } = await import('@plait/draw');
        return withDraw();

      case 'text':
        const { withText } = await import('@plait/text-plugins');
        return withText();

      default:
        throw new Error(`Unknown plugin: ${pluginName}`);
    }
  }

  private resolveDependencies(pluginNames: string[]): string[] {
    const loaded = new Set<string>();
    const result: string[] = [];

    const loadRecursive = (name: string) => {
      if (loaded.has(name)) return;

      const metadata = this.pluginMetadata.get(name);
      if (metadata?.dependencies) {
        metadata.dependencies.forEach(dep => loadRecursive(dep));
      }

      loaded.add(name);
      result.push(name);
    };

    pluginNames.forEach(name => loadRecursive(name));
    return result;
  }

  private initializeCorePlugins(): void {
    // Initialize metadata for core plugins
    this.pluginMetadata.set('freehand', {
      name: 'freehand',
      version: '1.0.0',
      description: 'Freehand drawing plugin with performance optimizations',
      dependencies: ['draw'],
      loadPriority: 1,
      estimatedLoadTime: 50,
      memoryUsage: 200
    });

    this.pluginMetadata.set('mind', {
      name: 'mind',
      version: '1.0.0',
      description: 'Mind mapping plugin',
      dependencies: ['draw'],
      loadPriority: 2,
      estimatedLoadTime: 100,
      memoryUsage: 500
    });

    this.pluginMetadata.set('draw', {
      name: 'draw',
      version: '1.0.0',
      description: 'Core drawing plugin',
      dependencies: [],
      loadPriority: 0,
      estimatedLoadTime: 30,
      memoryUsage: 150
    });

    this.pluginMetadata.set('text', {
      name: 'text',
      version: '1.0.0',
      description: 'Text editing plugin',
      dependencies: ['draw'],
      loadPriority: 1,
      estimatedLoadTime: 40,
      memoryUsage: 100
    });
  }
}

/**
 * React hook for using plugin loader
 */
import { useState, useEffect, useCallback } from 'react';

export function usePluginLoader() {
  const [loader] = useState(() => new PluginLoader());
  const [loadingStates, setLoadingStates] = useState<Map<string, 'loading' | 'loaded' | 'error'>>(new Map());

  const loadPlugin = useCallback(async (
    pluginName: string,
    options?: PluginLoadOptions
  ) => {
    setLoadingStates(prev => new Map(prev.set(pluginName, 'loading')));

    try {
      const result = await loader.loadPlugin(pluginName, options);
      setLoadingStates(prev => new Map(prev.set(pluginName, 'loaded')));
      return result;
    } catch (error) {
      setLoadingStates(prev => new Map(prev.set(pluginName, 'error')));
      throw error;
    }
  }, [loader]);

  const loadPlugins = useCallback(async (
    pluginNames: string[],
    options?: PluginLoadOptions
  ) => {
    const promises = pluginNames.map(name => loadPlugin(name, options));
    return Promise.all(promises);
  }, [loadPlugin]);

  const preloadPlugins = useCallback(async (pluginNames: string[]) => {
    return loader.preloadPlugins(pluginNames);
  }, [loader]);

  const getLoadingStats = useCallback(() => {
    return loader.getLoadingStats();
  }, [loader]);

  return {
    loadPlugin,
    loadPlugins,
    preloadPlugins,
    getLoadingStats,
    loadingStates
  };
}

/**
 * Performance monitoring for plugin loading
 */
export class PluginPerformanceMonitor {
  private static instance: PluginPerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PluginPerformanceMonitor {
    if (!PluginPerformanceMonitor.instance) {
      PluginPerformanceMonitor.instance = new PluginPerformanceMonitor();
    }
    return PluginPerformanceMonitor.instance;
  }

  recordLoadTime(pluginName: string, loadTime: number): void {
    if (!this.metrics.has(pluginName)) {
      this.metrics.set(pluginName, []);
    }
    this.metrics.get(pluginName)!.push(loadTime);

    // Keep only last 10 measurements
    const times = this.metrics.get(pluginName)!;
    if (times.length > 10) {
      times.shift();
    }
  }

  getAverageLoadTime(pluginName: string): number {
    const times = this.metrics.get(pluginName);
    if (!times || times.length === 0) return 0;

    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  getLoadTimeStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [pluginName] of this.metrics) {
      stats[pluginName] = this.getAverageLoadTime(pluginName);
    }
    return stats;
  }
}