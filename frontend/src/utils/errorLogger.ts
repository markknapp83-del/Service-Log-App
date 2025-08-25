// Frontend Error Logger for Healthcare Application
// Following React 18 documentation patterns for client-side error handling

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  error: {
    message: string;
    name: string;
    stack?: string;
  };
  context: {
    level: 'low' | 'medium' | 'high' | 'critical';
    category: 'ui' | 'network' | 'validation' | 'security' | 'healthcare';
    page: string;
    component?: string;
    userId?: string;
    userRole?: string;
  };
  environment: {
    userAgent: string;
    viewport: { width: number; height: number };
    url: string;
    timestamp: string;
  };
  healthcareContext?: {
    hasPatientData: boolean;
    activeForm?: string;
    dataType?: 'patient' | 'service' | 'admin';
  };
  recovery?: {
    attempted: boolean;
    successful: boolean;
    method?: string;
  };
}

interface UserInteraction {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  context: {
    page: string;
    component?: string;
    userId?: string;
  };
}

class FrontendErrorLogger {
  private static instance: FrontendErrorLogger;
  private errorBuffer: ErrorLogEntry[] = [];
  private interactionBuffer: UserInteraction[] = [];
  private maxBufferSize = 50;
  private flushInterval: NodeJS.Timeout | null = null;
  private retryQueue: ErrorLogEntry[] = [];

  private constructor() {
    this.initializeErrorLogging();
    this.startPeriodicFlush();
  }

  public static getInstance(): FrontendErrorLogger {
    if (!FrontendErrorLogger.instance) {
      FrontendErrorLogger.instance = new FrontendErrorLogger();
    }
    return FrontendErrorLogger.instance;
  }

