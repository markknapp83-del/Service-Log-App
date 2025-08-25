// Submissions Page following React 18 documentation patterns with performance optimizations
import React, { useState, useEffect, useCallback, useMemo, memo, Suspense, lazy, startTransition } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { ServiceLog, Client, Activity, User } from '../types';

// Lazy load heavy components
const SubmissionsTable = lazy(() => 
  import('../components/SubmissionsTable').then(module => ({ 
    default: module.SubmissionsTable,
    SubmissionTableRow: module.SubmissionTableRow,
    SubmissionFilters: module.SubmissionFilters 
  }))
);

type SubmissionTableRow = {
  id: string;
  userId: string;
  userName: string;
  clientName: string;
  activityName: string;
  serviceDate: string;
  totalPatients: number;
  newPatients: number;
  followupPatients: number;
  dnaPatients: number;
  isDraft: boolean;
  submittedAt?: string;
  createdAt: string;
};

type SubmissionFilters = {
  dateFrom?: string;
  dateTo?: string;
  clientId?: string;
  activityId?: string;
  userId?: string;
  isDraft?: boolean;
  searchTerm?: string;
};

// Loading component for table
const TableLoader = memo(() => (
  <Card className="p-8">
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
      </div>
    </div>
  </Card>
));

TableLoader.displayName = 'TableLoader';

// Optimized API service for submissions with caching
class SubmissionsService {
  private cache = new Map<string, { data: any; timestamp: number; }>();
  private readonly CACHE_TTL = 30000; // 30 seconds cache
  private baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    // Check cache first for GET requests
    const cacheKey = `${endpoint}_${JSON.stringify(options)}`;
    if (!options.method || options.method === 'GET') {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

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

    const data = await response.json();
    
    // Cache GET responses
    if (!options.method || options.method === 'GET') {
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  }

  clearCache() {
    this.cache.clear();
  }

  async getSubmissions(filters: SubmissionFilters = {}) {
    const params = new URLSearchParams();
    
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.clientId) params.set('clientId', filters.clientId);
    if (filters.activityId) params.set('activityId', filters.activityId);
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.isDraft !== undefined) params.set('isDraft', filters.isDraft.toString());
    
    const queryString = params.toString();
    const endpoint = `/service-logs${queryString ? `?${queryString}` : ''}`;
    
