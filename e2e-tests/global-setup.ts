// Global setup for E2E tests
import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Healthcare Portal E2E Test Suite');
  console.log('📋 Configuration:');
  console.log(`   - Base URL: ${config.use?.baseURL}`);
  console.log(`   - Workers: ${config.workers || 'auto'}`);
  console.log(`   - Timeout: ${config.timeout}ms`);
  
  // Wait a moment for servers to fully initialize
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('✅ Global setup complete');
}

export default globalSetup;