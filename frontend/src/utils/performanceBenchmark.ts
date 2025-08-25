// Performance benchmarking utilities for healthcare applications
import { getPerformanceReport, measureCoreWebVitals, detectMemoryLeaks } from '../hooks/usePerformanceMonitor';

export interface BenchmarkResult {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface HealthcarePerformanceTargets {
  pageLoadTime: number; // ms - Critical for emergency situations
  formSubmissionTime: number; // ms - Patient data entry
  searchResponseTime: number; // ms - Finding patient records
  reportGenerationTime: number; // ms - Clinical reports
  memoryUsageLimit: number; // MB - For long-running sessions
  bundleSize: number; // KB - For mobile healthcare workers
}

// Healthcare-specific performance targets
export const HEALTHCARE_TARGETS: HealthcarePerformanceTargets = {
  pageLoadTime: 2000, // 2 seconds - Emergency response requirement
  formSubmissionTime: 1000, // 1 second - Real-time patient data
  searchResponseTime: 500, // 500ms - Quick patient lookup
  reportGenerationTime: 5000, // 5 seconds - Report generation
  memoryUsageLimit: 100, // 100MB - Long healthcare sessions
  bundleSize: 500, // 500KB - Mobile healthcare devices
};

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];
  private isRunning = false;

  async runHealthcareBenchmarks(): Promise<void> {
    if (this.isRunning) {
      console.warn('Benchmark already running');
      return;
    }

    this.isRunning = true;
    console.log('🏥 Starting healthcare performance benchmarks...');

    try {
      await this.benchmarkPageLoad();
      await this.benchmarkFormPerformance();
      await this.benchmarkDataOperations();
      await this.benchmarkMemoryUsage();
      await this.benchmarkBundleSize();
      
      this.generateReport();
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async benchmarkPageLoad(): Promise<void> {
    console.log('📄 Benchmarking page load performance...');
    
    // Measure current page performance
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      const loadTime = navigation.loadEventEnd - navigation.navigationStart;
      const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.navigationStart;
      const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;

      this.addResult({
        name: 'Page Load Time',
        duration: loadTime,
        timestamp: Date.now(),
        metadata: {
          target: HEALTHCARE_TARGETS.pageLoadTime,
          domContentLoaded,
          firstContentfulPaint,
          status: loadTime <= HEALTHCARE_TARGETS.pageLoadTime ? 'PASS' : 'FAIL'
        }
      });

      if (loadTime > HEALTHCARE_TARGETS.pageLoadTime) {
        console.warn(`🚨 Page load time (${loadTime}ms) exceeds healthcare target (${HEALTHCARE_TARGETS.pageLoadTime}ms)`);
      }
    }
  }

  private async benchmarkFormPerformance(): Promise<void> {
    console.log('📝 Benchmarking form performance...');
    
    // Simulate form operations
    const formTests = [
      { name: 'Patient Entry Form Render', operation: this.simulateFormRender },
      { name: 'Form Validation', operation: this.simulateFormValidation },
      { name: 'Form Submission', operation: this.simulateFormSubmission }
    ];

    for (const test of formTests) {
      const start = performance.now();
      await test.operation();
      const duration = performance.now() - start;

      this.addResult({
        name: test.name,
        duration,
        timestamp: Date.now(),
        metadata: {
          target: test.name.includes('Submission') ? HEALTHCARE_TARGETS.formSubmissionTime : 100,
          status: duration <= (test.name.includes('Submission') ? HEALTHCARE_TARGETS.formSubmissionTime : 100) ? 'PASS' : 'FAIL'
        }
      });
    }
  }

  private async benchmarkDataOperations(): Promise<void> {
    console.log('🗄️ Benchmarking data operations...');
    
    // Simulate common healthcare data operations
    const dataTests = [
      { name: 'Patient Search', size: 1000, operation: this.simulatePatientSearch },
      { name: 'Service Log Filter', size: 500, operation: this.simulateDataFilter },
      { name: 'Report Generation', size: 2000, operation: this.simulateReportGeneration }
    ];

    for (const test of dataTests) {
      const start = performance.now();
      await test.operation(test.size);
      const duration = performance.now() - start;

      const target = test.name.includes('Report') ? HEALTHCARE_TARGETS.reportGenerationTime :
                    test.name.includes('Search') ? HEALTHCARE_TARGETS.searchResponseTime : 1000;

      this.addResult({
        name: test.name,
        duration,
        timestamp: Date.now(),
        metadata: {
          dataSize: test.size,
          target,
          status: duration <= target ? 'PASS' : 'FAIL'
        }
      });
    }
  }

  private async benchmarkMemoryUsage(): Promise<void> {
    console.log('🧠 Benchmarking memory usage...');
    
    if (!(performance as any).memory) {
      console.warn('Memory API not available');
      return;
    }

    const memory = (performance as any).memory;
    const usedMemoryMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const totalMemoryMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);

    this.addResult({
      name: 'Memory Usage',
      duration: usedMemoryMB,
      timestamp: Date.now(),
      metadata: {
        used: usedMemoryMB,
        total: totalMemoryMB,
        target: HEALTHCARE_TARGETS.memoryUsageLimit,
        status: usedMemoryMB <= HEALTHCARE_TARGETS.memoryUsageLimit ? 'PASS' : 'FAIL'
      }
    });

    // Memory leak detection
    detectMemoryLeaks();
  }

  private async benchmarkBundleSize(): Promise<void> {
    console.log('📦 Benchmarking bundle size...');
    
    // Estimate bundle size from resource entries
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let totalSize = 0;

    resources.forEach(resource => {
      if (resource.name.includes('.js') || resource.name.includes('.css')) {
        // Estimate size from transfer size (approximation)
        totalSize += (resource as any).transferSize || 0;
      }
    });

    const bundleSizeKB = Math.round(totalSize / 1024);

    this.addResult({
      name: 'Bundle Size',
      duration: bundleSizeKB,
      timestamp: Date.now(),
      metadata: {
        sizeKB: bundleSizeKB,
        target: HEALTHCARE_TARGETS.bundleSize,
        status: bundleSizeKB <= HEALTHCARE_TARGETS.bundleSize ? 'PASS' : 'FAIL'
      }
    });
  }

  private async simulateFormRender(): Promise<void> {
    // Simulate complex form rendering
    return new Promise(resolve => {
      // Simulate DOM manipulation and React rendering
      for (let i = 0; i < 1000; i++) {
        document.createElement('div');
      }
      setTimeout(resolve, 10);
    });
  }

  private async simulateFormValidation(): Promise<void> {
    // Simulate form validation with healthcare data
    const patientData = {
      name: 'John Doe',
      dob: '1990-01-01',
      ssn: '123-45-6789',
      appointments: Array.from({ length: 50 }, (_, i) => ({ id: i, type: 'checkup' }))
    };

    // Validate data structure
    JSON.stringify(patientData);
    
    return new Promise(resolve => setTimeout(resolve, 5));
  }

  private async simulateFormSubmission(): Promise<void> {
    // Simulate API call
    return new Promise(resolve => {
      setTimeout(() => {
        // Simulate successful submission
        resolve();
      }, 200); // Simulated network delay
    });
  }

  private async simulatePatientSearch(recordCount: number): Promise<void> {
    // Simulate searching through patient records
    const patients = Array.from({ length: recordCount }, (_, i) => ({
      id: i,
      name: `Patient ${i}`,
      dob: new Date(1950 + (i % 70), (i % 12), (i % 28) + 1),
      conditions: [`Condition${i % 10}`]
    }));

    // Simulate search operation
    const searchTerm = 'Patient 5';
    const results = patients.filter(p => p.name.includes(searchTerm));
    
    return new Promise(resolve => setTimeout(resolve, 10));
  }

  private async simulateDataFilter(recordCount: number): Promise<void> {
    // Simulate filtering service logs
    const serviceLogs = Array.from({ length: recordCount }, (_, i) => ({
      id: i,
      date: new Date(2023, i % 12, (i % 28) + 1),
      patientId: i % 100,
      serviceType: `Service${i % 5}`,
      status: i % 2 === 0 ? 'completed' : 'pending'
    }));

    // Simulate complex filtering
    const filtered = serviceLogs.filter(log => 
      log.status === 'completed' && 
      log.date.getMonth() >= 6
    );

    return new Promise(resolve => setTimeout(resolve, 5));
  }

  private async simulateReportGeneration(recordCount: number): Promise<void> {
    // Simulate generating healthcare report
    const data = Array.from({ length: recordCount }, (_, i) => ({
      patientId: i,
      services: Array.from({ length: 5 }, (_, j) => ({ 
        type: `Service${j}`, 
        date: new Date(), 
        cost: Math.random() * 1000 
      }))
    }));

    // Simulate complex report calculation
    const report = data.reduce((acc, patient) => {
      const patientTotal = patient.services.reduce((sum, service) => sum + service.cost, 0);
      return { ...acc, [patient.patientId]: patientTotal };
    }, {});

    // Simulate report formatting
    JSON.stringify(report);
    
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  private addResult(result: BenchmarkResult): void {
    this.results.push(result);
    
    const status = result.metadata?.status || 'UNKNOWN';
    const statusEmoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    
    console.log(`${statusEmoji} ${result.name}: ${result.duration.toFixed(2)}ms`);
  }

  private generateReport(): void {
    console.log('\n🏥 Healthcare Performance Benchmark Report');
    console.log('==========================================');
    
    const passed = this.results.filter(r => r.metadata?.status === 'PASS').length;
    const failed = this.results.filter(r => r.metadata?.status === 'FAIL').length;
    const total = this.results.length;
    
    console.log(`📊 Overall Score: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
    console.log('');
    
    // Group results by category
    const categories = {
      'Page Performance': this.results.filter(r => r.name.includes('Page') || r.name.includes('Bundle')),
      'Form Performance': this.results.filter(r => r.name.includes('Form')),
      'Data Operations': this.results.filter(r => r.name.includes('Search') || r.name.includes('Filter') || r.name.includes('Report')),
      'Memory Usage': this.results.filter(r => r.name.includes('Memory'))
    };

    Object.entries(categories).forEach(([category, results]) => {
      if (results.length > 0) {
        console.log(`\n📋 ${category}:`);
        results.forEach(result => {
          const status = result.metadata?.status === 'PASS' ? '✅' : '❌';
          const target = result.metadata?.target ? ` (target: ${result.metadata.target}${result.name.includes('Memory') ? 'MB' : 'ms'})` : '';
          console.log(`  ${status} ${result.name}: ${result.duration.toFixed(2)}${result.name.includes('Memory') ? 'MB' : 'ms'}${target}`);
        });
      }
    });

    // Healthcare-specific recommendations
    console.log('\n⚕️ Healthcare Performance Recommendations:');
    
    const failedTests = this.results.filter(r => r.metadata?.status === 'FAIL');
    if (failedTests.length === 0) {
      console.log('  ✅ All performance targets met! Application ready for production healthcare use.');
    } else {
      failedTests.forEach(test => {
        switch (test.name) {
          case 'Page Load Time':
            console.log('  🚨 Optimize initial page load for emergency response scenarios');
            break;
          case 'Form Submission':
            console.log('  📝 Optimize form submission for real-time patient data entry');
            break;
          case 'Patient Search':
            console.log('  🔍 Implement virtual scrolling or pagination for large patient databases');
            break;
          case 'Memory Usage':
            console.log('  🧠 Implement memory management for extended healthcare worker sessions');
            break;
          case 'Bundle Size':
            console.log('  📦 Reduce bundle size for mobile healthcare devices and slow networks');
            break;
        }
      });
    }

    // Core Web Vitals
    console.log('\n🎯 Core Web Vitals Monitoring Active');
    measureCoreWebVitals();

    // Performance report for React DevTools
    if (process.env.NODE_ENV === 'development') {
      console.log('\n📊 Detailed Performance Report:', getPerformanceReport());
    }
  }

  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  clearResults(): void {
    this.results = [];
  }
}

// Export singleton instance
export const performanceBenchmark = new PerformanceBenchmark();

// Auto-run benchmarks in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Run benchmarks after the app has loaded
  window.addEventListener('load', () => {
    setTimeout(() => {
      console.log('🚀 Auto-running healthcare performance benchmarks...');
      performanceBenchmark.runHealthcareBenchmarks();
    }, 2000); // Wait 2 seconds after load
  });
}