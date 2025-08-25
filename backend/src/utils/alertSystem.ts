// Alert System for Healthcare Application Monitoring
// Following Express.js documentation patterns for production-ready alerting
import { HealthcareLogger } from './logger';
import { HIPAALogger } from './hipaa-compliance';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertCategory = 'security' | 'performance' | 'system' | 'healthcare' | 'compliance';

interface Alert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: string;
  escalated: boolean;
  notificationsSent: string[];
}

interface AlertRule {
  id: string;
  category: AlertCategory;
  condition: string;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownMinutes: number;
  escalationMinutes: number;
  notificationChannels: string[];
}

interface NotificationChannel {
  id: string;
  type: 'email' | 'webhook' | 'log' | 'console';
  enabled: boolean;
  config: Record<string, unknown>;
  severityFilter: AlertSeverity[];
}

class AlertSystemManager {
  private static instance: AlertSystemManager;
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private notificationChannels: Map<string, NotificationChannel> = new Map();
  private alertCooldowns: Map<string, number> = new Map();

  private constructor() {
    this.initializeDefaultRules();
    this.initializeNotificationChannels();
    this.startAlertProcessing();
  }

  public static getInstance(): AlertSystemManager {
    if (!AlertSystemManager.instance) {
      AlertSystemManager.instance = new AlertSystemManager();
    }
    return AlertSystemManager.instance;
  }

