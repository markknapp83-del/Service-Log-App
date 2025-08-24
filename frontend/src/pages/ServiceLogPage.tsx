// Service Log Page following React 18 patterns
import React, { useState, useEffect } from 'react';
import { ServiceLogForm } from '../components/ServiceLogForm';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useToast } from '../hooks/useToast';
import { apiService } from '../services/apiService';
import { 
  ServiceLogFormData, 
  Client, 
  Activity, 
  Outcome,
  ApiResponse 
} from '../types';

interface FormOptions {
  clients: Client[];
  activities: Activity[];
  outcomes: Outcome[];
}

export function ServiceLogPage() {
  const [formOptions, setFormOptions] = useState<FormOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoModeShown, setDemoModeShown] = useState(false);
  const { showToast } = useToast();

  // Load form options from real API
  useEffect(() => {
    // Clear localStorage to prevent infinite loops from old draft data
    localStorage.removeItem('serviceLogDraft');
    
    const loadFormOptions = async () => {
      try {
        setIsLoading(true);
        
        // Use real API endpoint for form options
        const response = await apiService.get('/service-logs/options');
        
        if (response.success) {
          setFormOptions(response.data);
          
          if (!demoModeShown) {
            showToast({
              type: 'success',
              message: 'Form options loaded: Ready to create service log entries.',
            });
            setDemoModeShown(true);
          }
        } else {
          throw new Error(response.error?.message || 'Failed to load form options');
        }
      } catch (error) {
        console.error('Failed to load form options:', error);
        showToast({
          type: 'error',
          message: `Failed to load form options: ${error instanceof Error ? error.message : 'Please refresh to try again.'}`,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadFormOptions();
  }, []); // Remove showToast dependency to prevent infinite loop

  const handleSubmit = async (data: ServiceLogFormData) => {
    try {
      setIsSubmitting(true);
      
      
      // Submit to real API
      const response = await apiService.post('/service-logs', {
        clientId: data.clientId,
        activityId: data.activityId,
        serviceDate: data.serviceDate,
        patientCount: data.patientCount,
        patientEntries: data.patientEntries,
        isDraft: false
      });
      
      if (response.success) {
        // Calculate totals for display using new appointment type structure
        const totals = data.patientEntries.reduce(
          (acc, entry) => ({
            totalEntries: acc.totalEntries + 1,
            newPatients: acc.newPatients + (entry.appointmentType === 'new' ? 1 : 0),
            followupPatients: acc.followupPatients + (entry.appointmentType === 'followup' ? 1 : 0),
            dnaCount: acc.dnaCount + (entry.appointmentType === 'dna' ? 1 : 0),
          }),
          { totalEntries: 0, newPatients: 0, followupPatients: 0, dnaCount: 0 }
        );
        

        showToast({
          type: 'success',
          message: `Service log saved successfully: Recorded ${totals.totalEntries} patient entries (${totals.newPatients} new, ${totals.followupPatients} follow-up, ${totals.dnaCount} DNA) on ${data.serviceDate}.`,
        });
        
        // Clear the form after successful submission
        // The form component will handle this via the success callback
      } else {
        throw new Error(response.error?.message || 'Failed to save service log');
      }
    } catch (error) {
      console.error('Service log submission error:', error);
      
      // Re-throw to let the form handle the error display
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async (data: ServiceLogFormData) => {
    try {
      const response = await apiService.post('/service-logs', {
        clientId: data.clientId,
        activityId: data.activityId,
        serviceDate: data.serviceDate,
        patientCount: data.patientCount,
        patientEntries: data.patientEntries,
        isDraft: true,
      });

      if (response.success) {
        showToast({
          type: 'info',
          message: 'Draft saved: Your service log has been saved as a draft.',
        });
      } else {
        throw new Error(response.error?.message || 'Failed to save draft');
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
      showToast({
        type: 'warning',
        message: `Draft save failed: ${error instanceof Error ? error.message : 'Unable to save draft. Your work is still preserved locally.'}`,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading form...</p>
        </Card>
      </div>
    );
  }

  if (!formOptions) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-2">
            Unable to Load Form
          </h2>
          <p className="text-neutral-600 mb-4">
            There was a problem loading the form data. This might be due to a network issue or server problem.
          </p>
          <Button 
            onClick={() => window.location.reload()}
            variant="primary"
          >
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">
                New Service Log Entry
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Record patient services and outcomes for healthcare tracking.
              </p>
            </div>
            
            <div className="mt-4 sm:mt-0">
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="mr-3"
              >
                Back
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  // Future: Navigate to service log list
                  console.log('Navigate to service logs list');
                }}
              >
                View All Logs
              </Button>
            </div>
          </div>
        </div>

        {/* Form */}
        <ServiceLogForm
          clients={formOptions.clients}
          activities={formOptions.activities}
          outcomes={formOptions.outcomes}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        />

        {/* Instructions */}
        <Card className="mt-8 p-6 bg-blue-50 border-blue-200">
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            Instructions
          </h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>Patient Count:</strong> Enter the total number of individual patient appointment entries you need to record.
            </p>
            <p>
              <strong>Patient Entries:</strong> Each entry represents a single patient appointment. Select the appointment type 
              (New Patient, Follow-up Patient, or Did Not Attend) and choose the appropriate outcome.
            </p>
            <p>
              <strong>Auto-save:</strong> Your work is automatically saved locally every 2 seconds to prevent data loss.
            </p>
            <p>
              <strong>Validation:</strong> The number of patient entries must match your specified patient count.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}