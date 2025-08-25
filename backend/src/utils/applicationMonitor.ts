// Application Monitoring System following Express.js documentation patterns
import { Request, Response } from 'express';
import { logger, HealthcareLogger } from './logger';
import { db } from '@/database/connection';
import os from 'os';
import v8 from 'v8';

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    free: number;
    usage: number;
    heapUsed: number;
    heapTotal: number;
  };
  cpu: {
    usage: number;
    loadAvg: number[];
  };
  system: {
    uptime: number;
    platform: string;
    arch: string;
  };
  database: {
    isConnected: boolean;
    avgResponseTime: number;
    totalQueries: number;
    slowQueries: number;
  };
  healthcare: {
    activeUsers: number;
    patientRecordsAccessed: number;
    serviceLogsCreated: number;
    errorRate: number;
  };
}

interface PerformanceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
    slowRequests: number;
  };
  endpoints: Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    errorCount: number;
  }>;
  users: {
    activeUsers: Set<string>;
    concurrent: number;
    peakConcurrent: number;
  };
}

interface HealthcareMetrics {
  patientAccess: {
    total: number;
    unique: number;
    suspicious: number;
  };
  dataIntegrity: {
    validationErrors: number;
    dataCorruption: number;
    auditTrailGaps: number;
  };
  compliance: {
    hipaaViolations: number;
    unauthorizedAccess: number;
    dataExposure: number;
  };
}