  // Initialize default alert rules for healthcare application
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_memory_usage',
        category: 'system',
        condition: 'memory_usage_percent > threshold',
        threshold: 85,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 15,
        escalationMinutes: 30,
        notificationChannels: ['log', 'console']
      },
      {
        id: 'database_slow_response',
        category: 'performance',
        condition: 'database_response_time > threshold',
        threshold: 2000, // 2 seconds
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 10,
        escalationMinutes: 20,
        notificationChannels: ['log', 'console']
      },
      {
        id: 'high_error_rate',
        category: 'system',
        condition: 'error_rate_percent > threshold',
        threshold: 5,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 5,
        escalationMinutes: 15,
        notificationChannels: ['log', 'console']
      },
      {
        id: 'unauthorized_access_attempt',
        category: 'security',
        condition: 'unauthorized_attempts > threshold',
        threshold: 5,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 1,
        escalationMinutes: 5,
        notificationChannels: ['log', 'console']
      },
      {
        id: 'patient_data_exposure',
        category: 'compliance',
        condition: 'phi_exposure_detected',
        threshold: 1,
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 0, // Immediate alert for data exposure
        escalationMinutes: 2,
        notificationChannels: ['log', 'console']
      },
      {
        id: 'service_unavailable',
        category: 'system',
        condition: 'service_availability < threshold',
        threshold: 95, // 95% availability
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 5,
        escalationMinutes: 10,
        notificationChannels: ['log', 'console']
      },
      {
        id: 'suspicious_patient_access',
        category: 'healthcare',
        condition: 'suspicious_access_pattern_detected',
        threshold: 1,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 30,
        escalationMinutes: 60,
        notificationChannels: ['log']
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });

    HealthcareLogger.info('Alert rules initialized', {
      category: 'alerting',
      rulesCount: defaultRules.length
    });
  }

  // Initialize notification channels
  private initializeNotificationChannels(): void {
    const channels: NotificationChannel[] = [
      {
        id: 'log',
        type: 'log',
        enabled: true,
        config: {},
        severityFilter: ['low', 'medium', 'high', 'critical']
      },
      {
        id: 'console',
        type: 'console',
        enabled: process.env.NODE_ENV === 'development',
        config: {},
        severityFilter: ['medium', 'high', 'critical']
      }
    ];

    // Add email channel if configured
    if (process.env.ALERT_EMAIL_ENABLED === 'true') {
      channels.push({
        id: 'email',
        type: 'email',
        enabled: true,
        config: {
          smtpHost: process.env.ALERT_SMTP_HOST,
          smtpPort: process.env.ALERT_SMTP_PORT,
          username: process.env.ALERT_EMAIL_USER,
          password: process.env.ALERT_EMAIL_PASS,
          from: process.env.ALERT_EMAIL_FROM,
          to: process.env.ALERT_EMAIL_TO?.split(',') || []
        },
        severityFilter: ['high', 'critical']
      });
    }

    // Add webhook channel if configured
    if (process.env.ALERT_WEBHOOK_URL) {
      channels.push({
        id: 'webhook',
        type: 'webhook',
        enabled: true,
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ALERT_WEBHOOK_AUTH || ''
          }
        },
        severityFilter: ['high', 'critical']
      });
    }

    channels.forEach(channel => {
      this.notificationChannels.set(channel.id, channel);
    });

    HealthcareLogger.info('Notification channels initialized', {
      category: 'alerting',
      channelsCount: channels.length
    });
  }

  // Start alert processing
  private startAlertProcessing(): void {
    // Process alerts every 30 seconds
    setInterval(() => {
      this.processEscalations();
      this.cleanupOldAlerts();
    }, 30000);

    HealthcareLogger.info('Alert processing started', {
      category: 'alerting'
    });
  }

  // Send alert
  public async sendAlert(
    ruleId: string, 
    metadata: Record<string, unknown> = {},
    customMessage?: string
  ): Promise<void> {
    const rule = this.alertRules.get(ruleId);
    if (!rule || !rule.enabled) {
      return;
    }

    // Check cooldown period
    const cooldownKey = `${ruleId}:${JSON.stringify(metadata)}`;
    const lastAlertTime = this.alertCooldowns.get(cooldownKey);
    const now = Date.now();
    
    if (lastAlertTime && (now - lastAlertTime) < (rule.cooldownMinutes * 60 * 1000)) {
      return; // Still in cooldown period
    }

    // Create alert
    const alertId = `${ruleId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const alert: Alert = {
      id: alertId,
      category: rule.category,
      severity: rule.severity,
      title: this.generateAlertTitle(rule),
      message: customMessage || this.generateAlertMessage(rule, metadata),
      timestamp: new Date().toISOString(),
      metadata: this.sanitizeMetadata(metadata),
      resolved: false,
      escalated: false,
      notificationsSent: []
    };

    // Store alert
    this.alerts.set(alertId, alert);
    
    // Update cooldown
    this.alertCooldowns.set(cooldownKey, now);

    // Send notifications
    await this.sendNotifications(alert, rule);

    // Log alert creation
    HealthcareLogger.securityLog(`alert_created_${ruleId}`, rule.severity, {
      alertId,
      category: rule.category,
      metadata: alert.metadata
    });
  }

  // Generate alert title
  private generateAlertTitle(rule: AlertRule): string {
    const titles: Record<string, string> = {
      high_memory_usage: 'High Memory Usage Detected',
      database_slow_response: 'Database Response Time Alert',
      high_error_rate: 'High Application Error Rate',
      unauthorized_access_attempt: 'Unauthorized Access Attempts',
      patient_data_exposure: 'CRITICAL: Patient Data Exposure Risk',
      service_unavailable: 'Service Availability Issue',
      suspicious_patient_access: 'Suspicious Patient Data Access'
    };

    return titles[rule.id] || `Alert: ${rule.id}`;
  }

  // Generate alert message
  private generateAlertMessage(rule: AlertRule, metadata: Record<string, unknown>): string {
    const messages: Record<string, string> = {
      high_memory_usage: `Memory usage has exceeded ${rule.threshold}%. Current usage: ${metadata.memoryUsage}%`,
      database_slow_response: `Database response time has exceeded ${rule.threshold}ms. Current time: ${metadata.responseTime}ms`,
      high_error_rate: `Error rate has exceeded ${rule.threshold}%. Current rate: ${metadata.errorRate}%`,
      unauthorized_access_attempt: `Multiple unauthorized access attempts detected from ${metadata.ip || 'unknown IP'}`,
      patient_data_exposure: `Potential patient data exposure detected. Immediate investigation required.`,
      service_unavailable: `Service availability has dropped below ${rule.threshold}%`,
      suspicious_patient_access: `Suspicious pattern detected in patient data access from user ${metadata.userId || 'unknown'}`
    };

    return messages[rule.id] || `Alert condition met for rule: ${rule.id}`;
  }

  // Sanitize metadata to prevent PHI exposure
  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string') {
        // Remove potential PHI patterns
        const sanitizedValue = value
          .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
          .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
          .replace(/\b\d{10,}\b/g, '[REDACTED_NUMBER]');
        
        sanitized[key] = sanitizedValue;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  // Send notifications through configured channels
  private async sendNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    const notifications = rule.notificationChannels.map(async (channelId) => {
      const channel = this.notificationChannels.get(channelId);
      if (!channel || !channel.enabled) {
        return;
      }

      // Check severity filter
      if (!channel.severityFilter.includes(alert.severity)) {
        return;
      }

      try {
        await this.sendNotification(channel, alert);
        alert.notificationsSent.push(channelId);
      } catch (error) {
        HealthcareLogger.error('Failed to send alert notification', {
          alertId: alert.id,
          channelId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    await Promise.allSettled(notifications);
  }

  // Send notification through specific channel
  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    switch (channel.type) {
      case 'log':
        HealthcareLogger.securityLog(`alert_${alert.category}`, alert.severity, {
          alertId: alert.id,
          title: alert.title,
          message: alert.message,
          metadata: alert.metadata
        });
        break;

      case 'console':
        const severityColor = this.getSeverityColor(alert.severity);
        console.log(`\n${severityColor}🚨 ALERT: ${alert.title}\x1b[0m`);
        console.log(`Category: ${alert.category}`);
        console.log(`Severity: ${alert.severity}`);
        console.log(`Message: ${alert.message}`);
        console.log(`Time: ${alert.timestamp}`);
        if (Object.keys(alert.metadata).length > 0) {
          console.log(`Metadata:`, JSON.stringify(alert.metadata, null, 2));
        }
        console.log(''); // Empty line for readability
        break;

      case 'email':
        // Email implementation would go here
        // For now, log that email would be sent
        HealthcareLogger.info('Email alert notification', {
          alertId: alert.id,
          to: channel.config.to,
          subject: `Healthcare Alert: ${alert.title}`,
          severity: alert.severity
        });
        break;

      case 'webhook':
        // Webhook implementation would go here
        // For now, log that webhook would be called
        HealthcareLogger.info('Webhook alert notification', {
          alertId: alert.id,
          url: channel.config.url,
          method: channel.config.method,
          severity: alert.severity
        });
        break;
    }
  }

  // Get console color for severity
  private getSeverityColor(severity: AlertSeverity): string {
    const colors = {
      low: '\x1b[32m',      // Green
      medium: '\x1b[33m',   // Yellow
      high: '\x1b[31m',     // Red
      critical: '\x1b[35m'  // Magenta
    };
    return colors[severity];
  }

  // Process alert escalations
  private processEscalations(): void {
    const now = Date.now();
    
    for (const alert of this.alerts.values()) {
      if (alert.resolved || alert.escalated) {
        continue;
      }

      const rule = this.alertRules.get(alert.id.split('-')[0]);
      if (!rule) {
        continue;
      }

      const alertTime = new Date(alert.timestamp).getTime();
      const escalationTime = rule.escalationMinutes * 60 * 1000;

      if ((now - alertTime) > escalationTime) {
        this.escalateAlert(alert, rule);
      }
    }
  }

  // Escalate alert
  private async escalateAlert(alert: Alert, rule: AlertRule): Promise<void> {
    alert.escalated = true;
    
    // Create escalated alert with higher severity
    const escalatedSeverity: AlertSeverity = alert.severity === 'low' ? 'medium' :
                                           alert.severity === 'medium' ? 'high' :
                                           alert.severity === 'high' ? 'critical' : 'critical';

    const escalatedAlert: Alert = {
      ...alert,
      id: `${alert.id}-escalated`,
      severity: escalatedSeverity,
      title: `ESCALATED: ${alert.title}`,
      message: `Alert has been escalated due to no resolution within ${rule.escalationMinutes} minutes. Original: ${alert.message}`,
      timestamp: new Date().toISOString(),
      escalated: true,
      notificationsSent: []
    };

    this.alerts.set(escalatedAlert.id, escalatedAlert);
    
    // Send escalated notifications
    await this.sendNotifications(escalatedAlert, {
      ...rule,
      severity: escalatedSeverity,
      notificationChannels: ['log', 'console'] // Always notify on escalation
    });

    HealthcareLogger.securityLog('alert_escalated', escalatedSeverity, {
      originalAlertId: alert.id,
      escalatedAlertId: escalatedAlert.id,
      escalationTime: rule.escalationMinutes
    });
  }

  // Clean up old alerts
  private cleanupOldAlerts(): void {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let cleanedUp = 0;

    for (const [alertId, alert] of this.alerts.entries()) {
      const alertTime = new Date(alert.timestamp).getTime();
      
      if (alertTime < oneWeekAgo) {
        this.alerts.delete(alertId);
        cleanedUp++;
      }
    }

    // Clean up old cooldowns
    for (const [cooldownKey, lastTime] of this.alertCooldowns.entries()) {
      if (lastTime < oneWeekAgo) {
        this.alertCooldowns.delete(cooldownKey);
      }
    }

    if (cleanedUp > 0) {
      HealthcareLogger.info('Alert cleanup completed', {
        category: 'alerting',
        cleanedAlerts: cleanedUp,
        remainingAlerts: this.alerts.size
      });
    }
  }

  // Resolve alert
  public resolveAlert(alertId: string, reason?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();

    HealthcareLogger.info('Alert resolved', {
      category: 'alerting',
      alertId,
      reason: reason || 'Manual resolution',
      resolutionTime: alert.resolvedAt
    });

    return true;
  }

  // Get active alerts
  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  // Get alert statistics
  public getAlertStatistics(): {
    total: number;
    active: number;
    resolved: number;
    bySeverity: Record<AlertSeverity, number>;
    byCategory: Record<AlertCategory, number>;
  } {
    const alerts = Array.from(this.alerts.values());
    const stats = {
      total: alerts.length,
      active: alerts.filter(a => !a.resolved).length,
      resolved: alerts.filter(a => a.resolved).length,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 } as Record<AlertSeverity, number>,
      byCategory: { security: 0, performance: 0, system: 0, healthcare: 0, compliance: 0 } as Record<AlertCategory, number>
    };

    alerts.forEach(alert => {
      stats.bySeverity[alert.severity]++;
      stats.byCategory[alert.category]++;
    });

    return stats;
  }

  // Test alert system
  public async testAlertSystem(): Promise<void> {
    HealthcareLogger.info('Testing alert system', { category: 'alerting' });
    
    await this.sendAlert('high_memory_usage', {
      memoryUsage: 90,
      threshold: 85,
      testAlert: true
    }, 'This is a test alert to verify the alert system is working correctly.');
  }
}

// Export singleton instance
export const AlertSystem = AlertSystemManager.getInstance();

// Convenience methods
export const sendAlert = (ruleId: string, metadata?: Record<string, unknown>, customMessage?: string) => 
  AlertSystem.sendAlert(ruleId, metadata, customMessage);

export const resolveAlert = (alertId: string, reason?: string) => 
  AlertSystem.resolveAlert(alertId, reason);

export const getActiveAlerts = () => AlertSystem.getActiveAlerts();

export const getAlertStatistics = () => AlertSystem.getAlertStatistics();

export const testAlertSystem = () => AlertSystem.testAlertSystem();