  // Initialize global error handling
  private initializeErrorLogging(): void {
    // Global error handler for unhandled errors
    window.addEventListener('error', (event) => {
      this.logError(event.error, {
        level: 'high',
        category: 'ui',
        component: 'global',
        source: 'window.onerror'
      });
    });

    // Global handler for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(new Error(event.reason), {
        level: 'medium',
        category: 'network',
        component: 'global',
        source: 'unhandledRejection'
      });
    });

    // Console error interception (for development debugging)
    if (process.env.NODE_ENV === 'development') {
      const originalError = console.error;
      console.error = (...args) => {
        if (args[0] instanceof Error) {
          this.logError(args[0], {
            level: 'low',
            category: 'ui',
            component: 'console',
            source: 'console.error'
          });
        }
        originalError.apply(console, args);
      };
    }
  }

  // Start periodic buffer flush
  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushBuffers();
    }, 30000); // Flush every 30 seconds
  }

  // Log error with healthcare-specific context
  public logError(
    error: Error, 
    context: {
      level?: 'low' | 'medium' | 'high' | 'critical';
      category?: 'ui' | 'network' | 'validation' | 'security' | 'healthcare';
      component?: string;
      source?: string;
      userId?: string;
      userRole?: string;
      recovery?: {
        attempted: boolean;
        successful: boolean;
        method?: string;
      };
    } = {}
  ): void {
    const errorId = `fe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const errorEntry: ErrorLogEntry = {
      id: errorId,
      timestamp: new Date().toISOString(),
      error: {
        message: this.sanitizeErrorMessage(error.message),
        name: error.name,
        stack: this.sanitizeStackTrace(error.stack)
      },
      context: {
        level: context.level || this.determineSeverity(error),
        category: context.category || this.categorizeError(error),
        page: this.getCurrentPage(),
        component: context.component,
        userId: context.userId || this.getCurrentUserId(),
        userRole: context.userRole || this.getCurrentUserRole()
      },
      environment: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        url: window.location.href,
        timestamp: new Date().toISOString()
      },
      healthcareContext: this.getHealthcareContext(),
      recovery: context.recovery
    };

    // Add to buffer
    this.errorBuffer.push(errorEntry);
    
    // Manage buffer size
    if (this.errorBuffer.length > this.maxBufferSize) {
      this.errorBuffer.shift(); // Remove oldest entry
    }

    // Immediate flush for critical errors
    if (errorEntry.context.level === 'critical') {
      this.flushError(errorEntry);
    }

    // Console logging for development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Frontend Error [${errorEntry.context.level.toUpperCase()}]`);
      console.error('Error:', error);
      console.log('Context:', errorEntry.context);
      console.log('Healthcare Context:', errorEntry.healthcareContext);
      console.groupEnd();
    }
  }

  // Track user interactions for error analysis
  public trackUserInteraction(
    event: string, 
    data: Record<string, unknown> = {}
  ): void {
    const interaction: UserInteraction = {
      event,
      timestamp: new Date().toISOString(),
      data: this.sanitizeInteractionData(data),
      context: {
        page: this.getCurrentPage(),
        component: data.component as string,
        userId: this.getCurrentUserId()
      }
    };

    this.interactionBuffer.push(interaction);

    // Manage buffer size
    if (this.interactionBuffer.length > this.maxBufferSize) {
      this.interactionBuffer.shift();
    }
  }

  // Sanitize error message to prevent PHI exposure
  private sanitizeErrorMessage(message: string): string {
    if (!message) return 'Unknown error';
    
    return message
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
      .replace(/\b\d{10,}\b/g, '[REDACTED_NUMBER]')
      .substring(0, 500); // Limit length
  }

  // Sanitize stack trace
  private sanitizeStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;
    
    // Remove potential sensitive information and limit size
    return stack
      .replace(/file:\/\/\/.*?\//g, 'file:///.../') // Hide file paths
      .replace(/http:\/\/localhost:\d+\//g, 'http://localhost:XXXX/')
      .substring(0, 2000); // Limit stack trace size
  }

  // Sanitize interaction data
  private sanitizeInteractionData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeErrorMessage(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeInteractionData(value as Record<string, unknown>);
      } else {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  // Determine error severity
  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Critical - security or PHI exposure
    if (message.includes('patient') || 
        message.includes('phi') || 
        message.includes('unauthorized') ||
        message.includes('security')) {
      return 'critical';
    }

    // High - application breaking errors
    if (name.includes('typeerror') && message.includes('cannot read') ||
        message.includes('is not defined') ||
        message.includes('permission denied')) {
      return 'high';
    }

    // Medium - network or recoverable errors
    if (message.includes('network') || 
        message.includes('fetch') ||
        message.includes('timeout') ||
        name.includes('chunkerror')) {
      return 'medium';
    }

    // Low - minor issues
    return 'low';
  }

  // Categorize error type
  private categorizeError(error: Error): 'ui' | 'network' | 'validation' | 'security' | 'healthcare' {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (message.includes('patient') || message.includes('service') || message.includes('phi')) {
      return 'healthcare';
    }

    if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('security')) {
      return 'security';
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'network';
    }

    if (message.includes('validation') || message.includes('required') || message.includes('invalid')) {
      return 'validation';
    }

    return 'ui';
  }

  // Get current page context
  private getCurrentPage(): string {
    const path = window.location.pathname;
    
    if (path.includes('/dashboard')) return 'dashboard';
    if (path.includes('/service-log')) return 'service-log';
    if (path.includes('/admin')) return 'admin';
    if (path.includes('/submissions')) return 'submissions';
    if (path.includes('/login')) return 'login';
    
    return path || 'unknown';
  }

  // Get current user ID
  private getCurrentUserId(): string | undefined {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return user.id || user.user_id;
      }
    } catch {
      // Ignore parsing errors
    }
    return undefined;
  }

  // Get current user role
  private getCurrentUserRole(): string | undefined {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        return user.role;
      }
    } catch {
      // Ignore parsing errors
    }
    return undefined;
  }

  // Get healthcare-specific context
  private getHealthcareContext(): ErrorLogEntry['healthcareContext'] {
    const hasPatientData = document.querySelectorAll('[data-patient-info], [data-phi]').length > 0;
    const forms = document.querySelectorAll('form[data-healthcare-form], form[data-patient-form]');
    
    let activeForm: string | undefined;
    let dataType: 'patient' | 'service' | 'admin' | undefined;

    if (forms.length > 0) {
      const form = forms[0] as HTMLFormElement;
      activeForm = form.getAttribute('data-form-type') || 'healthcare-form';
      
      if (activeForm.includes('patient')) dataType = 'patient';
      else if (activeForm.includes('service')) dataType = 'service';
      else if (activeForm.includes('admin')) dataType = 'admin';
    }

    return {
      hasPatientData,
      activeForm,
      dataType
    };
  }

  // Flush buffers to backend
  private async flushBuffers(): Promise<void> {
    if (this.errorBuffer.length === 0 && this.interactionBuffer.length === 0) {
      return;
    }

    const payload = {
      errors: [...this.errorBuffer],
      interactions: [...this.interactionBuffer],
      timestamp: new Date().toISOString()
    };

    // Clear buffers
    this.errorBuffer = [];
    this.interactionBuffer = [];

    try {
      await this.sendToBackend('/api/client-logs', payload);
    } catch (error) {
      // If flush fails, add critical errors back to retry queue
      payload.errors
        .filter(e => e.context.level === 'critical')
        .forEach(e => this.retryQueue.push(e));
      
      console.warn('Failed to flush error logs to backend:', error);
    }
  }

  // Flush single critical error immediately
  private async flushError(errorEntry: ErrorLogEntry): Promise<void> {
    try {
      await this.sendToBackend('/api/client-logs/critical', {
        error: errorEntry,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.retryQueue.push(errorEntry);
      console.warn('Failed to flush critical error:', error);
    }
  }

  // Send data to backend
  private async sendToBackend(endpoint: string, data: any): Promise<void> {
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const url = `${baseURL.replace('/api', '')}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth header if available
        ...(this.getAuthHeader())
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to send logs: ${response.status} ${response.statusText}`);
    }
  }

  // Get authorization header
  private getAuthHeader(): Record<string, string> {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    } catch {
      // Ignore errors
    }
    return {};
  }

  // Get error statistics
  public getErrorStatistics(): {
    totalErrors: number;
    errorsByLevel: Record<string, number>;
    errorsByCategory: Record<string, number>;
    recentErrors: ErrorLogEntry[];
  } {
    const errorsByLevel = { low: 0, medium: 0, high: 0, critical: 0 };
    const errorsByCategory = { ui: 0, network: 0, validation: 0, security: 0, healthcare: 0 };

    this.errorBuffer.forEach(error => {
      errorsByLevel[error.context.level]++;
      errorsByCategory[error.context.category]++;
    });

    return {
      totalErrors: this.errorBuffer.length,
      errorsByLevel,
      errorsByCategory,
      recentErrors: this.errorBuffer.slice(-10) // Last 10 errors
    };
  }

  // Clear all buffers (for testing or reset)
  public clearBuffers(): void {
    this.errorBuffer = [];
    this.interactionBuffer = [];
    this.retryQueue = [];
  }

  // Cleanup resources
  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushBuffers(); // Final flush
  }
}

// Export singleton instance and convenience functions
const errorLogger = FrontendErrorLogger.getInstance();

export const logError = (
  error: Error, 
  context?: Parameters<FrontendErrorLogger['logError']>[1]
) => errorLogger.logError(error, context);

export const trackUserInteraction = (
  event: string, 
  data?: Record<string, unknown>
) => errorLogger.trackUserInteraction(event, data);

export const getErrorStatistics = () => errorLogger.getErrorStatistics();

export const clearErrorLogs = () => errorLogger.clearBuffers();

export default errorLogger;