// Service Log Form component following documented React Hook Form + Zod patterns
import React, { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Save, RotateCcw } from 'lucide-react';

import { Button } from './Button';
import { Input } from './Input';
import { DatePicker } from './DatePicker';
import { Card } from './Card';
import { Select, SelectOption } from './Select';
import { useToast } from '../hooks/useToast';
import { serviceLogFormSchema, ServiceLogFormData, formatValidationError } from '../utils/validation';
import { 
  ServiceLogFormProps, 
  Client, 
  Activity, 
  Outcome, 
  PatientEntry,
  AppointmentType
} from '../types';
import { cn } from '../utils/cn';

interface ServiceLogFormComponentProps extends ServiceLogFormProps {
  clients: Client[];
  activities: Activity[];
  outcomes: Outcome[];
}

export function ServiceLogForm({
  clients,
  activities,
  outcomes,
  onSubmit,
  onCancel,
  initialData,
  isLoading = false
}: ServiceLogFormComponentProps) {
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const { showToast } = useToast();
  const draftLoadedRef = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    control,
    setValue,
    formState: { errors, isDirty, isSubmitting },
    reset,
    trigger,
  } = useForm<ServiceLogFormData>({
    resolver: zodResolver(serviceLogFormSchema),
    mode: 'onChange',
    defaultValues: {
      clientId: initialData?.clientId || '',
      activityId: initialData?.activityId || '',
      serviceDate: initialData?.serviceDate || '',
      patientCount: initialData?.patientCount || 1,
      patientEntries: initialData?.patientEntries || [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'patientEntries',
  });

  const watchPatientCount = watch('patientCount');
  const watchPatientEntries = watch('patientEntries');

  // Options for dropdowns
  const clientOptions: SelectOption[] = clients
    .filter(client => client.isActive)
    .map(client => ({
      value: client.id,
      label: client.name,
    }));

  const activityOptions: SelectOption[] = activities
    .filter(activity => activity.isActive)
    .map(activity => ({
      value: activity.id,
      label: activity.name,
    }));

  const outcomeOptions: SelectOption[] = outcomes
    .filter(outcome => outcome.isActive)
    .map(outcome => ({
      value: outcome.id,
      label: outcome.name,
    }));

  // Appointment type options
  const appointmentTypeOptions: SelectOption[] = [
    { value: 'new', label: 'New Patient' },
    { value: 'followup', label: 'Follow-up Patient' },
    { value: 'dna', label: 'Did Not Attend (DNA)' },
  ];

  // Generate patient rows based on patient count
  useEffect(() => {
    const currentEntries = watchPatientEntries || [];
    const desiredCount = watchPatientCount || 0;
    
    if (desiredCount > 0 && currentEntries.length !== desiredCount) {
      const newEntries: PatientEntry[] = Array.from({ length: desiredCount }, (_, index) => {
        return currentEntries[index] || {
          appointmentType: 'new' as AppointmentType,
          outcomeId: '',
        };
      });
      replace(newEntries);
    }
  }, [watchPatientCount, replace]);

  // Auto-save draft functionality following documented patterns
  useEffect(() => {
    if (isDirty) {
      const saveTimer = setTimeout(async () => {
        const currentData = watch();
        try {
          setIsDraftSaving(true);
          // Save to localStorage as draft
          localStorage.setItem('serviceLogDraft', JSON.stringify(currentData));
        } catch (error) {
          console.error('Failed to save draft:', error);
        } finally {
          setIsDraftSaving(false);
        }
      }, 2000);

      return () => clearTimeout(saveTimer);
    }
    return undefined;
  }, [watch, isDirty]);

  // Load draft on component mount
  useEffect(() => {
    if (draftLoadedRef.current) return; // Prevent multiple loads
    
    const loadDraft = () => {
      try {
        const draft = localStorage.getItem('serviceLogDraft');
        if (draft && !initialData) {
          // Clear any old draft data that might be causing issues
          localStorage.removeItem('serviceLogDraft');
          console.log('Cleared old draft data to prevent infinite loading');
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
        localStorage.removeItem('serviceLogDraft');
      }
      draftLoadedRef.current = true;
    };

    loadDraft();
  }, [reset, initialData]); // Remove showToast dependency to prevent infinite loop

  const handleFormSubmit = async (data: ServiceLogFormData) => {
    try {
      await onSubmit(data);
      // Clear draft on successful submission
      localStorage.removeItem('serviceLogDraft');
      draftLoadedRef.current = false; // Allow draft loading again
      showToast({
        type: 'success',
        message: 'Service log saved: Your service entry has been successfully recorded.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: `Save failed: ${error instanceof Error ? error.message : 'Please try again.'}`,
      });
    }
  };

  const handleClearForm = () => {
    reset({
      clientId: '',
      activityId: '',
      serviceDate: '',
      patientCount: 1,
      patientEntries: [],
    });
    localStorage.removeItem('serviceLogDraft');
    draftLoadedRef.current = false; // Allow draft loading again
    showToast({
      type: 'info',
      message: 'Form cleared: All fields have been reset.',
    });
  };

  const calculateTotals = () => {
    if (!watchPatientEntries) return { total: 0, new: 0, followup: 0, dna: 0 };
    
    return watchPatientEntries.reduce(
      (totals, entry) => ({
        total: totals.total + 1,
        new: totals.new + (entry.appointmentType === 'new' ? 1 : 0),
        followup: totals.followup + (entry.appointmentType === 'followup' ? 1 : 0),
        dna: totals.dna + (entry.appointmentType === 'dna' ? 1 : 0),
      }),
      { total: 0, new: 0, followup: 0, dna: 0 }
    );
  };

  const totals = calculateTotals();

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900">Service Log Entry</h1>
          {isDraftSaving && (
            <div className="flex items-center text-sm text-blue-600">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse" />
              Auto-saving draft...
            </div>
          )}
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Client/Site <span className="text-red-500">*</span>
            </label>
            <Select
              options={clientOptions}
              value={watch('clientId')}
              onValueChange={(value) => setValue('clientId', value, { shouldValidate: true })}
              placeholder="Select client/site"
              error={errors.clientId?.message}
              aria-describedby="client-error"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Activity/Specialty <span className="text-red-500">*</span>
            </label>
            <Select
              options={activityOptions}
              value={watch('activityId')}
              onValueChange={(value) => setValue('activityId', value, { shouldValidate: true })}
              placeholder="Select activity"
              error={errors.activityId?.message}
              aria-describedby="activity-error"
            />
          </div>
        </div>

        <div className="mt-6">
          <DatePicker
            label="Service Date"
            {...register('serviceDate')}
            error={errors.serviceDate?.message}
            helperText="Date when the service was provided"
            required
          />
        </div>

        <div className="mt-6">
          <Input
            label="Number of Patient Entries"
            type="number"
            min={1}
            max={100}
            {...register('patientCount', { valueAsNumber: true })}
            error={errors.patientCount?.message}
            helperText="How many individual patient entries to create (1-100)"
            required
          />
        </div>
      </div>

      {/* Patient Entries */}
      {fields.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-neutral-900">Patient Entries</h2>
            <div className="text-sm text-neutral-600">
              Total entries: <span className="font-medium">{totals.total}</span>
              {totals.total !== watchPatientCount && (
                <span className="ml-2 text-red-600">
                  (Expected: {watchPatientCount})
                </span>
              )}
            </div>
          </div>

          {errors.patientEntries && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                {errors.patientEntries.message}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="border border-neutral-200 rounded-lg p-4 bg-neutral-50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-neutral-900">
                    Entry {index + 1}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Appointment Type <span className="text-red-500">*</span>
                    </label>
                    <Select
                      options={appointmentTypeOptions}
                      value={watch(`patientEntries.${index}.appointmentType`)}
                      onValueChange={(value) => 
                        setValue(`patientEntries.${index}.appointmentType`, value as AppointmentType, { shouldValidate: true })
                      }
                      placeholder="Select appointment type"
                      error={errors.patientEntries?.[index]?.appointmentType?.message}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Outcome <span className="text-red-500">*</span>
                    </label>
                    <Select
                      options={outcomeOptions}
                      value={watch(`patientEntries.${index}.outcomeId`)}
                      onValueChange={(value) => 
                        setValue(`patientEntries.${index}.outcomeId`, value, { shouldValidate: true })
                      }
                      placeholder="Select outcome"
                      error={errors.patientEntries?.[index]?.outcomeId?.message}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Total Entries:</span>
                  <span className="ml-2 font-medium text-blue-900">{totals.total}</span>
                </div>
                <div>
                  <span className="text-blue-700">New Patients:</span>
                  <span className="ml-2 font-medium text-blue-900">{totals.new}</span>
                </div>
                <div>
                  <span className="text-blue-700">Follow-ups:</span>
                  <span className="ml-2 font-medium text-blue-900">{totals.followup}</span>
                </div>
                <div>
                  <span className="text-blue-700">Did Not Attend:</span>
                  <span className="ml-2 font-medium text-blue-900">{totals.dna}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Form Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-6 border-t border-neutral-200 space-y-4 sm:space-y-0">
        <div className="text-sm text-neutral-500">
          <p>* Required fields</p>
          {isDirty && (
            <p className="flex items-center mt-1">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2" />
              Unsaved changes
            </p>
          )}
        </div>

        <div className="flex space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClearForm}
            disabled={isLoading}
            className="flex items-center"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear Form
          </Button>

          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
          )}

          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading || isSubmitting}
            disabled={!isDirty || isLoading || isSubmitting}
            className="flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Saving...' : 'Save Service Log'}
          </Button>
        </div>
      </div>
    </form>
  );
}