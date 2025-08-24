// Main App component following React 18 documentation patterns
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ServiceLogPage } from './pages/ServiceLogPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { TemplateManagementPage } from './pages/TemplateManagementPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toast } from './components/Toast';

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <div className="min-h-screen bg-healthcare-background">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            
            {/* Service Log Entry */}
            <Route
              path="/service-log"
              element={
                <ProtectedRoute>
                  <ServiceLogPage />
                </ProtectedRoute>
              }
            />
            
            {/* Admin-only routes */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRole="admin">
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/templates"
              element={
                <ProtectedRoute requiredRole="admin">
                  <TemplateManagementPage />
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
          
          <Toast />
          </div>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;