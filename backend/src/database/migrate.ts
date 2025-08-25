// Database migration script
import { initializeSchema } from './schema';
import { logger } from '@/utils/logger';

async function migrate(): Promise<void> {
  try {
    logger.info('Starting database migration');
    
    // Initialize the database schema
    initializeSchema();
    
    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error });
    process.exit(1);
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
}

export default migrate;