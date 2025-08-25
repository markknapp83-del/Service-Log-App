// Dashboard page following React 18 documentation patterns with performance optimizations
import React, { useState, useEffect, useCallback, useMemo, memo, Suspense, lazy, startTransition } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/Card';
import { useNavigate, Link } from 'react-router-dom';

// Lazy load heavy components
const EntityModal = lazy(() => 
  import('@/components/EntityModal').then(module => ({ default: module.EntityModal }))
);

const AnalyticsDashboard = lazy(() => 
  import('@/components/AnalyticsDashboard').then(module => ({ default: module.AnalyticsDashboard }))
);

// Loading component
const ComponentLoader = memo(() => (
  <div className="animate-pulse">
    <div className="h-32 bg-gray-200 rounded mb-4"></div>
  </div>
));

ComponentLoader.displayName = 'ComponentLoader';

export const DashboardPage = memo(() => {
  const { user, logout, isLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Quick Add state management
  const [entityCounts, setEntityCounts] = useState({
    clients: 0,
    activities: 0,
    outcomes: 0
  });
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [quickAddEntityType, setQuickAddEntityType] = useState<'clients' | 'activities' | 'outcomes' | null>(null);

  // Memoized logout handler
  const handleLogout = useCallback(async () => {
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
  }, [logout, showToast]);

  // Memoized load entity counts for Quick Add section
  const loadEntityCounts = useCallback(async () => {
    try {
      const token = localStorage.getItem('healthcare_portal_token');
      const [clientsRes, activitiesRes, outcomesRes] = await Promise.all([
        fetch('/api/admin/templates/clients', { headers: { 'Authorization': `Bearer ${token}` }}),
        fetch('/api/admin/templates/activities', { headers: { 'Authorization': `Bearer ${token}` }}),
        fetch('/api/admin/templates/outcomes', { headers: { 'Authorization': `Bearer ${token}` }})
      ]);

      const [clientsData, activitiesData, outcomesData] = await Promise.all([
        clientsRes.json(), activitiesRes.json(), outcomesRes.json()
      ]);

      startTransition(() => {
        setEntityCounts({
          clients: clientsData.success ? clientsData.data.length : 0,
          activities: activitiesData.success ? activitiesData.data.length : 0,
          outcomes: outcomesData.success ? outcomesData.data.length : 0
        });
      });
    } catch (error) {
      // Silent failure for entity counts - doesn't break dashboard
      console.warn('Failed to load entity counts:', error);
    }
  }, []);

  // Memoized Quick Add handlers
  const handleQuickAdd = useCallback((entityType: 'clients' | 'activities' | 'outcomes') => {
    setQuickAddEntityType(entityType);
    setQuickAddModalOpen(true);
  }, []);

  const handleQuickAddSuccess = useCallback(() => {
    loadEntityCounts(); // Refresh counts after successful creation
    showToast({
      type: 'success',
      message: `New ${quickAddEntityType?.slice(0, -1)} added successfully`,
    });
  }, [loadEntityCounts, quickAddEntityType, showToast]);

  // Load entity counts when user is admin
  useEffect(() => {
    if (user?.role === 'admin') {
      loadEntityCounts();
    }
  }, [user?.role]);

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
      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {/* Welcome Section */}
          <div className="mb-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
              <div className="animate-fade-in">
                <h1 className="text-4xl font-bold text-healthcare-text-primary font-display mb-2">
                  Welcome back, {user?.firstName}! 👋
                </h1>
                <p className="text-lg text-healthcare-text-secondary">
                  Ready to manage your healthcare services today.
                </p>
              </div>
              <div className="mt-4 lg:mt-0 flex items-center gap-3">
                <div className="bg-gradient-to-r from-primary/10 to-healthcare-accent/10 rounded-2xl px-4 py-2">
                  <span className="text-sm font-medium text-primary">
                    {user?.role === 'admin' ? '👑 Administrator' : '📋 Service Provider'}
                  </span>
                </div>
                {user?.lastLoginAt && (
                  <div className="text-xs text-healthcare-text-muted">
                    Last seen: {new Date(user.lastLoginAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions Section */}
          <div className="mb-10">
            <h2 className="text-2xl font-semibold text-healthcare-text-primary font-display mb-6">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Primary Action Card - Create Service Log */}
              <Card variant="interactive" className="lg:col-span-2 gradient-primary text-white border-0 animate-slide-up">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-5xl mb-3">📋</div>
                      <h3 className="text-xl font-semibold mb-2">Create Service Log</h3>
                      <p className="text-white/80 text-sm mb-4">
                        Record new patient services and track outcomes
                      </p>
                      <Button 
                        variant="secondary" 
                        onClick={() => navigate('/service-log')}
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                      >
                        Start New Entry
                      </Button>
                    </div>
                    <div className="opacity-10 text-8xl">📊</div>
                  </div>
                </CardContent>
              </Card>

              {/* View Reports */}
              <Card variant="interactive" className="hover:border-healthcare-accent/30 animate-slide-up animation-delay-100">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-healthcare-accent/10 text-healthcare-accent mb-4">
                    <span className="text-2xl">📈</span>
                  </div>
                  <h3 className="font-semibold text-healthcare-text-primary mb-2">View Reports</h3>
                  <p className="text-sm text-healthcare-text-secondary mb-4">
                    Access submissions and analytics
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/submissions')}
                    className="w-full"
                  >
                    View Reports
                  </Button>
                </CardContent>
              </Card>

              {/* System Status */}
              <Card variant="default" className="border-healthcare-success/20 animate-slide-up animation-delay-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-healthcare-success/10 text-healthcare-success mb-4">
                    <span className="text-2xl">✅</span>
                  </div>
                  <h3 className="font-semibold text-healthcare-text-primary mb-2">All Systems</h3>
                  <p className="text-sm text-healthcare-text-secondary mb-4">
                    Platform running smoothly
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-healthcare-success rounded-full animate-pulse"></div>
                    <span className="text-xs text-healthcare-success font-medium">Active</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Admin Section */}
          {user?.role === 'admin' && (
            <div className="mb-10">
              <h2 className="text-2xl font-semibold text-healthcare-text-primary font-display mb-6 flex items-center gap-2">
                <span className="text-2xl">⚙️</span>
                Admin Tools
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* User Management */}
                <Card variant="interactive" className="group animate-slide-up">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                        <span className="text-2xl">👥</span>
                      </div>
                      <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">
                        Admin
                      </span>
                    </div>
                    <h3 className="font-semibold text-healthcare-text-primary mb-2 group-hover:text-primary transition-colors">
                      User Management
                    </h3>
                    <p className="text-sm text-healthcare-text-secondary mb-4">
                      Manage user accounts and permissions
                    </p>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate('/admin/users')}
                      className="w-full justify-start"
                    >
                      Manage Users →
                    </Button>
                  </CardContent>
                </Card>

                {/* Template Management */}
                <Card variant="interactive" className="group animate-slide-up animation-delay-100">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-healthcare-accent/10 text-healthcare-accent group-hover:scale-110 transition-transform">
                        <span className="text-2xl">📝</span>
                      </div>
                      <span className="text-xs px-2 py-1 bg-healthcare-accent/10 text-healthcare-accent rounded-full font-medium">
                        Templates
                      </span>
                    </div>
                    <h3 className="font-semibold text-healthcare-text-primary mb-2 group-hover:text-healthcare-accent transition-colors">
                      Templates
                    </h3>
                    <p className="text-sm text-healthcare-text-secondary mb-4">
                      Configure clients, activities & outcomes
                    </p>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate('/admin/templates')}
                      className="w-full justify-start"
                    >
                      Manage Templates →
                    </Button>
                  </CardContent>
                </Card>

                {/* Quick Add */}
                <Card variant="default" className="animate-slide-up animation-delay-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-healthcare-warning/10 text-healthcare-warning mb-4">
                      <span className="text-2xl">⚡</span>
                    </div>
                    <h3 className="font-semibold text-healthcare-text-primary mb-4">Quick Add</h3>
                    
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <Button 
                        variant="outline" 
                        size="xs"
                        onClick={() => handleQuickAdd('clients')}
                        className="text-xs"
                      >
                        Client
                        {entityCounts.clients > 0 && (
                          <span className="ml-1 text-healthcare-text-muted">({entityCounts.clients})</span>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="xs"
                        onClick={() => handleQuickAdd('activities')}
                        className="text-xs"
                      >
                        Activity
                        {entityCounts.activities > 0 && (
                          <span className="ml-1 text-healthcare-text-muted">({entityCounts.activities})</span>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="xs"
                        onClick={() => handleQuickAdd('outcomes')}
                        className="text-xs"
                      >
                        Outcome
                        {entityCounts.outcomes > 0 && (
                          <span className="ml-1 text-healthcare-text-muted">({entityCounts.outcomes})</span>
                        )}
                      </Button>
                    </div>
                    
                    <p className="text-xs text-healthcare-text-muted text-center">
                      For full control: <Link to="/admin/templates" className="text-primary hover:underline">Templates</Link>
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Platform Status */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-healthcare-text-primary font-display mb-6 flex items-center gap-2">
              <span className="text-2xl">🚀</span>
              Platform Status
            </h2>
            <Card variant="default" className="animate-slide-up">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                  {[
                    { label: 'Authentication', phase: '1', status: 'active' },
                    { label: 'Service Logging', phase: '3', status: 'active' },
                    { label: 'User Management', phase: '4', status: 'active' },
                    { label: 'Templates', phase: '5', status: 'active' },
                    { label: 'Client Fields', phase: '6.5', status: 'active' },
                    { label: 'Reporting', phase: '7', status: 'active' },
                  ].map((item, index) => (
                    <div key={item.phase} className="flex flex-col items-center text-center group">
                      <div className="w-12 h-12 rounded-full bg-healthcare-success/10 flex items-center justify-center mb-2 group-hover:bg-healthcare-success/20 transition-colors">
                        <div className="w-3 h-3 bg-healthcare-success rounded-full animate-pulse"></div>
                      </div>
                      <span className="text-sm font-medium text-healthcare-text-primary">{item.label}</span>
                      <span className="text-xs text-healthcare-text-muted">Phase {item.phase}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-healthcare-success/5 rounded-xl border border-healthcare-success/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-healthcare-success rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-healthcare-success">All systems operational</span>
                  </div>
                  <p className="text-xs text-healthcare-text-muted mt-1">
                    Healthcare Portal v7.0 - Full reporting and data management capabilities enabled
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Quick Add Entity Modal with lazy loading */}
      {quickAddEntityType && (
        <Suspense fallback={<ComponentLoader />}>
          <EntityModal
            isOpen={quickAddModalOpen}
            onClose={() => setQuickAddModalOpen(false)}
            onSuccess={handleQuickAddSuccess}
            entityType={quickAddEntityType}
            entity={null} // Always creating new entities from dashboard
          />
        </Suspense>
      )}
    </div>
  );
});

DashboardPage.displayName = 'DashboardPage';