// Enhanced Error boundary component following React 18 documentation patterns
import { Component, ReactNode } from 'react';
import { ErrorBoundaryState, ErrorFallbackProps } from '@/types';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  level?: 'page' | 'component' | 'section';
  context?: string;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface EnhancedErrorBoundaryState extends ErrorBoundaryState {
  errorId?: string;
  retryCount: number;
  errorContext?: Record<string, unknown>;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, EnhancedErrorBoundaryState> {
  private retryTimeouts: NodeJS.Timeout[] = [];
  private maxRetries = 3;
  private retryDelays = [1000, 3000, 10000]; // 1s, 3s, 10s

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<EnhancedErrorBoundaryState> {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return { 
      hasError: true, 
      error,
      errorId,
      errorContext: {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { level = 'component', context, onError } = this.props;
    const { errorId, errorContext } = this.state;

    // Enhanced error logging with healthcare context
    const enhancedErrorInfo = {
      ...errorInfo,
      errorId,
      level,
      context,
      errorContext,
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name,
      props: this.sanitizeProps(this.props),
      state: this.sanitizeState(this.state),
      // Healthcare-specific context
      healthcareContext: {
        isPatientDataVisible: this.checkPatientDataVisibility(),
        activeForm: this.getActiveFormContext(),
        userRole: this.getUserRole()
      }
    };

    // Log error with appropriate severity
    const severity = this.determineSeverity(error, level);
    this.logError(error, enhancedErrorInfo, severity);

    // Call custom error handler if provided
    if (onError) {
      try {
        onError(error, errorInfo);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }

    // Track error for analytics
    this.trackUserInteraction('error_boundary_triggered', {
      errorId,
      errorMessage: error.message,
      errorType: error.name,
      level,
      context
    });

    // Attempt automatic recovery for certain error types
    if (this.canAutoRecover(error) && this.state.retryCount < this.maxRetries) {
      this.scheduleRetry();
    }
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error!}
          errorId={this.state.errorId}
          retryCount={this.state.retryCount}
          maxRetries={this.maxRetries}
          canRetry={this.canAutoRecover(this.state.error!)}
          level={this.props.level || 'component'}
          context={this.props.context}
          resetError={() => this.resetError()}
          onRetry={() => this.handleManualRetry()}
        />
      );
    }

    return this.props.children;
  }

  // Enhanced error recovery methods
  private resetError = () => {
    this.setState({ 
      hasError: false, 
      error: undefined,
      errorId: undefined,
      retryCount: 0,
      errorContext: undefined
    });
  };

  private handleManualRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.trackUserInteraction('error_manual_retry', {
        errorId: this.state.errorId,
        retryCount: this.state.retryCount + 1
      });
      
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  private scheduleRetry = () => {
    const delay = this.retryDelays[this.state.retryCount] || this.retryDelays[this.retryDelays.length - 1];
    
    const timeoutId = setTimeout(() => {
      if (this.state.hasError && this.state.retryCount < this.maxRetries) {
        this.trackUserInteraction('error_auto_retry', {
          errorId: this.state.errorId,
          retryCount: this.state.retryCount + 1,
          delay
        });
        
        this.setState(prevState => ({
          hasError: false,
          error: undefined,
          retryCount: prevState.retryCount + 1
        }));
      }
    }, delay);

    this.retryTimeouts.push(timeoutId);
  };

  private canAutoRecover = (error: Error): boolean => {
    // Define recoverable error patterns
    const recoverableErrors = [
      'ChunkLoadError',
      'Loading chunk',
      'Network request failed',
      'Failed to fetch',
      'TypeError: Cannot read properties of undefined'
    ];

    return recoverableErrors.some(pattern => 
      error.message.includes(pattern) || error.name.includes(pattern)
    );
  };

  private determineSeverity = (error: Error, level: string): 'low' | 'medium' | 'high' | 'critical' => {
    // Critical errors - data integrity or security issues
    if (error.message.includes('patient') || 
        error.message.includes('PHI') ||
        error.message.includes('unauthorized')) {
      return 'critical';
    }

    // High severity - page level errors
    if (level === 'page') {
      return 'high';
    }

    // Medium severity - section errors
    if (level === 'section') {
      return 'medium';
    }

    // Low severity - component errors
    return 'low';
  };

  private checkPatientDataVisibility = (): boolean => {
    // Check if patient data is currently visible in the DOM
    const patientElements = document.querySelectorAll('[data-patient-info], [data-phi]');
    return patientElements.length > 0;
  };

  private getActiveFormContext = (): string | null => {
    // Check for active healthcare forms
    const forms = document.querySelectorAll('form[data-healthcare-form], form[data-patient-form]');
    if (forms.length > 0) {
      const form = forms[0] as HTMLFormElement;
      return form.getAttribute('data-form-type') || 'healthcare-form';
    }
    return null;
  };

  private getUserRole = (): string | null => {
    // Try to get user role from various sources
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.role || null;
      } catch {
        return null;
      }
    }
    return null;
  };

  private sanitizeProps = (props: any): any => {
    // Remove sensitive data from props before logging
    const sanitized = { ...props };
    delete sanitized.children;
    delete sanitized.fallback;
    delete sanitized.onError;
    return sanitized;
  };

  private sanitizeState = (state: any): any => {
    // Remove sensitive data from state before logging
    const sanitized = { ...state };
    if (sanitized.error && sanitized.error.stack) {
      // Truncate stack trace for logging
      sanitized.error.stackTruncated = sanitized.error.stack.substring(0, 500);
      delete sanitized.error.stack;
    }
    return sanitized;
  };

  private logError = (error: Error, errorInfo: any, severity: string) => {
    // Enhanced error logging that would integrate with backend logging
    console.error(`[${severity.toUpperCase()}] Error Boundary:`, {
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 1000)
      },
      errorInfo
    });

    // In production, this would send to backend logging service
    if (process.env.NODE_ENV === 'production') {
      // This would be implemented with actual API call
      // fetch('/api/client-errors', { method: 'POST', body: JSON.stringify({ error, errorInfo, severity }) });
    }
  };

  private trackUserInteraction = (event: string, data: any) => {
    // Track user interactions for analytics
    console.log(`User Interaction: ${event}`, data);
    
    // In production, this would send to analytics service
    // analytics.track(event, data);
  };
}

