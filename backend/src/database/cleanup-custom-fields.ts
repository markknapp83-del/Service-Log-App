/**
 * Phase 7.1: Database Cleanup Migration
 * 
 * Removes over-engineered custom field infrastructure that is causing performance issues
 * Following TDD approach - tests should pass after this migration
 */

import { db } from './connection';
import { logger } from '@/utils/logger';

export function removeCustomFieldInfrastructure(): void {
  logger.info('Phase 7.1: Starting custom field infrastructure cleanup');

  try {
    // Step 1: Remove custom field tables in reverse order (respecting foreign keys)
    logger.info('Removing custom field tables...');
    
    db.exec(`DROP TABLE IF EXISTS custom_field_values`);
    logger.info('✓ Dropped custom_field_values table');
    
    db.exec(`DROP TABLE IF EXISTS field_choices`);
    logger.info('✓ Dropped field_choices table');
    
    db.exec(`DROP TABLE IF EXISTS custom_fields`);
    logger.info('✓ Dropped custom_fields table');

    // Step 2: All related indexes are automatically dropped with tables
    // No need to manually drop custom field indexes

    // Step 3: Optimize remaining indexes for core functionality
    logger.info('Optimizing core indexes...');
    
    // Ensure core performance indexes exist and are optimal
    db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_name_active ON clients(name, is_active)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_name_active ON activities(name, is_active)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_outcomes_name_active ON outcomes(name, is_active)`);
    
    logger.info('✓ Core indexes optimized');

    // Step 4: Run VACUUM to reclaim space from dropped tables
    logger.info('Reclaiming database space...');
    db.exec(`VACUUM`);
    logger.info('✓ Database space reclaimed');

    // Step 5: Update database statistics for optimal query planning
    db.exec(`ANALYZE`);
    logger.info('✓ Database statistics updated');

    logger.info('🎉 Phase 7.1 database cleanup completed successfully');
    
    // Log the final table count
    const tableCount = db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).get() as { count: number };
    
    logger.info(`Database now has ${tableCount.count} core tables (custom field tables removed)`);

  } catch (error) {
    logger.error('Failed to complete database cleanup', { error });
    throw error;
  }
}

export function verifyCustomFieldRemoval(): { 
  tablesRemoved: boolean; 
  coreTablesIntact: boolean; 
  indexCount: number 
} {
  // Verify custom field tables are gone
  const customTables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND (
      name = 'custom_fields' OR 
      name = 'field_choices' OR 
      name = 'custom_field_values'
    )
  `).all();

  // Verify core tables remain
  const coreTables = ['users', 'clients', 'activities', 'outcomes', 'service_logs', 'patient_entries', 'audit_log'];
  const existingCoreTables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name IN (${coreTables.map(() => '?').join(',')})
  `).all(...coreTables);

  // Count remaining indexes
  const indexCount = db.prepare(`
    SELECT COUNT(*) as count FROM sqlite_master 
    WHERE type='index' AND name NOT LIKE 'sqlite_%'
  `).get() as { count: number };

  return {
    tablesRemoved: customTables.length === 0,
    coreTablesIntact: existingCoreTables.length === coreTables.length,
    indexCount: indexCount.count
  };
}