// Database Monitoring API Routes
// Following Express.js patterns from devdocs/express.md
import { Router } from 'express';
import { authenticateToken, adminOnly } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { databaseMonitor, getDatabaseMetrics, getOptimizationRecommendations } from '@/utils/databaseMonitoring';
import { db } from '@/database/connection';
import { migrator } from '@/database/migrate';

const router = Router();

// Get comprehensive database metrics (admin only)
router.get('/metrics', authenticateToken, adminOnly, async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const metrics = await getDatabaseMetrics(forceRefresh);
    
    res.json({
      success: true,
      data: {
        ...metrics,
        timestamp: new Date().toISOString(),
        cached: !forceRefresh
      }
    });
  } catch (error) {
    logger.error('Failed to get database metrics', { error, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'METRICS_ERROR',
        message: 'Failed to retrieve database metrics'
      }
    });
  }
});

// Get optimization recommendations (admin only)
router.get('/recommendations', authenticateToken, adminOnly, async (req, res) => {
  try {
    const recommendations = await getOptimizationRecommendations();
    
    res.json({
      success: true,
      data: {
        recommendations,
        totalCount: recommendations.length,
        highPriority: recommendations.filter(r => r.priority === 'high').length,
        mediumPriority: recommendations.filter(r => r.priority === 'medium').length,
        lowPriority: recommendations.filter(r => r.priority === 'low').length
      }
    });
  } catch (error) {
    logger.error('Failed to get optimization recommendations', { error, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'RECOMMENDATIONS_ERROR',
        message: 'Failed to retrieve optimization recommendations'
      }
    });
  }
});

// Get database health check
router.get('/health', authenticateToken, adminOnly, async (req, res) => {
  try {
    const health = await db.healthCheck();
    const queryMetrics = db.getQueryMetrics();
    
    res.json({
      success: true,
      data: {
        ...health,
        queryMetrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get database health', { error, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Failed to perform database health check'
      }
    });
  }
});

// Run database optimization (admin only)
router.post('/optimize', authenticateToken, adminOnly, async (req, res) => {
  try {
    logger.info('Database optimization requested', { userId: req.user?.id });
    
    const startTime = Date.now();
    await db.optimize();
    const optimizationTime = Date.now() - startTime;
    
    // Clear monitoring cache to get fresh metrics
    databaseMonitor.clearCache();
    
    logger.info('Database optimization completed', { 
      executionTime: optimizationTime,
      userId: req.user?.id 
    });
    
    res.json({
      success: true,
      data: {
        message: 'Database optimization completed successfully',
        executionTime: optimizationTime,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to optimize database', { error, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'OPTIMIZATION_ERROR',
        message: 'Failed to optimize database'
      }
    });
  }
});

// Get migration status (admin only)
router.get('/migrations', authenticateToken, adminOnly, async (req, res) => {
  try {
    const migrationStatus = migrator.getMigrationStatus();
    
    res.json({
      success: true,
      data: {
        migrations: migrationStatus,
        totalMigrations: migrationStatus.length,
        appliedMigrations: migrationStatus.filter(m => m.applied).length,
        pendingMigrations: migrationStatus.filter(m => !m.applied).length
      }
    });
  } catch (error) {
    logger.error('Failed to get migration status', { error, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'MIGRATION_STATUS_ERROR',
        message: 'Failed to retrieve migration status'
      }
    });
  }
});

// Run pending migrations (admin only)
router.post('/migrations/run', authenticateToken, adminOnly, async (req, res) => {
  try {
    logger.info('Database migration requested', { userId: req.user?.id });
    
    const startTime = Date.now();
    await migrator.migrate();
    const migrationTime = Date.now() - startTime;
    
    const finalStatus = migrator.getMigrationStatus();
    const appliedCount = finalStatus.filter(m => m.applied).length;
    
    logger.info('Database migrations completed', { 
      appliedMigrations: appliedCount,
      executionTime: migrationTime,
      userId: req.user?.id 
    });
    
    res.json({
      success: true,
      data: {
        message: 'Database migrations completed successfully',
        appliedMigrations: appliedCount,
        executionTime: migrationTime,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to run migrations', { error, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'MIGRATION_ERROR',
        message: 'Failed to run database migrations'
      }
    });
  }
});

export default router;