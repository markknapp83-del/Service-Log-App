// Monitoring Dashboard Component following React 18 documentation patterns
import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/useToast';
import { getErrorStatistics } from '@/utils/errorLogger';

interface SystemHealth {
  overall: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: string;
    timestamp: string;
    uptime: number;
  };
  system: {
    memory: {
      usage: number;
      used: number;
      total: number;
    };
    cpu: {
      usage: number;
    };
    database: {
      isConnected: boolean;
      avgResponseTime: number;
    };
  };
  alerts: {
    active: Array<{
      id: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      title: string;
      timestamp: string;
    }>;
    hasActiveCritical: boolean;
  };
  performance: {
    requests: {
      total: number;
      successful: number;
      failed: number;
      avgResponseTime: number;
    };
    endpoints: Array<{
      endpoint: string;
      count: number;
      avgTime: number;
      errorRate: number;
    }>;
  };
  issues: string[];
}

interface MonitoringDashboardProps {
  className?: string;
  refreshInterval?: number;
  showClientErrors?: boolean;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  className = '',
  refreshInterval = 30000, // 30 seconds
  showClientErrors = true
}) => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { showToast } = useToast();

  // Fetch system health data
  const fetchSystemHealth = async () => {
    try {
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const authToken = localStorage.getItem('authToken');
      
      const response = await fetch(`${baseURL}/health/detailed`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();
      setSystemHealth(data.data);
      setError(null);
      setLastRefresh(new Date());

      // Show toast for critical issues
      if (data.data.alerts.hasActiveCritical) {
        showToast({
          type: 'error',
          message: 'Critical system alerts detected! Check monitoring dashboard.',
          duration: 10000
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch system health';
      setError(errorMessage);
      console.error('System health fetch error:', err);

      // Show error toast
      showToast({
        type: 'error',
        message: 'Failed to load system health data',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  // Setup automatic refresh
  useEffect(() => {
    fetchSystemHealth();
    
    const interval = setInterval(fetchSystemHealth, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Get client-side error statistics
  const clientErrorStats = useMemo(() => {
    if (!showClientErrors) return null;
    return getErrorStatistics();
  }, [showClientErrors, lastRefresh]);

  // Status color mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'unhealthy': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Severity color mapping
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-blue-600 bg-blue-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading system health...</span>
        </div>
      </div>
    );
  }

  if (error && !systemHealth) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="text-center text-red-600">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold mb-2">Monitoring Unavailable</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchSystemHealth}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall System Status */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">System Health</h2>
          <div className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
        
        {systemHealth && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Overall Status */}
            <div className={`p-4 rounded-lg border ${getStatusColor(systemHealth.overall.status)}`}>
              <div className="text-2xl font-bold capitalize">{systemHealth.overall.status}</div>
              <div className="text-sm opacity-75">Overall Status</div>
            </div>

            {/* Uptime */}
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <div className="text-2xl font-bold">{Math.floor(systemHealth.overall.uptime / 3600)}h</div>
              <div className="text-sm text-gray-600">Uptime</div>
            </div>

            {/* Response Time */}
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
              <div className="text-2xl font-bold">{systemHealth.overall.responseTime}</div>
              <div className="text-sm text-gray-600">Response Time</div>
            </div>

            {/* Active Alerts */}
            <div className={`p-4 rounded-lg border ${
              systemHealth.alerts.hasActiveCritical ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="text-2xl font-bold">{systemHealth.alerts.active.length}</div>
              <div className="text-sm text-gray-600">Active Alerts</div>
            </div>
          </div>
        )}
      </div>

      {/* System Metrics */}
      {systemHealth?.system && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Metrics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Memory Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                <span className="text-sm text-gray-500">{systemHealth.system.memory.usage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    systemHealth.system.memory.usage > 80 ? 'bg-red-500' :
                    systemHealth.system.memory.usage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(systemHealth.system.memory.usage, 100)}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(systemHealth.system.memory.used / 1024 / 1024)} MB / 
                {Math.round(systemHealth.system.memory.total / 1024 / 1024)} MB
              </div>
            </div>

            {/* CPU Usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                <span className="text-sm text-gray-500">{systemHealth.system.cpu.usage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    systemHealth.system.cpu.usage > 80 ? 'bg-red-500' :
                    systemHealth.system.cpu.usage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(systemHealth.system.cpu.usage, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Database Status */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Database</span>
                <span className={`text-sm px-2 py-1 rounded-full ${
                  systemHealth.system.database.isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {systemHealth.system.database.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Avg Response: {systemHealth.system.database.avgResponseTime}ms
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        {systemHealth?.alerts.active.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Alerts</h3>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {systemHealth.alerts.active.map((alert) => (
                <div key={alert.id} className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-xs opacity-75">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-xs uppercase font-medium mt-1">
                    {alert.severity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Summary */}
        {systemHealth?.performance && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Requests</span>
                <span className="font-medium">{systemHealth.performance.requests.total}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className={`font-medium ${
                  (systemHealth.performance.requests.successful / systemHealth.performance.requests.total * 100) > 95 ? 
                  'text-green-600' : 'text-yellow-600'
                }`}>
                  {((systemHealth.performance.requests.successful / systemHealth.performance.requests.total) * 100).toFixed(1)}%
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg Response Time</span>
                <span className="font-medium">{systemHealth.performance.requests.avgResponseTime}ms</span>
              </div>

              {/* Top Endpoints */}
              {systemHealth.performance.endpoints.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Top Endpoints</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {systemHealth.performance.endpoints.slice(0, 5).map((endpoint, index) => (
                      <div key={index} className="flex justify-between text-xs">
                        <span className="text-gray-600 truncate">{endpoint.endpoint}</span>
                        <span className="text-gray-500">{endpoint.count} ({endpoint.avgTime}ms)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Client-Side Errors */}
        {showClientErrors && clientErrorStats && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Errors</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Client Errors</span>
                <span className="font-medium">{clientErrorStats.totalErrors}</span>
              </div>
              
              {/* Error breakdown by level */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">By Severity</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-red-600">Critical</span>
                    <span>{clientErrorStats.errorsByLevel.critical}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-600">High</span>
                    <span>{clientErrorStats.errorsByLevel.high}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-600">Medium</span>
                    <span>{clientErrorStats.errorsByLevel.medium}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Low</span>
                    <span>{clientErrorStats.errorsByLevel.low}</span>
                  </div>
                </div>
              </div>

              {/* Recent errors */}
              {clientErrorStats.recentErrors.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Recent Errors</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {clientErrorStats.recentErrors.slice(0, 3).map((error, index) => (
                      <div key={index} className="text-xs">
                        <div className="font-medium text-gray-700 truncate">{error.error.message}</div>
                        <div className="text-gray-500">
                          {error.context.page} • {new Date(error.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* System Issues */}
        {systemHealth?.issues.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Issues</h3>
            
            <div className="space-y-2">
              {systemHealth.issues.map((issue, index) => (
                <div key={index} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  {issue}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={fetchSystemHealth}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </button>
          
          <button
            onClick={() => window.open('/api/health/detailed', '_blank')}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            View Raw Data
          </button>
          
          {showClientErrors && (
            <button
              onClick={() => {
                const stats = getErrorStatistics();
                console.log('Client Error Statistics:', stats);
                showToast({
                  type: 'info',
                  message: 'Client error stats logged to console',
                  duration: 3000
                });
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              Export Client Errors
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonitoringDashboard;