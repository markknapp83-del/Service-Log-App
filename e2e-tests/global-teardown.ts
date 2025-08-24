// Global teardown for E2E tests
import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up after E2E tests');
  
  // Add any cleanup logic here if needed
  
  console.log('✅ Global teardown complete');
}

export default globalTeardown;