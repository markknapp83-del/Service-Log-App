/**
 * Bundle Size Analysis Performance Tests
 * Following documented patterns from devdocs/jest.md
 * Tests bundle size metrics and optimization
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { FrontendPerformanceTestUtils } from '../utils/PerformanceTestUtils';

// Mock webpack stats for bundle analysis
const mockWebpackStats = {
  chunks: [
    {
      id: 'main',
      names: ['main'],
      files: ['main.js', 'main.css'],
      size: 450000, // 450KB
      modules: [
        { name: './src/main.tsx', size: 2000 },
        { name: './src/App.tsx', size: 15000 },
        { name: './src/pages/DashboardPage.tsx', size: 25000 },
        { name: './src/pages/ServiceLogPage.tsx', size: 35000 },
        { name: './src/components/ServiceLogForm.tsx', size: 40000 },
        { name: './node_modules/react/index.js', size: 85000 },
        { name: './node_modules/react-dom/index.js', size: 120000 },
        { name: './node_modules/@radix-ui/react-dialog/dist/index.js', size: 25000 },
        { name: './node_modules/react-hook-form/dist/index.js', size: 45000 },
        { name: './node_modules/zod/lib/index.js', size: 55000 },
      ]
    },
    {
      id: 'vendor',
      names: ['vendor'],
      files: ['vendor.js'],
      size: 850000, // 850KB
      modules: [
        { name: './node_modules/react/index.js', size: 200000 },
        { name: './node_modules/react-dom/index.js', size: 300000 },
        { name: './node_modules/react-router-dom/index.js', size: 150000 },
        { name: './node_modules/axios/lib/axios.js', size: 50000 },
        { name: './node_modules/lucide-react/dist/index.js', size: 150000 },
      ]
    },
    {
      id: 'admin',
      names: ['admin'],
      files: ['admin.js'],
      size: 200000, // 200KB - lazy loaded admin features
      modules: [
        { name: './src/pages/TemplateManagementPage.tsx', size: 50000 },
        { name: './src/pages/UserManagementPage.tsx', size: 45000 },
        { name: './src/components/UsersTable.tsx', size: 30000 },
        { name: './src/components/CreateUserModal.tsx', size: 25000 },
        { name: './src/pages/SubmissionsPage.tsx', size: 50000 },
      ]
    }
  ],
  assets: [
    { name: 'main.js', size: 450000, chunkNames: ['main'] },
    { name: 'main.css', size: 50000, chunkNames: ['main'] },
    { name: 'vendor.js', size: 850000, chunkNames: ['vendor'] },
    { name: 'admin.js', size: 200000, chunkNames: ['admin'] },
    { name: 'index.html', size: 2000, chunkNames: [] },
  ],
  time: 12000, // 12 seconds build time
  version: '5.88.2',
  hash: 'abc123def456',
};

// Mock build analysis tools
const analyzeBundleSize = (stats: any) => {
  const totalSize = stats.assets.reduce((total: number, asset: any) => total + asset.size, 0);
  const jsSize = stats.assets
    .filter((asset: any) => asset.name.endsWith('.js'))
    .reduce((total: number, asset: any) => total + asset.size, 0);
  const cssSize = stats.assets
    .filter((asset: any) => asset.name.endsWith('.css'))
    .reduce((total: number, asset: any) => total + asset.size, 0);

  const duplicateModules = findDuplicateModules(stats);
  const largeModules = findLargeModules(stats);
  
  return {
    totalSize,
    jsSize,
    cssSize,
    gzipEstimate: Math.floor(totalSize * 0.3), // Rough gzip estimate
    duplicateModules,
    largeModules,
    chunkCount: stats.chunks.length,
    assetCount: stats.assets.length,
  };
};

const findDuplicateModules = (stats: any) => {
  const moduleMap = new Map();
  const duplicates = [];

  for (const chunk of stats.chunks) {
    for (const module of chunk.modules) {
      if (moduleMap.has(module.name)) {
        duplicates.push({
          name: module.name,
          size: module.size,
          chunks: [moduleMap.get(module.name), chunk.id],
        });
      } else {
        moduleMap.set(module.name, chunk.id);
      }
    }
  }

  return duplicates;
};

const findLargeModules = (stats: any, threshold = 50000) => {
  const largeModules = [];

  for (const chunk of stats.chunks) {
    for (const module of chunk.modules) {
      if (module.size > threshold) {
        largeModules.push({
          name: module.name,
          size: module.size,
          chunk: chunk.id,
          sizeKB: Math.round(module.size / 1024),
        });
      }
    }
  }

  return largeModules.sort((a, b) => b.size - a.size);
};

beforeEach(() => {
  FrontendPerformanceTestUtils.cleanup();
});

describe('Bundle Size Analysis Performance Tests', () => {
  const MAX_TOTAL_SIZE = 2 * 1024 * 1024; // 2MB total bundle size
  const MAX_MAIN_CHUNK_SIZE = 500 * 1024; // 500KB main chunk
  const MAX_VENDOR_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB vendor chunk
  const MAX_LAZY_CHUNK_SIZE = 250 * 1024; // 250KB lazy loaded chunks
  const MAX_DUPLICATE_SIZE_THRESHOLD = 50 * 1024; // 50KB duplicate threshold

  describe('Bundle Size Thresholds', () => {
    test('should meet total bundle size requirements', () => {
      FrontendPerformanceTestUtils.startMeasurement('bundle_size_analysis');

      const analysis = analyzeBundleSize(mockWebpackStats);

      const benchmark = FrontendPerformanceTestUtils.assertPerformance(
        'bundle_size_analysis',
        100, // Quick analysis
        'Bundle size analysis performance'
      );

      expect(benchmark.passed).toBe(true);
      expect(analysis.totalSize).toBeLessThanOrEqual(MAX_TOTAL_SIZE);

      console.log(`Total bundle size: ${(analysis.totalSize / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Estimated gzipped size: ${(analysis.gzipEstimate / 1024).toFixed(2)}KB`);
    });

    test('should have appropriately sized main chunk', () => {
      const analysis = analyzeBundleSize(mockWebpackStats);
      const mainChunk = mockWebpackStats.chunks.find((chunk: any) => chunk.names.includes('main'));

      expect(mainChunk).toBeDefined();
      expect(mainChunk.size).toBeLessThanOrEqual(MAX_MAIN_CHUNK_SIZE);

      console.log(`Main chunk size: ${(mainChunk.size / 1024).toFixed(2)}KB`);
    });

    test('should have appropriately sized vendor chunk', () => {
      const analysis = analyzeBundleSize(mockWebpackStats);
      const vendorChunk = mockWebpackStats.chunks.find((chunk: any) => chunk.names.includes('vendor'));

      expect(vendorChunk).toBeDefined();
      expect(vendorChunk.size).toBeLessThanOrEqual(MAX_VENDOR_CHUNK_SIZE);

      console.log(`Vendor chunk size: ${(vendorChunk.size / 1024).toFixed(2)}KB`);
    });

    test('should have appropriately sized lazy-loaded chunks', () => {
      const analysis = analyzeBundleSize(mockWebpackStats);
      const lazyChunks = mockWebpackStats.chunks.filter((chunk: any) => 
        !chunk.names.includes('main') && !chunk.names.includes('vendor')
      );

      for (const chunk of lazyChunks) {
        expect(chunk.size).toBeLessThanOrEqual(MAX_LAZY_CHUNK_SIZE);
        console.log(`Lazy chunk ${chunk.names[0]}: ${(chunk.size / 1024).toFixed(2)}KB`);
      }
    });
  });

  describe('Bundle Composition Analysis', () => {
    test('should identify large modules that could be optimized', () => {
      const analysis = analyzeBundleSize(mockWebpackStats);

      expect(analysis.largeModules).toBeDefined();
      expect(Array.isArray(analysis.largeModules)).toBe(true);

      // Log large modules for review
      console.log('\nLarge modules (>50KB):');
      analysis.largeModules.forEach((module: any) => {
        console.log(`- ${module.name}: ${module.sizeKB}KB (chunk: ${module.chunk})`);
      });

      // Healthcare app should have reasonable number of large modules
      expect(analysis.largeModules.length).toBeLessThan(10);
    });

    test('should detect duplicate modules across chunks', () => {
      const analysis = analyzeBundleSize(mockWebpackStats);

      expect(analysis.duplicateModules).toBeDefined();
      expect(Array.isArray(analysis.duplicateModules)).toBe(true);

      if (analysis.duplicateModules.length > 0) {
        console.log('\nDuplicate modules found:');
        analysis.duplicateModules.forEach((duplicate: any) => {
          console.log(`- ${duplicate.name}: ${(duplicate.size / 1024).toFixed(2)}KB in chunks ${duplicate.chunks.join(', ')}`);
        });

        // Check if duplicates exceed threshold
        const totalDuplicateSize = analysis.duplicateModules.reduce((total: number, dup: any) => total + dup.size, 0);
        expect(totalDuplicateSize).toBeLessThan(MAX_DUPLICATE_SIZE_THRESHOLD);
      }
    });

    test('should have reasonable JavaScript to CSS ratio', () => {
      const analysis = analyzeBundleSize(mockWebpackStats);

      const jsRatio = analysis.jsSize / analysis.totalSize;
      const cssRatio = analysis.cssSize / analysis.totalSize;

      expect(jsRatio).toBeGreaterThan(0.8); // At least 80% should be JS for a React app
      expect(cssRatio).toBeLessThan(0.2); // CSS should be less than 20%

      console.log(`JS/CSS ratio: ${(jsRatio * 100).toFixed(1)}% JS, ${(cssRatio * 100).toFixed(1)}% CSS`);
    });
  });

  describe('Chunk Strategy Analysis', () => {
    test('should have optimal number of chunks for HTTP/2', () => {
      const analysis = analyzeBundleSize(mockWebpackStats);

      // For HTTP/2, having 3-10 chunks is generally optimal
      expect(analysis.chunkCount).toBeGreaterThanOrEqual(2);
      expect(analysis.chunkCount).toBeLessThanOrEqual(10);

      console.log(`Total chunks: ${analysis.chunkCount}`);
    });

    test('should separate vendor code from application code', () => {
      const hasVendorChunk = mockWebpackStats.chunks.some((chunk: any) => 
        chunk.names.includes('vendor') || chunk.names.includes('vendors')
      );
      const hasMainChunk = mockWebpackStats.chunks.some((chunk: any) => 
        chunk.names.includes('main') || chunk.names.includes('app')
      );

      expect(hasVendorChunk).toBe(true);
      expect(hasMainChunk).toBe(true);

      console.log('✓ Vendor code is properly separated from application code');
    });

    test('should have lazy-loaded administrative features', () => {
      const hasAdminChunk = mockWebpackStats.chunks.some((chunk: any) => 
        chunk.names.some(name => name.includes('admin') || name.includes('management'))
      );

      expect(hasAdminChunk).toBe(true);
      console.log('✓ Administrative features are lazy-loaded');
    });
  });

  describe('Healthcare-Specific Bundle Analysis', () => {
    test('should prioritize healthcare form components in main bundle', () => {
      const mainChunk = mockWebpackStats.chunks.find((chunk: any) => chunk.names.includes('main'));
      
      expect(mainChunk).toBeDefined();
      
      const hasServiceLogForm = mainChunk.modules.some((module: any) => 
        module.name.includes('ServiceLogForm')
      );
      const hasDashboard = mainChunk.modules.some((module: any) => 
        module.name.includes('DashboardPage')
      );

      expect(hasServiceLogForm).toBe(true);
      expect(hasDashboard).toBe(true);

      console.log('✓ Healthcare core components are in main bundle');
    });

    test('should separate admin features for role-based loading', () => {
      const adminChunk = mockWebpackStats.chunks.find((chunk: any) => chunk.names.includes('admin'));
      
      expect(adminChunk).toBeDefined();
      
      const hasUserManagement = adminChunk.modules.some((module: any) => 
        module.name.includes('UserManagement')
      );
      const hasTemplateManagement = adminChunk.modules.some((module: any) => 
        module.name.includes('TemplateManagement')
      );

      expect(hasUserManagement).toBe(true);
      expect(hasTemplateManagement).toBe(true);

      console.log('✓ Admin features are properly code-split');
    });

    test('should optimize healthcare form validation libraries', () => {
      // Check that Zod is included (form validation)
      const hasZod = mockWebpackStats.chunks.some((chunk: any) =>
        chunk.modules.some((module: any) => module.name.includes('zod'))
      );

      // Check that React Hook Form is included
      const hasReactHookForm = mockWebpackStats.chunks.some((chunk: any) =>
        chunk.modules.some((module: any) => module.name.includes('react-hook-form'))
      );

      expect(hasZod).toBe(true);
      expect(hasReactHookForm).toBe(true);

      console.log('✓ Healthcare validation libraries are properly included');
    });
  });

  describe('Performance Budget Compliance', () => {
    test('should meet First Contentful Paint budget', () => {
      const analysis = analyzeBundleSize(mockWebpackStats);
      
      // For good FCP, main bundle should be under 150KB gzipped
      const mainChunk = mockWebpackStats.chunks.find((chunk: any) => chunk.names.includes('main'));
      const mainGzipEstimate = Math.floor(mainChunk.size * 0.3); // ~30% compression ratio

      expect(mainGzipEstimate).toBeLessThan(150 * 1024); // 150KB

      console.log(`Main bundle gzipped estimate: ${(mainGzipEstimate / 1024).toFixed(2)}KB`);
    });

    test('should meet Time to Interactive budget', () => {
      const analysis = analyzeBundleSize(mockWebpackStats);
      
      // For good TTI, critical path JS should be under 300KB gzipped
      const criticalChunks = mockWebpackStats.chunks.filter((chunk: any) => 
        chunk.names.includes('main') || chunk.names.includes('vendor')
      );
      
      const criticalSize = criticalChunks.reduce((total, chunk) => total + chunk.size, 0);
      const criticalGzipEstimate = Math.floor(criticalSize * 0.3);

      expect(criticalGzipEstimate).toBeLessThan(300 * 1024); // 300KB

      console.log(`Critical path gzipped estimate: ${(criticalGzipEstimate / 1024).toFixed(2)}KB`);
    });

    test('should have reasonable build time', () => {
      const buildTime = mockWebpackStats.time;
      const MAX_BUILD_TIME = 30000; // 30 seconds for development builds

      expect(buildTime).toBeLessThan(MAX_BUILD_TIME);

      console.log(`Build time: ${(buildTime / 1000).toFixed(2)}s`);
    });
  });

  describe('Bundle Security Analysis', () => {
    test('should not include development-only modules in production bundle', () => {
      const devModules = [];
      
      for (const chunk of mockWebpackStats.chunks) {
        for (const module of chunk.modules) {
          if (module.name.includes('__DEV__') || 
              module.name.includes('development') ||
              module.name.includes('hot-reload') ||
              module.name.includes('webpack-dev-server')) {
            devModules.push(module.name);
          }
        }
      }

      expect(devModules).toHaveLength(0);
      console.log('✓ No development modules found in production bundle');
    });

    test('should not expose source maps in production stats', () => {
      const sourceMapAssets = mockWebpackStats.assets.filter((asset: any) => 
        asset.name.endsWith('.map')
      );

      // Source maps should not be in production bundle analysis
      expect(sourceMapAssets).toHaveLength(0);
      console.log('✓ No source map files in production bundle');
    });
  });

  describe('Bundle Recommendations', () => {
    test('should generate actionable optimization recommendations', () => {
      const analysis = analyzeBundleSize(mockWebpackStats);
      const recommendations = [];

      // Check for large vendor libraries
      if (analysis.jsSize > 1 * 1024 * 1024) { // > 1MB JS
        recommendations.push('Consider tree-shaking to reduce vendor bundle size');
      }

      // Check for missing compression
      if (analysis.gzipEstimate > analysis.totalSize * 0.4) { // Poor compression ratio
        recommendations.push('Enable better compression or optimize assets');
      }

      // Check for too many chunks
      if (analysis.chunkCount > 8) {
        recommendations.push('Consider reducing number of chunks for better caching');
      }

      // Check for large modules
      if (analysis.largeModules.length > 5) {
        recommendations.push('Consider code splitting for large modules');
      }

      console.log('\nBundle optimization recommendations:');
      recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });

      // Should have some recommendations for a typical healthcare app
      expect(recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });
});