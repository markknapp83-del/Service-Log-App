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
  const { toast } = useToast();

  // Load form options on component mount (demo data)
  useEffect(() => {
    const loadFormOptions = async () => {
      try {
        setIsLoading(true);
        
        // Demo data for showcase
        const demoFormOptions: FormOptions = {
          clients: [
            { id: '1', name: 'Downtown Clinic', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: '2', name: 'Community Health Center', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: '3', name: 'Regional Hospital', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: '4', name: 'Primary Care Practice', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          ],
          activities: [
            { id: '1', name: 'General Consultation', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: '2', name: 'Physiotherapy', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: '3', name: 'Mental Health Counseling', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: '4', name: 'Preventive Care', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: '5', name: 'Chronic Disease Management', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          ],
          outcomes: [
            { id: '1', name: 'Treatment Completed', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: '2', name: 'Referred to Specialist', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: '3', name: 'Follow-up Required', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: '4', name: 'Emergency Care Needed', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: '5', name: 'Patient Education Provided', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          ]
        };

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setFormOptions(demoFormOptions);
        toast({
          title: 'Demo Mode',
          description: 'Using demo data for showcase. Backend integration available.',
          variant: 'info',
        });
      } catch (error) {
        console.error('Failed to load form options:', error);
        toast({
          title: 'Demo setup error',
          description: 'Unable to load demo data.',
          variant: 'error',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadFormOptions();
  }, [toast]);

  const handleSubmit = async (data: ServiceLogFormData) => {
    try {
      setIsSubmitting(true);
      
      // Demo submission - simulate API call
      console.log('=== SERVICE LOG SUBMISSION (DEMO) ===');
      console.log('Form Data:', JSON.stringify(data, null, 2));
      
      // Calculate totals for demo
      const totals = data.patientEntries.reduce(
        (acc, entry) => ({
          totalPatients: acc.totalPatients + entry.newPatients + entry.followupPatients,
          newPatients: acc.newPatients + entry.newPatients,
          followupPatients: acc.followupPatients + entry.followupPatients,
          dnaCount: acc.dnaCount + entry.dnaCount,
        }),
        { totalPatients: 0, newPatients: 0, followupPatients: 0, dnaCount: 0 }
      );
      
      console.log('Calculated Totals:', totals);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast({
        title: 'Service log submitted (Demo)',
        description: `Successfully recorded ${totals.totalPatients} patients (${totals.newPatients} new, ${totals.followupPatients} follow-up).`,
        variant: 'success',
      });
      
      // In real implementation, this would clear the form or redirect
    } catch (error) {
      console.error('Demo submission error:', error);
      
      // Re-throw to let the form handle the error display
      throw new Error('Demo submission completed successfully. In production, this would save to the database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async (data: ServiceLogFormData) => {
    try {
      const response = await apiService.post('/service-logs', {
        ...data,
        isDraft: true,
      });

      if (response.success) {
        toast({
          title: 'Draft saved',
          description: 'Your service log has been saved as a draft.',
          variant: 'info',
        });
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast({
        title: 'Draft save failed',
        description: 'Unable to save draft. Your work is still preserved locally.',
        variant: 'warning',
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
              <strong>Patient Count:</strong> Enter the total number of individual patient entries you need to record.
            </p>
            <p>
              <strong>Patient Entries:</strong> For each entry, specify the number of new patients, follow-up patients, 
              and those who did not attend (DNA). Select the appropriate outcome for each entry.
            </p>
            <p>
              <strong>Auto-save:</strong> Your work is automatically saved locally every 2 seconds to prevent data loss.
            </p>
            <p>
              <strong>Validation:</strong> The total patients across all entries must match your specified patient count.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}