export class ApplicationMonitor {
  private static instance: ApplicationMonitor;
  private performanceMetrics: PerformanceMetrics;
  private healthcareMetrics: HealthcareMetrics;
  private startTime: number;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startTime = Date.now();
    this.performanceMetrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        avgResponseTime: 0,
        slowRequests: 0
      },
      endpoints: new Map(),
      users: {
        activeUsers: new Set(),
        concurrent: 0,
        peakConcurrent: 0
      }
    };

    this.healthcareMetrics = {
      patientAccess: {
        total: 0,
        unique: 0,
        suspicious: 0
      },
      dataIntegrity: {
        validationErrors: 0,
        dataCorruption: 0,
        auditTrailGaps: 0
      },
      compliance: {
        hipaaViolations: 0,
        unauthorizedAccess: 0,
        dataExposure: 0
      }
    };

    this.startMonitoring();
  }

  public static getInstance(): ApplicationMonitor {
    if (!ApplicationMonitor.instance) {
      ApplicationMonitor.instance = new ApplicationMonitor();
    }
    return ApplicationMonitor.instance;
  }

  // Start continuous monitoring
  private startMonitoring(): void {
    // Monitor system metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Log monitoring start
    HealthcareLogger.info('Application monitoring started', {
      category: 'monitoring',
      startTime: new Date().toISOString()
    });
  }

  // Stop monitoring
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    HealthcareLogger.info('Application monitoring stopped', {
      category: 'monitoring',
      stopTime: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    });
  }

  // Collect comprehensive system metrics
  private async collectSystemMetrics(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics();
      
      // Log performance metrics
      HealthcareLogger.performanceLog('system_metrics', 0, {
        metrics,
        collectionTime: new Date().toISOString()
      });

      // Check for performance issues
      this.checkPerformanceThresholds(metrics);

    } catch (error) {
      HealthcareLogger.error('Failed to collect system metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        category: 'monitoring'
      });
    }
  }

  // Get comprehensive system metrics
  public async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem()
    };

    // Get database metrics
    const dbHealth = await this.getDatabaseHealth();

    // Calculate CPU usage (simplified)
    const loadAvg = os.loadavg();

    return {
      memory: {
        used: memoryUsage.rss,
        total: systemMemory.total,
        free: systemMemory.free,
        usage: ((systemMemory.total - systemMemory.free) / systemMemory.total) * 100,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      },
      cpu: {
        usage: this.calculateCPUUsage(),
        loadAvg
      },
      system: {
        uptime: process.uptime(),
        platform: os.platform(),
        arch: os.arch()
      },
      database: dbHealth,
      healthcare: await this.getHealthcareMetrics()
    };
  }

  // Get database health metrics
  private async getDatabaseHealth(): Promise<SystemMetrics['database']> {
    try {
      const startTime = Date.now();
      db.exec('SELECT 1');
      const responseTime = Date.now() - startTime;

      const queryMetrics = db.getQueryMetrics?.() || {
        totalQueries: 0,
        avgResponseTime: responseTime,
        slowQueries: 0
      };

      return {
        isConnected: true,
        avgResponseTime: queryMetrics.avgResponseTime || responseTime,
        totalQueries: queryMetrics.totalQueries || 0,
        slowQueries: queryMetrics.slowQueries || 0
      };
    } catch (error) {
      return {
        isConnected: false,
        avgResponseTime: 0,
        totalQueries: 0,
        slowQueries: 0
      };
    }
  }

  // Get healthcare-specific metrics
  private async getHealthcareMetrics(): Promise<SystemMetrics['healthcare']> {
    try {
      // Get recent activity counts (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const activeUsers = db.get(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM audit_log 
        WHERE timestamp > ?
      `, [oneDayAgo]) as { count: number } || { count: 0 };

      const patientAccess = db.get(`
        SELECT COUNT(*) as count
        FROM audit_log 
        WHERE action LIKE '%patient%' AND timestamp > ?
      `, [oneDayAgo]) as { count: number } || { count: 0 };

      const serviceLogs = db.get(`
        SELECT COUNT(*) as count
        FROM service_logs 
        WHERE created_at > ?
      `, [oneDayAgo]) as { count: number } || { count: 0 };

      // Calculate error rate from recent logs
      const errorRate = this.calculateRecentErrorRate();

      return {
        activeUsers: activeUsers.count,
        patientRecordsAccessed: patientAccess.count,
        serviceLogsCreated: serviceLogs.count,
        errorRate
      };
    } catch (error) {
      HealthcareLogger.warn('Failed to get healthcare metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        activeUsers: 0,
        patientRecordsAccessed: 0,
        serviceLogsCreated: 0,
        errorRate: 0
      };
    }
  }

  // Calculate CPU usage (simplified approach)
  private calculateCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      const times = cpu.times;
      totalIdle += times.idle;
      totalTick += times.idle + times.user + times.nice + times.sys + times.irq;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    
    return 100 - (idle / total * 100);
  }

  // Calculate recent error rate
  private calculateRecentErrorRate(): number {
    const totalRequests = this.performanceMetrics.requests.total;
    const failedRequests = this.performanceMetrics.requests.failed;
    
    if (totalRequests === 0) return 0;
    return (failedRequests / totalRequests) * 100;
  }

  // Check performance thresholds and alert if necessary
  private checkPerformanceThresholds(metrics: SystemMetrics): void {
    // Memory usage threshold (80%)
    if (metrics.memory.usage > 80) {
      HealthcareLogger.securityLog('high_memory_usage', 'high', {
        memoryUsage: metrics.memory.usage,
        threshold: 80
      });
    }

    // Database response time threshold (1 second)
    if (metrics.database.avgResponseTime > 1000) {
      HealthcareLogger.securityLog('slow_database_response', 'medium', {
        responseTime: metrics.database.avgResponseTime,
        threshold: 1000
      });
    }

    // Error rate threshold (5%)
    if (metrics.healthcare.errorRate > 5) {
      HealthcareLogger.securityLog('high_error_rate', 'high', {
        errorRate: metrics.healthcare.errorRate,
        threshold: 5
      });
    }
  }

  // Record request metrics
  public recordRequest(req: Request, res: Response, responseTime: number): void {
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    const isSuccess = res.statusCode < 400;
    const isSlow = responseTime > 2000; // 2 seconds threshold

    // Update overall metrics
    this.performanceMetrics.requests.total++;
    if (isSuccess) {
      this.performanceMetrics.requests.successful++;
    } else {
      this.performanceMetrics.requests.failed++;
    }

    if (isSlow) {
      this.performanceMetrics.requests.slowRequests++;
    }

    // Update average response time
    const totalTime = this.performanceMetrics.requests.avgResponseTime * (this.performanceMetrics.requests.total - 1) + responseTime;
    this.performanceMetrics.requests.avgResponseTime = totalTime / this.performanceMetrics.requests.total;

    // Update endpoint-specific metrics
    if (!this.performanceMetrics.endpoints.has(endpoint)) {
      this.performanceMetrics.endpoints.set(endpoint, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        errorCount: 0
      });
    }

    const endpointMetrics = this.performanceMetrics.endpoints.get(endpoint)!;
    endpointMetrics.count++;
    endpointMetrics.totalTime += responseTime;
    endpointMetrics.avgTime = endpointMetrics.totalTime / endpointMetrics.count;

    if (!isSuccess) {
      endpointMetrics.errorCount++;
    }

    // Track user activity
    if (req.user?.id) {
      this.performanceMetrics.users.activeUsers.add(req.user.id);
    }

    // Record healthcare-specific metrics
    this.recordHealthcareActivity(req, res);
  }

  // Record healthcare-specific activity
  private recordHealthcareActivity(req: Request, res: Response): void {
    // Track patient data access
    if (req.url.includes('/patients/') || req.url.includes('/service-logs/')) {
      this.healthcareMetrics.patientAccess.total++;
      
      // Check for suspicious patterns
      if (this.isSuspiciousAccess(req)) {
        this.healthcareMetrics.patientAccess.suspicious++;
        HealthcareLogger.securityLog('suspicious_patient_access', 'medium', {
          userId: req.user?.id,
          endpoint: req.url,
          method: req.method,
          userAgent: req.get('User-Agent')
        });
      }
    }

    // Track validation errors
    if (res.statusCode === 400 && req.body) {
      this.healthcareMetrics.dataIntegrity.validationErrors++;
    }

    // Track unauthorized access
    if (res.statusCode === 403) {
      this.healthcareMetrics.compliance.unauthorizedAccess++;
    }
  }

  // Detect suspicious access patterns
  private isSuspiciousAccess(req: Request): boolean {
    const userAgent = req.get('User-Agent');
    const ip = req.ip;

    // Check for bot-like behavior
    if (userAgent && (userAgent.includes('bot') || userAgent.includes('curl') || userAgent.includes('wget'))) {
      return true;
    }

    // Check for rapid sequential access (simplified)
    // In production, this would use a more sophisticated rate tracking
    const userId = req.user?.id;
    if (userId) {
      const recentAccess = this.performanceMetrics.users.activeUsers.has(userId);
      // This is a simplified check - in production, track timestamps
      return false;
    }

    return false;
  }

  // Get comprehensive health check
  public async getHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    metrics: SystemMetrics;
    issues: string[];
  }> {
    const metrics = await this.getSystemMetrics();
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check various health indicators
    if (!metrics.database.isConnected) {
      issues.push('Database connection failed');
      status = 'unhealthy';
    }

    if (metrics.database.avgResponseTime > 2000) {
      issues.push('Database response time is slow');
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    if (metrics.memory.usage > 90) {
      issues.push('Memory usage is critically high');
      status = 'unhealthy';
    } else if (metrics.memory.usage > 80) {
      issues.push('Memory usage is high');
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    if (metrics.healthcare.errorRate > 10) {
      issues.push('Error rate is critically high');
      status = 'unhealthy';
    } else if (metrics.healthcare.errorRate > 5) {
      issues.push('Error rate is elevated');
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      metrics,
      issues
    };
  }

  // Get performance report
  public getPerformanceReport(): {
    requests: PerformanceMetrics['requests'];
    endpoints: Array<{
      endpoint: string;
      count: number;
      avgTime: number;
      errorRate: number;
    }>;
    healthcareMetrics: HealthcareMetrics;
  } {
    const endpoints = Array.from(this.performanceMetrics.endpoints.entries()).map(([endpoint, metrics]) => ({
      endpoint,
      count: metrics.count,
      avgTime: Math.round(metrics.avgTime),
      errorRate: metrics.count > 0 ? (metrics.errorCount / metrics.count) * 100 : 0
    }));

    // Sort endpoints by request count
    endpoints.sort((a, b) => b.count - a.count);

    return {
      requests: this.performanceMetrics.requests,
      endpoints: endpoints.slice(0, 20), // Top 20 endpoints
      healthcareMetrics: this.healthcareMetrics
    };
  }

  // Reset metrics (for testing or periodic reset)
  public resetMetrics(): void {
    this.performanceMetrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        avgResponseTime: 0,
        slowRequests: 0
      },
      endpoints: new Map(),
      users: {
        activeUsers: new Set(),
        concurrent: 0,
        peakConcurrent: 0
      }
    };

    this.healthcareMetrics = {
      patientAccess: {
        total: 0,
        unique: 0,
        suspicious: 0
      },
      dataIntegrity: {
        validationErrors: 0,
        dataCorruption: 0,
        auditTrailGaps: 0
      },
      compliance: {
        hipaaViolations: 0,
        unauthorizedAccess: 0,
        dataExposure: 0
      }
    };

    HealthcareLogger.info('Application metrics reset', {
      category: 'monitoring',
      resetTime: new Date().toISOString()
    });
  }
}

// Export singleton instance
export const applicationMonitor = ApplicationMonitor.getInstance();

// Express middleware for monitoring
export const monitoringMiddleware = (req: Request, res: Response, next: Function) => {
  const startTime = Date.now();

  // Add monitoring to response finish event
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    applicationMonitor.recordRequest(req, res, responseTime);
  });

  next();
};