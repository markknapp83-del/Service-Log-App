// Main App component following React 18 documentation patterns with performance optimizations
import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toast } from './components/Toast';
import { usePerformanceMonitor } from './hooks/usePerformanceMonitor';
import { useMemoryManager } from './hooks/useMemoryManager';
import { measureCoreWebVitals, detectMemoryLeaks } from './hooks/usePerformanceMonitor';

// Lazy load pages for code splitting and performance
const LoginPage = lazy(() => 
  import('./pages/LoginPage').then(module => ({ default: module.LoginPage }))
);

const DashboardPage = lazy(() => 
  import('./pages/DashboardPage').then(module => ({ default: module.DashboardPage }))
);

const ServiceLogPage = lazy(() => 
  import('./pages/ServiceLogPage').then(module => ({ default: module.ServiceLogPage }))
);

// Admin pages - heavier components lazy loaded
const UserManagementPage = lazy(() => 
  import('./pages/UserManagementPage').then(module => ({ default: module.UserManagementPage }))
);

const TemplateManagementPage = lazy(() => 
  import('./pages/TemplateManagementPage').then(module => ({ default: module.TemplateManagementPage }))
);

const SubmissionsPage = lazy(() => 
  import('./pages/SubmissionsPage').then(module => ({ default: module.SubmissionsPage }))
);

// Loading component for Suspense fallbacks
const PageLoader: React.FC<{ message?: string }> = React.memo(({ message = 'Loading...' }) => (
  <div className="min-h-screen bg-healthcare-background flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-neutral-600 text-lg">{message}</p>
    </div>
  </div>
));

PageLoader.displayName = 'PageLoader';

function App() {
  const { measureAsync } = usePerformanceMonitor('App');
  const { monitorMemory, clearPatientDataCache } = useMemoryManager({
    maxCacheSize: 100, // 100MB for healthcare application
    cleanupInterval: 300000, // 5 minutes
    logMemoryUsage: process.env.NODE_ENV === 'development'
  });

  // Initialize performance monitoring
  useEffect(() => {
    // Start Core Web Vitals monitoring
    measureCoreWebVitals();
    
    // Start memory leak detection for long healthcare sessions
    detectMemoryLeaks();
    
    // Healthcare-specific cleanup on page visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Clear sensitive patient data from cache when tab becomes hidden
        clearPatientDataCache();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearPatientDataCache]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <div className="min-h-screen bg-healthcare-background">
            <Suspense fallback={<PageLoader message="Starting application..." />}>
              <Routes>
                {/* Public routes */}
                <Route 
                  path="/login" 
                  element={
                    <Suspense fallback={<PageLoader message="Loading login page..." />}>
                      <LoginPage />
                    </Suspense>
                  } 
                />
                
                {/* Protected routes with individual suspense boundaries */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader message="Loading dashboard..." />}>
                        <DashboardPage />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                
                {/* Service Log Entry */}
                <Route
                  path="/service-log"
                  element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader message="Loading service log form..." />}>
                        <ServiceLogPage />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                
                {/* Admin-only routes - lazy loaded for better performance */}
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<PageLoader message="Loading user management..." />}>
                        <UserManagementPage />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/templates"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <Suspense fallback={<PageLoader message="Loading template management..." />}>
                        <TemplateManagementPage />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                
                {/* Submissions/Reports - Available to both admin and candidates */}
                <Route
                  path="/submissions"
                  element={
                    <ProtectedRoute>
                      <Suspense fallback={<PageLoader message="Loading reports..." />}>
                        <SubmissionsPage />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                
                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                {/* Admin catch-all route - must come after specific admin routes */}
                <Route
                  path="/admin/*"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <div className="p-4">
                        <h1 className="text-2xl font-bold">Admin Panel</h1>
                        <p>Admin functionality is available in the following sections:</p>
                        <div className="mt-4 space-y-2">
                          <div>
                            <Link 
                              to="/admin/users" 
                              className="text-blue-600 hover:text-blue-500 underline block"
                            >
                              User Management
                            </Link>
                          </div>
                          <div>
                            <Link 
                              to="/admin/templates" 
                              className="text-blue-600 hover:text-blue-500 underline block"
                            >
                              Template Management
                            </Link>
                          </div>
                          <div>
                            <Link 
                              to="/submissions" 
                              className="text-blue-600 hover:text-blue-500 underline block"
                            >
                              View Submissions & Reports
                            </Link>
                          </div>
                        </div>
                      </div>
                    </ProtectedRoute>
                  }
                />
                
                {/* Catch-all 404 route - must be last */}
                <Route
                  path="*"
                  element={
                    <div className="min-h-screen flex items-center justify-center">
                      <div className="text-center">
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                        <p className="text-gray-600 mb-4">Page not found</p>
                        <Link
                          to="/dashboard"
                          className="text-blue-600 hover:text-blue-500"
                        >
                          Return to Dashboard
                        </Link>
                      </div>
                    </div>
                  }
                />
              </Routes>
            </Suspense>
            
            <Toast />
          </div>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;