// Enhanced default error fallback component with healthcare-specific UI
function DefaultErrorFallback({ 
  error, 
  errorId, 
  retryCount = 0, 
  maxRetries = 3,
  canRetry = false,
  level = 'component',
  context,
  resetError,
  onRetry 
}: ErrorFallbackProps & {
  errorId?: string;
  retryCount?: number;
  maxRetries?: number;
  canRetry?: boolean;
  level?: string;
  context?: string;
  onRetry?: () => void;
}) {
  const isPageLevel = level === 'page';
  const isHealthcareContext = context?.includes('patient') || context?.includes('service');
  
  return (
    <div className={isPageLevel ? "min-h-screen flex items-center justify-center bg-gray-50" : "p-4 bg-red-50 border border-red-200 rounded-lg"}>
      <div className={isPageLevel ? "max-w-md w-full text-center" : "w-full text-center"}>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-red-500 text-4xl mb-4">
            {isHealthcareContext ? '🏥' : '⚠️'}
          </div>
          <h1 className={`font-bold text-gray-900 mb-4 ${
            isPageLevel ? 'text-2xl' : 'text-lg'
          }`}>
            {isHealthcareContext 
              ? 'Healthcare Service Error' 
              : level === 'page' 
              ? 'Page Error' 
              : 'Component Error'
            }
          </h1>
          
          <p className="text-gray-600 mb-4">
            {getErrorMessage(error, isHealthcareContext, level)}
          </p>

          {errorId && (
            <p className="text-xs text-gray-500 mb-4 font-mono">
              Error ID: {errorId}
            </p>
          )}

          {retryCount > 0 && (
            <p className="text-sm text-amber-600 mb-4">
              Retry attempt {retryCount} of {maxRetries}
            </p>
          )}
          
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left mb-4 bg-gray-100 p-3 rounded text-sm">
              <summary className="cursor-pointer font-medium text-gray-700">
                Error Details (Development Only)
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-red-600 text-xs overflow-auto max-h-32">
                {error.message}
                {error.stack && `\n\nStack Trace:\n${error.stack.substring(0, 1000)}`}
              </pre>
              {context && (
                <p className="mt-2 text-gray-600">
                  <strong>Context:</strong> {context}
                </p>
              )}
            </details>
          )}
          
          <div className="flex flex-wrap gap-2 justify-center">
            {canRetry && retryCount < maxRetries && onRetry && (
              <button
                onClick={onRetry}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Retry ({maxRetries - retryCount} left)
              </button>
            )}
            
            <button
              onClick={resetError}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              {isPageLevel ? 'Try Again' : 'Reset Component'}
            </button>
            
            {isPageLevel && (
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                Go to Dashboard
              </button>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              Refresh Page
            </button>
          </div>

          {isHealthcareContext && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="text-blue-800">
                <strong>Healthcare Notice:</strong> If you were accessing patient data, 
                please ensure no sensitive information was compromised. 
                Contact IT support if needed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to generate context-appropriate error messages
function getErrorMessage(error: Error, isHealthcareContext: boolean, level: string): string {
  if (isHealthcareContext) {
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Unable to connect to healthcare services. Please check your connection and try again.';
    }
    if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      return 'You do not have permission to access this healthcare information.';
    }
    return 'A healthcare service error occurred. Patient data access has been temporarily interrupted.';
  }

  if (level === 'page') {
    return 'This page encountered an error and could not be displayed properly.';
  }

  if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
    return 'Failed to load application resources. This may be due to a recent update.';
  }

  return 'A component error occurred. The affected section may not display correctly.';
}

// Specialized error boundaries for different contexts
export class HealthcareErrorBoundary extends ErrorBoundary {
  constructor(props: ErrorBoundaryProps) {
    super({ ...props, level: 'component', context: 'healthcare' });
  }
}

export class PatientDataErrorBoundary extends ErrorBoundary {
  constructor(props: ErrorBoundaryProps) {
    super({ ...props, level: 'section', context: 'patient-data' });
  }
}

export class FormErrorBoundary extends ErrorBoundary {
  constructor(props: ErrorBoundaryProps) {
    super({ ...props, level: 'component', context: 'form' });
  }
}

export class PageErrorBoundary extends ErrorBoundary {
  constructor(props: ErrorBoundaryProps) {
    super({ ...props, level: 'page' });
  }
}