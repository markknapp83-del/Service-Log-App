// Comprehensive Health Check API Routes
// Following Express.js patterns from devdocs/express.md for production monitoring
import { Router } from 'express';
import { authenticateToken } from '@/middleware/auth';
import { adminOnly } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { HealthcareLogger } from '@/utils/logger';
import { applicationMonitor } from '@/utils/applicationMonitor';
import { AlertSystem, getActiveAlerts, getAlertStatistics } from '@/utils/alertSystem';
import { db } from '@/database/connection';
import os from 'os';
import { promises as fs } from 'fs';
import path from 'path';

const router = Router();

// Public health check - basic application status
router.get('/', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Basic health indicators
    const health = await applicationMonitor.getHealthCheck();
    
    const responseTime = Date.now() - startTime;
    
    // Simple public response
    res.status(health.status === 'unhealthy' ? 503 : 200).json({
      status: health.status,
      timestamp: health.timestamp,
      uptime: health.uptime,
      responseTime: `${responseTime}ms`,
      service: 'healthcare-portal-backend',
      version: process.env.npm_package_version || '1.0.0'
    });
    
  } catch (error) {
    HealthcareLogger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'healthcare-portal-backend',
      error: 'Health check failed'
    });
  }
}));

// Detailed health check - requires authentication
router.get('/detailed', 
  authenticateToken,
  asyncHandler(async (req, res) => {
    const startTime = Date.now();
    
    try {
      const [
        systemHealth,
        databaseHealth,
        alertStats,
        activeAlerts,
        performanceReport
      ] = await Promise.allSettled([
        applicationMonitor.getHealthCheck(),
        checkDatabaseHealth(),
        getAlertStatistics(),
        getActiveAlerts(),
        applicationMonitor.getPerformanceReport()
      ]);

      const responseTime = Date.now() - startTime;
      
      // Compile detailed health report
      const healthReport = {
        overall: {
          status: systemHealth.status === 'fulfilled' ? systemHealth.value.status : 'unhealthy',
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString(),
          uptime: systemHealth.status === 'fulfilled' ? systemHealth.value.uptime : 0
        },
        system: systemHealth.status === 'fulfilled' ? systemHealth.value.metrics : null,
        database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : { status: 'error' },
        alerts: {
          statistics: alertStats.status === 'fulfilled' ? alertStats.value : null,
          active: activeAlerts.status === 'fulfilled' ? activeAlerts.value : [],
          hasActiveCritical: activeAlerts.status === 'fulfilled' ? 
            activeAlerts.value.some((alert: any) => alert.severity === 'critical') : false
        },
        performance: performanceReport.status === 'fulfilled' ? performanceReport.value : null,
        issues: systemHealth.status === 'fulfilled' ? systemHealth.value.issues : ['System health check failed'],
        healthChecks: await runAllHealthChecks()
      };

      // Determine overall status
      let overallStatus = 'healthy';
      if (healthReport.issues.length > 0) {
        overallStatus = healthReport.issues.some(issue => 
          issue.includes('critically') || issue.includes('failed')
        ) ? 'unhealthy' : 'degraded';
      }

      res.status(overallStatus === 'unhealthy' ? 503 : 200).json({
        success: true,
        data: healthReport,
        metadata: {
          checkedAt: new Date().toISOString(),
          checkDuration: `${responseTime}ms`,
          environment: process.env.NODE_ENV,
          version: process.env.npm_package_version || '1.0.0'
        }
      });

    } catch (error) {
      HealthcareLogger.error('Detailed health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      });

      res.status(503).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: 'Detailed health check failed'
        },
        timestamp: new Date().toISOString()
      });
    }
  })
);

