// Dashboard page following React 18 documentation patterns
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card';
import { useNavigate } from 'react-router-dom';

export function DashboardPage() {
  const { user, logout, isLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      showToast({
        type: 'success',
        message: 'Logged out successfully',
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Error logging out',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Healthcare Portal
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {user?.firstName} {user?.lastName}
              </span>
              
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user?.role === 'admin' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {user?.role}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Welcome Card */}
            <Card>
              <CardHeader>
                <CardTitle>Welcome Back!</CardTitle>
                <CardDescription>
                  You're logged in as {user?.role}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>Email:</strong> {user?.email}
                  </p>
                  <p className="text-sm">
                    <strong>Username:</strong> {user?.username}
                  </p>
                  <p className="text-sm">
                    <strong>Last Login:</strong> {
                      user?.lastLoginAt 
                        ? new Date(user.lastLoginAt).toLocaleString()
                        : 'First login'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Service Logs Card */}
            <Card>
              <CardHeader>
                <CardTitle>Service Logs</CardTitle>
                <CardDescription>
                  Create and manage service entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button 
                    variant="primary" 
                    onClick={() => navigate('/service-log')}
                    className="w-full"
                  >
                    Create Service Log Entry
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/submissions')}
                    className="w-full"
                  >
                    View Submissions & Reports
                  </Button>
                  <p className="text-xs text-gray-500 text-center">
                    ✅ Service logging and reporting ready!
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Admin Tools Card (Admin only) */}
            {user?.role === 'admin' && (
              <Card>
                <CardHeader>
                  <CardTitle>Admin Tools</CardTitle>
                  <CardDescription>
                    Administrative functions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate('/admin/users')}
                    >
                      User Management
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate('/admin/templates')}
                    >
                      Template Management
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => navigate('/submissions')}
                    >
                      View All Submissions
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    ✅ Admin features ready! Phase 7 reporting complete.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Status Card */}
            <Card className="md:col-span-2 lg:col-span-1">
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>
                  Phase 7 Complete - Data Management & Reporting ✅
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm">Authentication System (Phase 1) ✅</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm">Service Logging (Phase 3) ✅</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm">User Management (Phase 4) ✅</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm">Template Management (Phase 5) ✅</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm">Client Fields (Phase 6.5) ✅</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span className="text-sm">Data Management & Reports (Phase 7) ✅</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}