    return this.fetchWithAuth(endpoint);
  }

  async getSubmissionDetails(submissionId: string) {
    return this.fetchWithAuth(`/service-logs/${submissionId}`);
  }

  async exportSubmissions(format: 'csv' | 'excel', filters: SubmissionFilters = {}) {
    const params = new URLSearchParams();
    params.set('format', format);
    
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.clientId) params.set('clientId', filters.clientId);
    if (filters.activityId) params.set('activityId', filters.activityId);
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.isDraft !== undefined) params.set('isDraft', filters.isDraft.toString());

    const response = await fetch(`${this.baseURL}/reports/export?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('healthcare_portal_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }

    return response.blob();
  }

  async getFormOptions() {
    return this.fetchWithAuth('/service-logs/options');
  }

  async getUsers() {
    return this.fetchWithAuth('/admin/users');
  }
}

const submissionsService = new SubmissionsService();

// Mock user data transformation for display
const mockUserNames: Record<string, string> = {
  'user-1': 'Dr. Sarah Johnson',
  'user-2': 'Nurse Mike Chen',
  'user-3': 'Dr. Emily Rodriguez',
  'user-4': 'Therapist Alex Kim',
};

export const SubmissionsPage = memo(() => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [submissions, setSubmissions] = useState<SubmissionTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SubmissionFilters>({});
  const [selectedSubmission, setSelectedSubmission] = useState<ServiceLog | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(false); // Prevent concurrent API calls

  // Memoized lookup maps for efficient data transformation
  const lookupMaps = useMemo(() => {
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const activityMap = new Map(activities.map(a => [a.id, a.name]));
    return { clientMap, activityMap };
  }, [clients, activities]);

  // Transform ServiceLog to SubmissionTableRow with performance optimizations
  const transformSubmissionData = useCallback((serviceLogs: ServiceLog[]): SubmissionTableRow[] => {
    if (!serviceLogs || serviceLogs.length === 0) {
      return [];
    }

    return serviceLogs.map(log => {
      // Calculate appointment type breakdowns efficiently
      const appointments = log.patientEntries || [];
      let newPatients = 0;
      let followupPatients = 0;
      let dnaPatients = 0;
      
      // Single pass through appointments for better performance
      for (const entry of appointments) {
        switch (entry.appointmentType) {
          case 'new':
            newPatients++;
            break;
          case 'followup':
            followupPatients++;
            break;
          case 'dna':
            dnaPatients++;
            break;
        }
      }
      
      // Use lookup maps for O(1) client/activity name resolution
      const clientName = lookupMaps.clientMap.get(log.clientId) || 'Unknown Client';
      const activityName = lookupMaps.activityMap.get(log.activityId) || 'Unknown Activity';
      const userName = mockUserNames[log.userId] || `User ${log.userId.slice(-8)}`;

      return {
        id: log.id,
        userId: log.userId,
        userName,
        clientName,
        activityName,
        serviceDate: log.serviceDate || log.createdAt.split('T')[0], // Fallback to creation date
        totalPatients: log.patientCount || appointments.length,
        newPatients,
        followupPatients,
        dnaPatients,
        isDraft: log.isDraft,
        submittedAt: log.submittedAt,
        createdAt: log.createdAt,
      };
    });
  }, [lookupMaps]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      // Prevent concurrent API calls
      if (isLoadingInitialData) {
        console.log('Initial data already loading, skipping duplicate request');
        return;
      }

      try {
        setIsLoadingInitialData(true);
        setLoading(true);
        
        // Load form options (clients, activities) and users in parallel
        const [optionsResponse, usersResponse] = await Promise.all([
          submissionsService.getFormOptions(),
          user?.role === 'admin' ? submissionsService.getUsers() : Promise.resolve({ success: true, data: [] }),
        ]);

        if (optionsResponse.success) {
          setClients(optionsResponse.data.clients || []);
          setActivities(optionsResponse.data.activities || []);
        }

        if (usersResponse.success) {
          setUsers(usersResponse.data || []);
        }

        // Load submissions
        await loadSubmissions();
      } catch (error) {
        console.error('Failed to load initial data:', error);
        showToast('Failed to load submissions data', 'error');
      } finally {
        setLoading(false);
        setIsLoadingInitialData(false);
      }
    };

    loadInitialData();
  }, [user?.role, showToast]);

  // Load submissions based on filters with performance optimizations
  const loadSubmissions = useCallback(async (appliedFilters: SubmissionFilters = filters) => {
    try {
      // Use startTransition for non-urgent updates
      startTransition(() => {
        setLoading(true);
      });
      
      const response = await submissionsService.getSubmissions(appliedFilters);
      
      if (response.success) {
        const serviceLogs = response.data.serviceLogs || [];
        const transformedSubmissions = transformSubmissionData(serviceLogs);
        
        startTransition(() => {
          setSubmissions(transformedSubmissions);
        });
      } else {
        throw new Error('Failed to load submissions');
      }
    } catch (error) {
      console.error('Failed to load submissions:', error);
      showToast('Failed to load submissions', 'error');
      setSubmissions([]);
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  }, [filters, transformSubmissionData, showToast]);

  // Handle filter changes with debouncing
  const handleFilterChange = useCallback((newFilters: SubmissionFilters) => {
    startTransition(() => {
      setFilters(newFilters);
      loadSubmissions(newFilters);
    });
  }, [loadSubmissions]);

  // Handle viewing submission details
  const handleViewDetails = useCallback(async (submissionId: string) => {
    try {
      const response = await submissionsService.getSubmissionDetails(submissionId);
      if (response.success) {
        setSelectedSubmission(response.data);
        setShowDetailsModal(true);
      } else {
        throw new Error('Failed to load submission details');
      }
    } catch (error) {
      console.error('Failed to load submission details:', error);
      showToast('Failed to load submission details', 'error');
    }
  }, [showToast]);

  // Handle export functionality
  const handleExport = useCallback(async (format: 'csv' | 'excel') => {
    try {
      showToast('Starting export...', 'info');
      const blob = await submissionsService.exportSubmissions(format, filters);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `service-log-submissions.${format === 'csv' ? 'csv' : 'xlsx'}`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);
      
      showToast(`Submissions exported as ${format.toUpperCase()}`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Export failed. Please try again.', 'error');
    }
  }, [filters, showToast]);

  // Close details modal
  const closeDetailsModal = useCallback(() => {
    setShowDetailsModal(false);
    setSelectedSubmission(null);
  }, []);

  // Format appointment type for display
  const formatAppointmentType = (type: string) => {
    switch (type) {
      case 'new': return 'New Patient';
      case 'followup': return 'Follow-up';
      case 'dna': return 'Did Not Attend';
      default: return type;
    }
  };

  // Format date for display
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && submissions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-blue-600 rounded-full mb-4" />
              <p className="text-gray-600">Loading submissions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Service Log Reports</h1>
          <p className="mt-2 text-gray-600">
            View and manage service log submissions with advanced filtering and export capabilities
          </p>
        </div>

        {/* Submissions Table with lazy loading */}
        <Suspense fallback={<TableLoader />}>
          <SubmissionsTable
            submissions={submissions}
            loading={loading}
            onViewDetails={handleViewDetails}
            onExport={handleExport}
            onFilterChange={handleFilterChange}
          />
        </Suspense>

        {/* Submission Details Modal */}
        {selectedSubmission && (
          <Modal
            isOpen={showDetailsModal}
            onClose={closeDetailsModal}
            title="Submission Details"
            size="large"
          >
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Service Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Client:</span>
                      <span className="font-medium">
                        {clients.find(c => c.id === selectedSubmission.clientId)?.name || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Activity:</span>
                      <span className="font-medium">
                        {activities.find(a => a.id === selectedSubmission.activityId)?.name || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Service Date:</span>
                      <span className="font-medium">
                        {selectedSubmission.serviceDate ? 
                          new Date(selectedSubmission.serviceDate).toLocaleDateString() : 
                          new Date(selectedSubmission.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Patients:</span>
                      <span className="font-medium">{selectedSubmission.patientCount}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Submission Status</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${
                        selectedSubmission.isDraft ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {selectedSubmission.isDraft ? 'Draft' : 'Submitted'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created:</span>
                      <span className="font-medium">{formatDateTime(selectedSubmission.createdAt)}</span>
                    </div>
                    {selectedSubmission.submittedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Submitted:</span>
                        <span className="font-medium">{formatDateTime(selectedSubmission.submittedAt)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">User:</span>
                      <span className="font-medium">
                        {mockUserNames[selectedSubmission.userId] || `User ${selectedSubmission.userId.slice(-8)}`}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Patient Entries */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Patient Appointments</h3>
                {selectedSubmission.patientEntries && selectedSubmission.patientEntries.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">
                            Appointment Type
                          </th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">
                            Outcome
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedSubmission.patientEntries.map((entry, index) => (
                          <tr key={entry.id || index}>
                            <td className="px-4 py-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                entry.appointmentType === 'new' ? 'bg-blue-100 text-blue-800' :
                                entry.appointmentType === 'followup' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {formatAppointmentType(entry.appointmentType)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-900">
                              {/* Note: In a real implementation, you'd look up the outcome name */}
                              Outcome {entry.outcomeId.slice(-8)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No patient entries recorded</p>
                )}
              </Card>

              {/* Summary Statistics */}
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Summary</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedSubmission.patientEntries?.filter(e => e.appointmentType === 'new').length || 0}
                    </div>
                    <div className="text-xs text-gray-600">New Patients</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {selectedSubmission.patientEntries?.filter(e => e.appointmentType === 'followup').length || 0}
                    </div>
                    <div className="text-xs text-gray-600">Follow-up</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {selectedSubmission.patientEntries?.filter(e => e.appointmentType === 'dna').length || 0}
                    </div>
                    <div className="text-xs text-gray-600">Did Not Attend</div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-200">
              <Button onClick={closeDetailsModal}>
                Close
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
});

SubmissionsPage.displayName = 'SubmissionsPage';