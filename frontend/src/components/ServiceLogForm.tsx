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
import { DynamicFieldGroup } from './DynamicField';
import { ClientFieldModal } from './ClientFieldModal';
import { useToast } from '../hooks/useToast';
import { useClientCustomFields } from '../hooks/useClientCustomFields';
import { useClientFieldManagement } from '../hooks/useClientCustomFields';
import { useAuth } from '../hooks/useAuth';
import { checkFeature } from '../config/features';
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
  const [showCreateFieldModal, setShowCreateFieldModal] = useState(false);
  const { showToast } = useToast();
  const { user } = useAuth();

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
      customFields: initialData?.customFields || {},
      additionalNotes: initialData?.additionalNotes || '',
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'patientEntries',
  });

  const watchPatientCount = watch('patientCount');
  const watchPatientEntries = watch('patientEntries');
  const watchClientId = watch('clientId');
  
  // Client-specific custom fields integration
  const { 
    fields: customFields, 
    isLoading: customFieldsLoading,
    error: customFieldsError,
    refreshFields
  } = useClientCustomFields({ 
    clientId: watchClientId || undefined,
    loadOnMount: true 
  });

  // Client field management (for admin users)
  const { 
    createField,
    isLoading: isCreatingField
  } = useClientFieldManagement({ 
    clientId: watchClientId || undefined
  });

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
  }, [watchPatientCount, replace, watchPatientEntries]);

  // Draft functionality disabled per user request
  // Users reported interference with data entry when drafts auto-restore
  useEffect(() => {
    // Clear any existing drafts to prevent future interference
    localStorage.removeItem('serviceLogDraft');
  }, []);

  const handleFormSubmit = async (data: ServiceLogFormData) => {
    try {
      await onSubmit(data);
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
      customFields: {},
      additionalNotes: '',
    });
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

  // Handle field creation
  const handleCreateField = async (fieldData: any) => {
    try {
      await createField(fieldData);
      await refreshFields(); // Refresh the form fields
      setShowCreateFieldModal(false);
    } catch (error) {
      // Error handling is done in the hook
      console.error('Field creation failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900">Service Log Entry</h1>
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

      {/* Additional Information Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-neutral-900">Additional Information</h2>
          {user?.role === 'admin' && watchClientId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (checkFeature('CUSTOM_FORMS_ENABLED')) {
                  setShowCreateFieldModal(true);
                }
              }}
              className="flex items-center opacity-50 cursor-not-allowed"
              disabled={!checkFeature('CUSTOM_FORMS_ENABLED')}
              title={!checkFeature('CUSTOM_FORMS_ENABLED') ? 'Custom form features available post-launch' : undefined}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Capture
            </Button>
          )}
        </div>

        {/* Client-Specific Custom Fields - Only show if feature is enabled */}
        {checkFeature('CUSTOM_FORMS_ENABLED') && customFields.length > 0 ? (
          <div className="space-y-6">
            {customFields.map((field) => (
              <div key={field.id} className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700">
                  {field.fieldLabel}
                  {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                
                {field.fieldType === 'dropdown' && field.choices && (
                  <Select
                    options={field.choices.map(choice => ({
                      value: choice.id,
                      label: choice.choiceText,
                    }))}
                    value={watch(`customFields.${field.id}`) || ''}
                    onValueChange={(value) => 
                      setValue(`customFields.${field.id}`, value, { shouldValidate: true })
                    }
                    placeholder={`Select ${field.fieldLabel.toLowerCase()}`}
                    error={errors.customFields?.[field.id]?.message}
                  />
                )}

                {field.fieldType === 'text' && (
                  <Input
                    {...register(`customFields.${field.id}`)}
                    placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                    error={errors.customFields?.[field.id]?.message}
                  />
                )}

                {field.fieldType === 'number' && (
                  <Input
                    type="number"
                    {...register(`customFields.${field.id}`, { valueAsNumber: true })}
                    placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                    error={errors.customFields?.[field.id]?.message}
                  />
                )}

                {field.fieldType === 'date' && (
                  <DatePicker
                    {...register(`customFields.${field.id}`)}
                    placeholder={`Select ${field.fieldLabel.toLowerCase()}`}
                    error={errors.customFields?.[field.id]?.message}
                  />
                )}
              </div>
            ))}
          </div>
        ) : checkFeature('CUSTOM_FORMS_ENABLED') && watchClientId ? (
          <div className="text-center py-8 text-neutral-500">
            <p className="text-sm">No additional fields configured for this client.</p>
            {user?.role === 'admin' && (
              <p className="text-xs mt-1">Click "Add New Capture" to create custom fields for this client.</p>
            )}
          </div>
        ) : checkFeature('CUSTOM_FORMS_ENABLED') ? (
          <div className="text-center py-8 text-neutral-500">
            <p className="text-sm">Select a client to see additional fields.</p>
          </div>
        ) : null}

        {/* Always show Additional Notes field */}
        <div className="mt-6 pt-6 border-t border-neutral-200">
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Additional Notes
          </label>
          <textarea
            {...register('additionalNotes')}
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
            placeholder="Optional: Any additional notes about this service entry..."
          />
          {errors.additionalNotes && (
            <p className="mt-1 text-sm text-red-600">{errors.additionalNotes.message}</p>
          )}
        </div>
      </Card>

      {/* Form Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-6 border-t border-neutral-200 space-y-4 sm:space-y-0">
        <div className="text-sm text-neutral-500">
          <p>* Required fields</p>
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

      {/* Client Field Creation Modal - Only show if feature is enabled */}
      {checkFeature('CUSTOM_FORMS_ENABLED') && user?.role === 'admin' && watchClientId && (
        <ClientFieldModal
          isOpen={showCreateFieldModal}
          onClose={() => setShowCreateFieldModal(false)}
          clientId={watchClientId}
          clientName={clients.find(c => c.id === watchClientId)?.name}
          onSave={handleCreateField}
        />
      )}
    </form>
  );
}