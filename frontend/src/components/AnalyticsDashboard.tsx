// Analytics Dashboard component following React 18 and shadcn/ui documentation patterns
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Select } from './Select';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

// Types for analytics data
export interface AnalyticsSummary {
  overview: {
    totalLogs: number;
    totalDrafts: number;
    totalSubmitted: number;
    totalPatients: number;
  };
  appointmentTypes: {
    new: number;
    followup: number;
    dna: number;
  };
  topClients: Array<{
    id: string;
    name: string;
    count: number;
    percentage: number;
  }>;
  topActivities: Array<{
    id: string;
    name: string;
    count: number;
    percentage: number;
  }>;
  outcomes: Array<{
    id: string;
    name: string;
    count: number;
    percentage: number;
  }>;
  dateRange: {
    from: string;
    to: string;
  };
}

export interface AnalyticsDashboardProps {
  className?: string;
}

// API service for analytics
class AnalyticsService {
  private baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('healthcare_portal_token');
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getSummary(filters: Record<string, any> = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value.toString());
      }
    });

    const queryString = params.toString();
    const endpoint = `/reports/summary${queryString ? `?${queryString}` : ''}`;
    
    return this.fetchWithAuth(endpoint);
  }
}

const analyticsService = new AnalyticsService();

export function AnalyticsDashboard({ className = '' }: AnalyticsDashboardProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of current year
    to: new Date().toISOString().split('T')[0], // Today
  });

  // Load analytics summary
  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: Record<string, any> = {
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
      };

      const response = await analyticsService.getSummary(filters);
      
      if (response.success) {
        setSummary(response.data);
      } else {
        throw new Error('Failed to load analytics data');
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics data';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, showToast]);

  // Load initial data
  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Handle date range changes
  const handleDateRangeChange = useCallback((field: 'from' | 'to', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadSummary();
  }, [loadSummary]);

  // Format percentage
  const formatPercentage = useCallback((value: number) => {
    return `${Math.round(value * 10) / 10}%`;
  }, []);

  // Format number with commas
  const formatNumber = useCallback((value: number) => {
    return value.toLocaleString();
  }, []);

  // Calculate completion rate
  const completionRate = useMemo(() => {
    if (!summary || summary.overview.totalLogs === 0) return 0;
    return (summary.overview.totalSubmitted / summary.overview.totalLogs) * 100;
  }, [summary]);

  // Handle loading state
  if (loading) {
    return (
      <div className={`${className} space-y-6`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Handle error state
  if (error || !summary) {
    return (
      <div className={`${className}`}>
        <Card className="p-6 text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold">Unable to load analytics</h3>
            <p className="text-sm text-gray-600 mt-2">
              {error || 'An error occurred while loading the analytics data.'}
            </p>
          </div>
          <Button onClick={handleRefresh}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${className} space-y-6`}>
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h2>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Date Range Filters */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">From:</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => handleDateRangeChange('from', e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">To:</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => handleDateRangeChange('to', e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              />
            </div>

            <Button onClick={handleRefresh} size="sm">
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Service Logs</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.overview.totalLogs)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.overview.totalSubmitted)}</p>
              <p className="text-xs text-green-600">{formatPercentage(completionRate)} completion rate</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Drafts</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.overview.totalDrafts)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Patients</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(summary.overview.totalPatients)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Appointment Types Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Appointment Types</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {formatNumber(summary.appointmentTypes.new)}
            </div>
            <div className="text-sm text-gray-600">New Patients</div>
            <div className="text-xs text-blue-600 mt-1">
              {summary.overview.totalPatients > 0 
                ? formatPercentage((summary.appointmentTypes.new / summary.overview.totalPatients) * 100)
                : '0%'}
            </div>
          </div>
          
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {formatNumber(summary.appointmentTypes.followup)}
            </div>
            <div className="text-sm text-gray-600">Follow-up</div>
            <div className="text-xs text-green-600 mt-1">
              {summary.overview.totalPatients > 0 
                ? formatPercentage((summary.appointmentTypes.followup / summary.overview.totalPatients) * 100)
                : '0%'}
            </div>
          </div>
          
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-3xl font-bold text-red-600 mb-2">
              {formatNumber(summary.appointmentTypes.dna)}
            </div>
            <div className="text-sm text-gray-600">Did Not Attend</div>
            <div className="text-xs text-red-600 mt-1">
              {summary.overview.totalPatients > 0 
                ? formatPercentage((summary.appointmentTypes.dna / summary.overview.totalPatients) * 100)
                : '0%'}
            </div>
          </div>
        </div>
      </Card>

      {/* Top Clients and Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Clients</h3>
          {summary.topClients.length > 0 ? (
            <div className="space-y-3">
              {summary.topClients.map((client, index) => (
                <div key={client.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{client.name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 mr-2">{client.count} logs</span>
                    <span className="text-xs text-blue-600">{formatPercentage(client.percentage)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No client data available</p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Activities</h3>
          {summary.topActivities.length > 0 ? (
            <div className="space-y-3">
              {summary.topActivities.map((activity, index) => (
                <div key={activity.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-900">{activity.name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 mr-2">{activity.count} logs</span>
                    <span className="text-xs text-green-600">{formatPercentage(activity.percentage)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No activity data available</p>
          )}
        </Card>
      </div>

      {/* Date Range Info */}
      <Card className="p-4 bg-gray-50">
        <div className="flex items-center justify-center text-sm text-gray-600">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Data from {new Date(summary.dateRange.from).toLocaleDateString()} to {new Date(summary.dateRange.to).toLocaleDateString()}
        </div>
      </Card>
    </div>
  );
}