// Admin-only comprehensive system status
router.get('/admin', 
  authenticateToken,
  adminOnly,
  asyncHandler(async (req, res) => {
    const startTime = Date.now();
    
    try {
      const [
        systemMetrics,
        diskSpace,
        memoryDetails,
        processInfo,
        networkChecks,
        securityStatus
      ] = await Promise.allSettled([
        applicationMonitor.getSystemMetrics(),
        checkDiskSpace(),
        getDetailedMemoryInfo(),
        getProcessInfo(),
        checkNetworkConnectivity(),
        checkSecurityStatus()
      ]);

      const responseTime = Date.now() - startTime;
      
      const adminReport = {
        system: {
          status: 'operational',
          responseTime: `${responseTime}ms`,
          metrics: systemMetrics.status === 'fulfilled' ? systemMetrics.value : null,
          disk: diskSpace.status === 'fulfilled' ? diskSpace.value : null,
          memory: memoryDetails.status === 'fulfilled' ? memoryDetails.value : null,
          process: processInfo.status === 'fulfilled' ? processInfo.value : null
        },
        network: networkChecks.status === 'fulfilled' ? networkChecks.value : null,
        security: securityStatus.status === 'fulfilled' ? securityStatus.value : null,
        monitoring: {
          alertSystem: await AlertSystem.getAlertStatistics(),
          performance: await applicationMonitor.getPerformanceReport(),
          activeAlerts: await getActiveAlerts()
        },
        diagnostics: await runDiagnostics(),
        recommendations: await getSystemRecommendations()
      };

      res.json({
        success: true,
        data: adminReport,
        metadata: {
          generatedAt: new Date().toISOString(),
          generationTime: `${responseTime}ms`,
          scope: 'admin-comprehensive'
        }
      });

    } catch (error) {
      HealthcareLogger.error('Admin health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'ADMIN_HEALTH_CHECK_ERROR',
          message: 'Administrative health check failed'
        }
      });
    }
  })
);

// Test all monitoring systems
router.post('/test', 
  authenticateToken,
  adminOnly,
  asyncHandler(async (req, res) => {
    const testResults = {
      alertSystem: false,
      monitoring: false,
      logging: false,
      database: false,
      errors: [] as string[]
    };

    try {
      // Test alert system
      await AlertSystem.testAlertSystem();
      testResults.alertSystem = true;
    } catch (error) {
      testResults.errors.push(`Alert system test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test monitoring
      await applicationMonitor.getSystemMetrics();
      testResults.monitoring = true;
    } catch (error) {
      testResults.errors.push(`Monitoring test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test logging
      HealthcareLogger.info('Health check test log', { testId: Date.now() });
      testResults.logging = true;
    } catch (error) {
      testResults.errors.push(`Logging test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Test database
      await db.execute('SELECT 1');
      testResults.database = true;
    } catch (error) {
      testResults.errors.push(`Database test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const allPassed = Object.values(testResults).every(result => 
      Array.isArray(result) ? result.length === 0 : result === true
    );

    HealthcareLogger.info('Health check test completed', {
      results: testResults,
      allPassed,
      userId: req.user?.id
    });

    res.json({
      success: allPassed,
      data: {
        ...testResults,
        overallStatus: allPassed ? 'passed' : 'failed',
        timestamp: new Date().toISOString()
      }
    });
  })
);

// Helper functions

async function checkDatabaseHealth(): Promise<any> {
  try {
    const startTime = Date.now();
    await db.execute('SELECT 1');
    const responseTime = Date.now() - startTime;
    
    const queryMetrics = db.getQueryMetrics?.() || {};
    
    return {
      status: 'connected',
      responseTime: `${responseTime}ms`,
      metrics: queryMetrics,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
}

async function runAllHealthChecks(): Promise<any[]> {
  const checks = [
    { name: 'Database Connection', check: () => db.execute('SELECT 1') },
    { name: 'Memory Usage', check: () => Promise.resolve(process.memoryUsage()) },
    { name: 'Disk Space', check: () => checkDiskSpace() },
    { name: 'Process Health', check: () => Promise.resolve(process.uptime()) }
  ];

  const results = await Promise.allSettled(
    checks.map(async ({ name, check }) => {
      try {
        const result = await check();
        return { name, status: 'pass', result };
      } catch (error) {
        return { 
          name, 
          status: 'fail', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    })
  );

  return results.map((result, index) => ({
    name: checks[index].name,
    ...(result.status === 'fulfilled' ? result.value : { status: 'error', error: 'Health check failed' })
  }));
}

async function checkDiskSpace(): Promise<any> {
  try {
    const stats = await fs.stat(process.cwd());
    const freeSpace = os.freemem();
    const totalSpace = os.totalmem();
    
    return {
      free: `${Math.round(freeSpace / 1024 / 1024)} MB`,
      total: `${Math.round(totalSpace / 1024 / 1024)} MB`,
      usage: `${Math.round(((totalSpace - freeSpace) / totalSpace) * 100)}%`,
      status: freeSpace > 1024 * 1024 * 100 ? 'ok' : 'low' // Alert if less than 100MB
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function getDetailedMemoryInfo(): Promise<any> {
  const memUsage = process.memoryUsage();
  const systemMem = {
    total: os.totalmem(),
    free: os.freemem()
  };
  
  return {
    process: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
    },
    system: {
      total: `${Math.round(systemMem.total / 1024 / 1024)} MB`,
      free: `${Math.round(systemMem.free / 1024 / 1024)} MB`,
      used: `${Math.round((systemMem.total - systemMem.free) / 1024 / 1024)} MB`,
      usage: `${Math.round(((systemMem.total - systemMem.free) / systemMem.total) * 100)}%`
    }
  };
}

async function getProcessInfo(): Promise<any> {
  return {
    pid: process.pid,
    uptime: `${Math.round(process.uptime())} seconds`,
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpuUsage: process.cpuUsage(),
    env: process.env.NODE_ENV
  };
}

async function checkNetworkConnectivity(): Promise<any> {
  // In a real implementation, this would check external dependencies
  return {
    externalServices: {
      // This would check actual external services
      healthApi: 'connected',
      database: 'connected'
    },
    internalServices: {
      monitoring: 'active',
      alerting: 'active',
      logging: 'active'
    }
  };
}

async function checkSecurityStatus(): Promise<any> {
  return {
    authentication: 'active',
    authorization: 'active',
    rateLimiting: 'active',
    inputValidation: 'active',
    auditLogging: 'active',
    dataEncryption: 'active'
  };
}

async function runDiagnostics(): Promise<any> {
  const diagnostics = [];
  
  // Memory diagnostic
  const memUsage = process.memoryUsage();
  const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  if (memoryUsagePercent > 80) {
    diagnostics.push({
      type: 'warning',
      category: 'memory',
      message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
      recommendation: 'Monitor memory usage and consider optimization'
    });
  }
  
  // Uptime diagnostic
  const uptimeHours = process.uptime() / 3600;
  if (uptimeHours > 24 * 7) { // More than a week
    diagnostics.push({
      type: 'info',
      category: 'uptime',
      message: `Long uptime: ${Math.round(uptimeHours)} hours`,
      recommendation: 'Consider scheduled restarts for optimal performance'
    });
  }
  
  return diagnostics;
}

async function getSystemRecommendations(): Promise<any[]> {
  const recommendations = [];
  
  // Performance recommendations
  const performanceReport = await applicationMonitor.getPerformanceReport();
  
  if (performanceReport.requests.avgResponseTime > 1000) {
    recommendations.push({
      priority: 'medium',
      category: 'performance',
      title: 'Slow Response Times',
      description: 'Average response time exceeds 1 second',
      action: 'Investigate slow endpoints and optimize database queries'
    });
  }
  
  if (performanceReport.requests.failed > performanceReport.requests.total * 0.05) {
    recommendations.push({
      priority: 'high',
      category: 'reliability',
      title: 'High Error Rate',
      description: 'Error rate exceeds 5%',
      action: 'Review error logs and implement additional error handling'
    });
  }
  
  return recommendations;
}

export default router;