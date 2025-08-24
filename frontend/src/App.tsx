// Main App component following React 18 documentation patterns
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ServiceLogPage } from './pages/ServiceLogPage';
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
              path="/admin/*"
              element={
                <ProtectedRoute requiredRole="admin">
                  <div className="p-4">
                    <h1 className="text-2xl font-bold">Admin Panel</h1>
                    <p>Admin functionality will be implemented in future phases.</p>
                  </div>
                </ProtectedRoute>
              }
            />
            
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Catch-all route */}
            <Route
              path="*"
              element={
                <div className="min-h-screen flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                    <p className="text-gray-600 mb-4">Page not found</p>
                    <a
                      href="/dashboard"
                      className="text-blue-600 hover:text-blue-500"
                    >
                      Return to Dashboard
                    </a>
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