// Memory management hook for long-running healthcare applications
import { useEffect, useCallback, useRef } from 'react';

interface MemoryManagerOptions {
  maxCacheSize?: number; // MB
  cleanupInterval?: number; // ms
  enableGC?: boolean;
  logMemoryUsage?: boolean;
}

const DEFAULT_OPTIONS: MemoryManagerOptions = {
  maxCacheSize: 100, // 100MB
  cleanupInterval: 300000, // 5 minutes
  enableGC: true,
  logMemoryUsage: process.env.NODE_ENV === 'development'
};

// Global cache management
const globalCache = new Map();
const eventListeners = new Set();
const timers = new Set();
const observers = new Set();

export const useMemoryManager = (options: MemoryManagerOptions = {}) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const componentCleanup = useRef(new Set());
  const intervalId = useRef<NodeJS.Timeout>();

  // Cleanup function
  const cleanup = useCallback(() => {
    // Clear component-specific resources
    componentCleanup.current.forEach((cleanupFn: any) => {
      try {
        cleanupFn();
      } catch (error) {
        console.warn('Memory manager cleanup error:', error);
      }
    });
    componentCleanup.current.clear();

    // Force garbage collection if available (development only)
    if (config.enableGC && process.env.NODE_ENV === 'development' && (window as any).gc) {
      (window as any).gc();
    }
  }, [config.enableGC]);

  // Memory monitoring
  const monitorMemory = useCallback(() => {
    if (!(performance as any).memory || !config.logMemoryUsage) return;

    const memory = (performance as any).memory;
    const used = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const total = Math.round(memory.totalJSHeapSize / 1024 / 1024);
    const limit = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);

    console.log(`🧠 Memory Usage: ${used}MB / ${total}MB (Limit: ${limit}MB)`);
    console.log(`📊 Cache entries: ${globalCache.size}`);
    console.log(`🎧 Event listeners: ${eventListeners.size}`);
    console.log(`⏰ Active timers: ${timers.size}`);
    console.log(`👁️ Observers: ${observers.size}`);

    // Healthcare-specific memory warnings
    if (used > config.maxCacheSize!) {
      console.warn(`⚕️ High memory usage detected: ${used}MB. Consider clearing patient data cache.`);
      clearExpiredCache();
    }

    // Critical memory warning
    if (used > limit * 0.8) {
      console.error(`🚨 Critical memory usage: ${used}MB (${Math.round(used/limit*100)}% of limit)`);
      console.error('⚕️ Critical: Patient data processing may be impacted. Immediate cleanup required.');
      forceCleanup();
    }
  }, [config.maxCacheSize, config.logMemoryUsage]);

  // Cache management
  const addToCache = useCallback((key: string, value: any, ttl?: number) => {
    const entry = {
      value,
      timestamp: Date.now(),
      ttl: ttl || 300000, // 5 minutes default
      size: new Blob([JSON.stringify(value)]).size
    };
    
    globalCache.set(key, entry);
    
    // Auto-cleanup if cache grows too large
    if (globalCache.size > 1000) {
      clearExpiredCache();
    }
  }, []);

  const getFromCache = useCallback((key: string) => {
    const entry = globalCache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      globalCache.delete(key);
      return null;
    }
    
    return entry.value;
  }, []);

  const clearExpiredCache = useCallback(() => {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, entry] of globalCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        globalCache.delete(key);
        cleared++;
      }
    }
    
    if (config.logMemoryUsage && cleared > 0) {
      console.log(`🧹 Cleared ${cleared} expired cache entries`);
    }
  }, [config.logMemoryUsage]);

  const forceCleanup = useCallback(() => {
    // Clear all cache
    const cacheSize = globalCache.size;
    globalCache.clear();
    
    // Clear global listeners and timers
    eventListeners.forEach((listener: any) => {
      try {
        listener.remove?.() || listener();
      } catch (e) {
        console.warn('Error cleaning up event listener:', e);
      }
    });
    eventListeners.clear();
    
    timers.forEach((timer: any) => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    timers.clear();
    
    observers.forEach((observer: any) => {
      observer.disconnect?.();
    });
    observers.clear();
    
    console.log(`🧹 Force cleanup completed. Cleared ${cacheSize} cache entries.`);
  }, []);

  // Register cleanup function
  const registerCleanup = useCallback((cleanupFn: () => void) => {
    componentCleanup.current.add(cleanupFn);
    
    return () => {
      componentCleanup.current.delete(cleanupFn);
    };
  }, []);

  // Safe event listener registration
  const addEventListenerSafe = useCallback((
    target: EventTarget,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ) => {
    target.addEventListener(event, handler, options);
    
    const cleanupFn = () => {
      target.removeEventListener(event, handler, options);
      eventListeners.delete(cleanupFn);
    };
    
    eventListeners.add(cleanupFn);
    componentCleanup.current.add(cleanupFn);
    
    return cleanupFn;
  }, []);

  // Safe timer functions
  const setTimeoutSafe = useCallback((handler: () => void, timeout?: number) => {
    const id = setTimeout(() => {
      handler();
      timers.delete(id);
    }, timeout);
    
    timers.add(id);
    
    const cleanupFn = () => {
      clearTimeout(id);
      timers.delete(id);
    };
    
    componentCleanup.current.add(cleanupFn);
    return id;
  }, []);

  const setIntervalSafe = useCallback((handler: () => void, timeout?: number) => {
    const id = setInterval(handler, timeout);
    timers.add(id);
    
    const cleanupFn = () => {
      clearInterval(id);
      timers.delete(id);
    };
    
    componentCleanup.current.add(cleanupFn);
    return id;
  }, []);

  // Observer registration
  const registerObserver = useCallback((observer: any) => {
    observers.add(observer);
    
    const cleanupFn = () => {
      observer.disconnect?.();
      observers.delete(observer);
    };
    
    componentCleanup.current.add(cleanupFn);
    return cleanupFn;
  }, []);

  // Healthcare-specific utilities
  const clearPatientDataCache = useCallback(() => {
    const patientKeys = [];
    for (const key of globalCache.keys()) {
      if (key.includes('patient') || key.includes('service-log') || key.includes('submission')) {
        patientKeys.push(key);
      }
    }
    
    patientKeys.forEach(key => globalCache.delete(key));
    
    if (config.logMemoryUsage) {
      console.log(`⚕️ Cleared ${patientKeys.length} patient data cache entries for privacy compliance`);
    }
  }, [config.logMemoryUsage]);

  // Setup periodic monitoring
  useEffect(() => {
    if (config.cleanupInterval && config.cleanupInterval > 0) {
      intervalId.current = setInterval(() => {
        clearExpiredCache();
        monitorMemory();
      }, config.cleanupInterval);
    }

    // Initial memory check
    if (config.logMemoryUsage) {
      setTimeout(monitorMemory, 1000);
    }

    return () => {
      if (intervalId.current) {
        clearInterval(intervalId.current);
      }
    };
  }, [config.cleanupInterval, config.logMemoryUsage, clearExpiredCache, monitorMemory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // Cache management
    addToCache,
    getFromCache,
    clearExpiredCache,
    
    // Memory management
    monitorMemory,
    forceCleanup,
    clearPatientDataCache,
    
    // Safe resource registration
    registerCleanup,
    addEventListenerSafe,
    setTimeoutSafe,
    setIntervalSafe,
    registerObserver,
    
    // Memory stats
    getMemoryStats: () => ({
      cacheSize: globalCache.size,
      eventListeners: eventListeners.size,
      timers: timers.size,
      observers: observers.size,
      memoryUsage: (performance as any).memory ? {
        used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024)
      } : null
    })
  };
};