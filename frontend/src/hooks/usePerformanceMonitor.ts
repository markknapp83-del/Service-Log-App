// Performance monitoring hook for React 18 healthcare applications
import { useEffect, useCallback, useRef } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
  memoryUsage?: number;
  networkRequests?: number;
}

interface PerformanceThresholds {
  renderTime: number; // ms
  memoryUsage: number; // MB
  networkRequests: number;
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  renderTime: 100, // 100ms
  memoryUsage: 50, // 50MB
  networkRequests: 10
};

// Performance data storage
let performanceData: PerformanceMetrics[] = [];
const MAX_METRICS = 1000;

export const usePerformanceMonitor = (
  componentName: string,
  thresholds: Partial<PerformanceThresholds> = {}
) => {
  const renderStartTime = useRef<number>(Date.now());
  const effectiveThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  
  useEffect(() => {
    renderStartTime.current = Date.now();
  });

  useEffect(() => {
    const renderTime = Date.now() - renderStartTime.current;
    
    // Get memory usage if available
    const memoryUsage = (performance as any).memory 
      ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024)
      : undefined;

    const metrics: PerformanceMetrics = {
      renderTime,
      componentName,
      timestamp: Date.now(),
      memoryUsage,
    };

    // Store metrics
    performanceData.push(metrics);
    if (performanceData.length > MAX_METRICS) {
      performanceData = performanceData.slice(-MAX_METRICS);
    }

    // Development warnings
    if (process.env.NODE_ENV === 'development') {
      if (renderTime > effectiveThresholds.renderTime) {
        console.warn(
          `🐌 Slow render detected in ${componentName}: ${renderTime}ms (threshold: ${effectiveThresholds.renderTime}ms)`
        );
      }

      if (memoryUsage && memoryUsage > effectiveThresholds.memoryUsage) {
        console.warn(
          `🧠 High memory usage in ${componentName}: ${memoryUsage}MB (threshold: ${effectiveThresholds.memoryUsage}MB)`
        );
      }
    }
  });

  // Performance measurement utilities
  const measureAsync = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    const start = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - start;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`⏱️ ${operationName} completed in ${duration.toFixed(2)}ms`);
        
        if (duration > 1000) { // 1 second threshold for async operations
          console.warn(`🚨 Slow async operation: ${operationName} (${duration.toFixed(2)}ms)`);
        }
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ ${operationName} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }, []);

  const measureSync = useCallback(<T>(
    operation: () => T,
    operationName: string
  ): T => {
    const start = performance.now();
    
    try {
      const result = operation();
      const duration = performance.now() - start;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`⏱️ ${operationName} completed in ${duration.toFixed(2)}ms`);
        
        if (duration > 16) { // One frame at 60fps
          console.warn(`🚨 Slow sync operation: ${operationName} (${duration.toFixed(2)}ms)`);
        }
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ ${operationName} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }, []);

  return {
    measureAsync,
    measureSync,
  };
};

// Global performance utilities
export const getPerformanceReport = () => {
  const now = Date.now();
  const recentMetrics = performanceData.filter(m => now - m.timestamp < 60000); // Last minute

  const avgRenderTime = recentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / recentMetrics.length;
  const maxRenderTime = Math.max(...recentMetrics.map(m => m.renderTime));
  const slowComponents = recentMetrics.filter(m => m.renderTime > 100);

  return {
    totalMetrics: performanceData.length,
    recentMetrics: recentMetrics.length,
    avgRenderTime: avgRenderTime || 0,
    maxRenderTime: maxRenderTime || 0,
    slowComponents: slowComponents.map(m => ({ 
      name: m.componentName, 
      renderTime: m.renderTime,
      timestamp: m.timestamp
    })),
    memoryUsage: (performance as any).memory 
      ? {
          used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024)
        }
      : null
  };
};

// Core Web Vitals monitoring
export const measureCoreWebVitals = () => {
  if (typeof window === 'undefined') return;

  // Measure First Contentful Paint
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.entryType === 'paint') {
        console.log(`🎨 ${entry.name}: ${entry.startTime.toFixed(2)}ms`);
      }
      
      if (entry.entryType === 'navigation') {
        const navEntry = entry as PerformanceNavigationTiming;
        const loadTime = navEntry.loadEventEnd - navEntry.navigationStart;
        const domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.navigationStart;
        
        console.log(`📄 Page Load Time: ${loadTime.toFixed(2)}ms`);
        console.log(`🏗️ DOM Content Loaded: ${domContentLoaded.toFixed(2)}ms`);
        
        // Healthcare-specific performance targets
        if (loadTime > 2000) {
          console.warn('🚨 Page load time exceeds healthcare target of 2 seconds');
        }
      }
    });
  });

  observer.observe({ entryTypes: ['paint', 'navigation'] });

  // Measure Cumulative Layout Shift
  let clsValue = 0;
  const clsObserver = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
        
        if (clsValue > 0.1) {
          console.warn(`📐 High Cumulative Layout Shift: ${clsValue.toFixed(4)} (target: < 0.1)`);
        }
      }
    });
  });

  clsObserver.observe({ entryTypes: ['layout-shift'] });
};

// Memory leak detection for long-running healthcare sessions
export const detectMemoryLeaks = () => {
  if (process.env.NODE_ENV !== 'development' || !(performance as any).memory) {
    return;
  }

  const initialMemory = (performance as any).memory.usedJSHeapSize;
  let measurements = 0;
  let sustainedIncrease = 0;

  const checkMemory = () => {
    measurements++;
    const currentMemory = (performance as any).memory.usedJSHeapSize;
    const growth = currentMemory - initialMemory;
    const growthMB = growth / 1024 / 1024;

    if (growthMB > 10) { // 10MB increase
      sustainedIncrease++;
    } else {
      sustainedIncrease = 0;
    }

    if (sustainedIncrease >= 5 && measurements > 10) {
      console.warn(`🚨 Potential memory leak detected: ${growthMB.toFixed(2)}MB growth over ${measurements} measurements`);
      
      // Healthcare context warning
      console.warn('⚕️ Memory leaks can impact patient data processing. Consider component cleanup.');
    }

    if (measurements < 100) { // Don't monitor forever
      setTimeout(checkMemory, 10000); // Check every 10 seconds
    }
  };

  // Start monitoring after 30 seconds to allow for initial loading
  setTimeout(checkMemory, 30000);
};