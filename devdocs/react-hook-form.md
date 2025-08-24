# React Hook Form Documentation for Healthcare Service Log Portal

## Overview
React Hook Form is a performant forms library with minimal re-renders and easy validation, perfect for healthcare applications that require complex forms with strict validation requirements.

## Installation and Setup

### Installation
```bash
npm install react-hook-form @hookform/resolvers zod
```

### Basic Usage
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Define validation schema
const patientSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  dateOfBirth: z.string().refine((date) => {
    const birth = new Date(date);
    const today = new Date();
    return birth < today;
  }, 'Date of birth must be in the past'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  email: z.string().email().optional().or(z.literal('')),
});

type PatientFormData = z.infer<typeof patientSchema>;

function PatientForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    reset,
    watch,
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    mode: 'onChange', // Validate on change for better UX
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      phone: '',
      email: '',
    },
  });

  const onSubmit = async (data: PatientFormData) => {
    try {
      // Submit to API
      await submitPatientData(data);
      reset(); // Reset form after successful submission
    } catch (error) {
      console.error('Submission failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            First Name *
          </label>
          <input
            {...register('firstName')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-red-600">
              {errors.firstName.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Last Name *
          </label>
          <input
            {...register('lastName')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {errors.lastName && (
            <p className="mt-1 text-sm text-red-600">
              {errors.lastName.message}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Saving...' : 'Save Patient'}
      </button>
    </form>
  );
}
```

## Advanced Form Patterns

### Nested Object Validation
```typescript
// Complex medical record form with nested data
const medicalRecordSchema = z.object({
  patient: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    dateOfBirth: z.string(),
    medicalRecordNumber: z.string().optional(),
  }),
  emergencyContact: z.object({
    name: z.string().min(2),
    phone: z.string().regex(/^\d{10}$/),
    relationship: z.enum(['spouse', 'parent', 'child', 'sibling', 'other']),
  }),
  insurance: z.object({
    provider: z.string(),
    policyNumber: z.string(),
    groupNumber: z.string().optional(),
    effectiveDate: z.string(),
  }).optional(),
  allergies: z.array(z.object({
    allergen: z.string(),
    severity: z.enum(['mild', 'moderate', 'severe']),
    reaction: z.string(),
  })).optional(),
  medications: z.array(z.object({
    name: z.string(),
    dosage: z.string(),
    frequency: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
  })).optional(),
});

type MedicalRecordData = z.infer<typeof medicalRecordSchema>;

function MedicalRecordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
    setValue,
  } = useForm<MedicalRecordData>({
    resolver: zodResolver(medicalRecordSchema),
    defaultValues: {
      patient: {
        firstName: '',
        lastName: '',
        dateOfBirth: '',
      },
      emergencyContact: {
        name: '',
        phone: '',
        relationship: 'spouse',
      },
      allergies: [],
      medications: [],
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Patient Information */}
      <section className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-medium mb-4">Patient Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">First Name</label>
            <input
              {...register('patient.firstName')}
              className="form-input"
            />
            {errors.patient?.firstName && (
              <ErrorMessage message={errors.patient.firstName.message} />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last Name</label>
            <input
              {...register('patient.lastName')}
              className="form-input"
            />
            {errors.patient?.lastName && (
              <ErrorMessage message={errors.patient.lastName.message} />
            )}
          </div>
        </div>
      </section>

      {/* Emergency Contact */}
      <section className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-medium mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              {...register('emergencyContact.name')}
              className="form-input"
            />
            {errors.emergencyContact?.name && (
              <ErrorMessage message={errors.emergencyContact.name.message} />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              {...register('emergencyContact.phone')}
              className="form-input"
            />
            {errors.emergencyContact?.phone && (
              <ErrorMessage message={errors.emergencyContact.phone.message} />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Relationship</label>
            <select {...register('emergencyContact.relationship')} className="form-select">
              <option value="spouse">Spouse</option>
              <option value="parent">Parent</option>
              <option value="child">Child</option>
              <option value="sibling">Sibling</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </section>
    </form>
  );
}
```

### Dynamic Field Arrays
```typescript
import { useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

function MedicationsForm() {
  const { control, register, formState: { errors } } = useForm<MedicalRecordData>();
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'medications',
  });

  const addMedication = () => {
    append({
      name: '',
      dosage: '',
      frequency: '',
      startDate: '',
      endDate: '',
    });
  };

  return (
    <section className="bg-white p-6 rounded-lg border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Current Medications</h3>
        <button
          type="button"
          onClick={addMedication}
          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Medication
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No medications recorded. Click "Add Medication" to add one.
        </p>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="border rounded-lg p-4 relative">
              <button
                type="button"
                onClick={() => remove(index)}
                className="absolute top-2 right-2 p-2 text-red-600 hover:bg-red-50 rounded-md"
                aria-label="Remove medication"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-10">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Medication Name
                  </label>
                  <input
                    {...register(`medications.${index}.name`)}
                    className="form-input"
                    placeholder="e.g., Lisinopril"
                  />
                  {errors.medications?.[index]?.name && (
                    <ErrorMessage message={errors.medications[index].name.message} />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Dosage
                  </label>
                  <input
                    {...register(`medications.${index}.dosage`)}
                    className="form-input"
                    placeholder="e.g., 10mg"
                  />
                  {errors.medications?.[index]?.dosage && (
                    <ErrorMessage message={errors.medications[index].dosage.message} />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Frequency
                  </label>
                  <select
                    {...register(`medications.${index}.frequency`)}
                    className="form-select"
                  >
                    <option value="">Select frequency</option>
                    <option value="once-daily">Once daily</option>
                    <option value="twice-daily">Twice daily</option>
                    <option value="three-times-daily">Three times daily</option>
                    <option value="as-needed">As needed</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    {...register(`medications.${index}.startDate`)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    {...register(`medications.${index}.endDate`)}
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

### Service Entry Form with Complex Validation
```typescript
const serviceEntrySchema = z.object({
  patientId: z.string().uuid('Please select a patient'),
  serviceType: z.enum(['consultation', 'procedure', 'therapy', 'diagnostic']),
  providerId: z.string().uuid('Please select a provider'),
  scheduledDateTime: z.string().refine((dateTime) => {
    const scheduled = new Date(dateTime);
    const now = new Date();
    return scheduled > now;
  }, 'Scheduled time must be in the future'),
  duration: z.number().min(15, 'Minimum duration is 15 minutes').max(480, 'Maximum duration is 8 hours'),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  priority: z.enum(['routine', 'urgent', 'emergency']),
  location: z.object({
    facility: z.string().min(1, 'Facility is required'),
    room: z.string().optional(),
    floor: z.string().optional(),
  }),
  billing: z.object({
    code: z.string().regex(/^[A-Z0-9\-]+$/, 'Invalid billing code format').optional(),
    amount: z.number().positive('Amount must be positive').optional(),
    insurance: z.object({
      provider: z.string().optional(),
      policyNumber: z.string().optional(),
      authorizationNumber: z.string().optional(),
    }).optional(),
  }).optional(),
  // Conditional validation based on service type
}).refine((data) => {
  if (data.serviceType === 'procedure' && (!data.billing?.code || !data.billing?.amount)) {
    return false;
  }
  return true;
}, {
  message: 'Procedures require billing code and amount',
  path: ['billing'],
});

type ServiceEntryData = z.infer<typeof serviceEntrySchema>;

function ServiceEntryForm() {
  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isSubmitting, isDirty },
    reset,
    trigger,
  } = useForm<ServiceEntryData>({
    resolver: zodResolver(serviceEntrySchema),
    mode: 'onChange',
  });

  const serviceType = watch('serviceType');
  const scheduledDateTime = watch('scheduledDateTime');

  // Custom validation trigger on service type change
  React.useEffect(() => {
    if (serviceType) {
      trigger(['billing.code', 'billing.amount']);
    }
  }, [serviceType, trigger]);

  const onSubmit = async (data: ServiceEntryData) => {
    try {
      // Auto-save feature
      localStorage.removeItem('serviceEntryDraft');
      
      await submitServiceEntry(data);
      reset();
    } catch (error) {
      console.error('Failed to save service entry:', error);
    }
  };

  // Auto-save draft functionality
  React.useEffect(() => {
    if (isDirty) {
      const currentData = watch();
      const draftTimer = setTimeout(() => {
        localStorage.setItem('serviceEntryDraft', JSON.stringify(currentData));
      }, 2000);

      return () => clearTimeout(draftTimer);
    }
  }, [watch, isDirty]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-4xl mx-auto">
      {/* Service Details */}
      <section className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-medium mb-4">Service Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Service Type <RequiredIndicator />
            </label>
            <select
              {...register('serviceType')}
              className="form-select"
            >
              <option value="">Select service type</option>
              <option value="consultation">Consultation</option>
              <option value="procedure">Procedure</option>
              <option value="therapy">Therapy</option>
              <option value="diagnostic">Diagnostic</option>
            </select>
            {errors.serviceType && (
              <ErrorMessage message={errors.serviceType.message} />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Scheduled Date & Time <RequiredIndicator />
            </label>
            <input
              type="datetime-local"
              {...register('scheduledDateTime')}
              min={new Date().toISOString().slice(0, 16)}
              className="form-input"
            />
            {errors.scheduledDateTime && (
              <ErrorMessage message={errors.scheduledDateTime.message} />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Duration (minutes) <RequiredIndicator />
            </label>
            <input
              type="number"
              min="15"
              max="480"
              step="15"
              {...register('duration', { valueAsNumber: true })}
              className="form-input"
            />
            {errors.duration && (
              <ErrorMessage message={errors.duration.message} />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Priority <RequiredIndicator />
            </label>
            <select {...register('priority')} className="form-select">
              <option value="">Select priority</option>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
            {errors.priority && (
              <ErrorMessage message={errors.priority.message} />
            )}
          </div>
        </div>
      </section>

      {/* Location Information */}
      <section className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-medium mb-4">Location</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Facility <RequiredIndicator />
            </label>
            <select {...register('location.facility')} className="form-select">
              <option value="">Select facility</option>
              <option value="main-hospital">Main Hospital</option>
              <option value="outpatient-clinic">Outpatient Clinic</option>
              <option value="emergency-dept">Emergency Department</option>
              <option value="surgery-center">Surgery Center</option>
            </select>
            {errors.location?.facility && (
              <ErrorMessage message={errors.location.facility.message} />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Room</label>
            <input
              {...register('location.room')}
              className="form-input"
              placeholder="e.g., 201A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Floor</label>
            <input
              {...register('location.floor')}
              className="form-input"
              placeholder="e.g., 2nd Floor"
            />
          </div>
        </div>
      </section>

      {/* Conditional Billing Section */}
      {serviceType === 'procedure' && (
        <section className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
          <h3 className="text-lg font-medium mb-4 text-yellow-800">
            Billing Information (Required for Procedures)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Billing Code <RequiredIndicator />
              </label>
              <input
                {...register('billing.code')}
                className="form-input"
                placeholder="e.g., CPT-12345"
              />
              {errors.billing?.code && (
                <ErrorMessage message={errors.billing.code.message} />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Amount <RequiredIndicator />
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('billing.amount', { valueAsNumber: true })}
                className="form-input"
                placeholder="0.00"
              />
              {errors.billing?.amount && (
                <ErrorMessage message={errors.billing.amount.message} />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Notes Section */}
      <section className="bg-white p-6 rounded-lg border">
        <div>
          <label className="block text-sm font-medium mb-1">
            Notes
          </label>
          <textarea
            {...register('notes')}
            rows={4}
            className="form-textarea"
            placeholder="Additional notes about the service..."
          />
          <div className="flex justify-between items-center mt-1">
            {errors.notes && (
              <ErrorMessage message={errors.notes.message} />
            )}
            <span className="text-sm text-gray-500 ml-auto">
              {watch('notes')?.length || 0}/1000 characters
            </span>
          </div>
        </div>
      </section>

      {/* Form Actions */}
      <div className="flex justify-between items-center pt-6 border-t">
        <div className="text-sm text-gray-500">
          {isDirty && (
            <span className="flex items-center">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse"></div>
              Auto-saving draft...
            </span>
          )}
        </div>
        
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => reset()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Reset Form
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <LoadingSpinner className="mr-2" />
                Saving...
              </span>
            ) : (
              'Save Service Entry'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
```

## Form Performance Optimization

### Controlled vs Uncontrolled Components
```typescript
// Performance optimized form with selective re-renders
function OptimizedPatientForm() {
  const { register, handleSubmit, watch, control } = useForm({
    mode: 'onBlur', // Only validate on blur to reduce re-renders
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
    },
  });

  // Watch only specific fields to minimize re-renders
  const firstName = watch('firstName');
  
  // Use React.memo for expensive components
  const MemoizedPatientPreview = React.memo(({ firstName, lastName }) => (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3>Patient Preview</h3>
      <p>Name: {firstName} {lastName}</p>
    </div>
  ));

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('firstName')} />
      <input {...register('lastName')} />
      
      {/* This component will only re-render when firstName or lastName change */}
      <MemoizedPatientPreview 
        firstName={firstName} 
        lastName={watch('lastName')} 
      />
    </form>
  );
}

// Use Controller for complex third-party components
import { Controller } from 'react-hook-form';
import DatePicker from 'react-datepicker';

function ControlledDateInput() {
  const { control } = useForm();

  return (
    <Controller
      control={control}
      name="scheduledDate"
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <div>
          <DatePicker
            selected={value}
            onChange={onChange}
            showTimeSelect
            dateFormat="Pp"
            minDate={new Date()}
            className="form-input"
          />
          {error && <ErrorMessage message={error.message} />}
        </div>
      )}
    />
  );
}
```

### Form State Management
```typescript
// Custom hook for form state management
function usePatientForm(initialData?: Partial<PatientFormData>) {
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      ...defaultPatientValues,
      ...initialData,
    },
  });

  const { watch, reset, formState: { isDirty } } = form;

  // Auto-save functionality
  const autoSave = useCallback(
    debounce(async (data: PatientFormData) => {
      setIsAutoSaving(true);
      try {
        await saveDraft(data);
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsAutoSaving(false);
      }
    }, 2000),
    []
  );

  // Watch for changes and trigger auto-save
  useEffect(() => {
    if (isDirty) {
      const currentData = watch();
      autoSave(currentData);
    }
  }, [watch, isDirty, autoSave]);

  // Load draft on component mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await getDraft();
        if (draft) {
          reset(draft);
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    };

    loadDraft();
  }, [reset]);

  const clearDraft = useCallback(async () => {
    try {
      await deleteDraft();
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, []);

  return {
    ...form,
    isAutoSaving,
    clearDraft,
  };
}

// Usage in component
function PatientFormWithAutoSave() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    isAutoSaving,
    clearDraft,
  } = usePatientForm();

  const onSubmit = async (data: PatientFormData) => {
    try {
      await submitPatientData(data);
      await clearDraft();
      // Handle success
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Form fields */}
        
        <div className="flex items-center justify-between">
          {isAutoSaving && (
            <span className="text-sm text-blue-600">
              <LoadingSpinner className="inline mr-1" size="sm" />
              Saving draft...
            </span>
          )}
          
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="btn-primary"
          >
            Save Patient
          </button>
        </div>
      </form>
    </div>
  );
}
```

## Error Handling and User Experience

### Comprehensive Error Display
```typescript
// Reusable error message component
function ErrorMessage({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p className="mt-1 text-sm text-red-600 flex items-center">
      <AlertCircle className="w-4 h-4 mr-1" />
      {message}
    </p>
  );
}

// Required field indicator
function RequiredIndicator() {
  return <span className="text-red-500 ml-1" aria-label="required">*</span>;
}

// Form section with error summary
function FormSection({ 
  title, 
  children, 
  errors = {},
  className = '' 
}: {
  title: string;
  children: React.ReactNode;
  errors?: Record<string, any>;
  className?: string;
}) {
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <section className={`bg-white rounded-lg border p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">{title}</h3>
        {hasErrors && (
          <div className="flex items-center text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 mr-1" />
            Please fix errors in this section
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

// Form with error summary
function PatientFormWithErrorSummary() {
  const { 
    register, 
    handleSubmit, 
    formState: { errors, isSubmitting } 
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
  });

  const errorSummary = useMemo(() => {
    return Object.entries(errors).map(([field, error]) => ({
      field,
      message: error?.message || 'Invalid value',
    }));
  }, [errors]);

  const scrollToError = useCallback((fieldName: string) => {
    const element = document.querySelector(`[name="${fieldName}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus();
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Error Summary */}
      {errorSummary.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center mb-2">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <h3 className="text-sm font-medium text-red-800">
              Please correct the following errors:
            </h3>
          </div>
          <ul className="text-sm text-red-700 space-y-1">
            {errorSummary.map(({ field, message }) => (
              <li key={field}>
                <button
                  type="button"
                  onClick={() => scrollToError(field)}
                  className="text-left underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                >
                  {field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: {message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <FormSection 
          title="Patient Information"
          errors={errors.patient || {}}
        >
          {/* Form fields */}
        </FormSection>

        <FormSection 
          title="Emergency Contact"
          errors={errors.emergencyContact || {}}
          className="mt-6"
        >
          {/* Form fields */}
        </FormSection>
      </form>
    </div>
  );
}
```

## Testing Forms

### Form Validation Testing
```typescript
// __tests__/PatientForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientForm } from '../PatientForm';

describe('PatientForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  test('validates required fields', async () => {
    const user = userEvent.setup();
    render(<PatientForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByText('Save Patient');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('First name must be at least 2 characters')).toBeInTheDocument();
      expect(screen.getByText('Last name must be at least 2 characters')).toBeInTheDocument();
      expect(screen.getByText('Phone must be 10 digits')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('validates phone number format', async () => {
    const user = userEvent.setup();
    render(<PatientForm onSubmit={mockOnSubmit} />);

    const phoneInput = screen.getByLabelText(/phone/i);
    await user.type(phoneInput, '123');

    // Trigger validation
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText('Phone must be 10 digits')).toBeInTheDocument();
    });
  });

  test('submits valid form data', async () => {
    const user = userEvent.setup();
    render(<PatientForm onSubmit={mockOnSubmit} />);

    // Fill out form with valid data
    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/phone/i), '5551234567');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');

    const submitButton = screen.getByText('Save Patient');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        phone: '5551234567',
        email: 'john@example.com',
      });
    });
  });

  test('handles async validation errors', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockRejectedValue(new Error('Phone number already exists'));
    
    render(<PatientForm onSubmit={mockOnSubmit} />);

    // Fill form and submit
    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/phone/i), '5551234567');

    const submitButton = screen.getByText('Save Patient');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Phone number already exists')).toBeInTheDocument();
    });
  });

  test('auto-saves draft data', async () => {
    const user = userEvent.setup();
    const mockAutoSave = jest.fn();
    
    render(<PatientForm onSubmit={mockOnSubmit} autoSave={mockAutoSave} />);

    await user.type(screen.getByLabelText(/first name/i), 'John');
    
    // Wait for debounced auto-save
    await waitFor(
      () => {
        expect(mockAutoSave).toHaveBeenCalledWith(
          expect.objectContaining({ firstName: 'John' })
        );
      },
      { timeout: 3000 }
    );
  });
});

// Testing complex field arrays
describe('MedicationsForm', () => {
  test('adds and removes medication entries', async () => {
    const user = userEvent.setup();
    const mockOnSubmit = jest.fn();
    
    render(<MedicationsForm onSubmit={mockOnSubmit} />);

    // Initially no medications
    expect(screen.getByText('No medications recorded')).toBeInTheDocument();

    // Add medication
    const addButton = screen.getByText('Add Medication');
    await user.click(addButton);

    // Fill out medication info
    const nameInput = screen.getByPlaceholderText('e.g., Lisinopril');
    await user.type(nameInput, 'Metformin');

    const dosageInput = screen.getByPlaceholderText('e.g., 10mg');
    await user.type(dosageInput, '500mg');

    const frequencySelect = screen.getByDisplayValue('Select frequency');
    await user.selectOptions(frequencySelect, 'twice-daily');

    // Add another medication
    await user.click(addButton);
    expect(screen.getAllByPlaceholderText('e.g., Lisinopril')).toHaveLength(2);

    // Remove first medication
    const removeButtons = screen.getAllByLabelText('Remove medication');
    await user.click(removeButtons[0]);

    expect(screen.getAllByPlaceholderText('e.g., Lisinopril')).toHaveLength(1);
  });
});
```

## Best Practices

### 1. Schema Design
- Use Zod for comprehensive validation
- Define reusable schema components
- Implement custom validation rules
- Handle nested object validation

### 2. Performance
- Use uncontrolled components by default
- Watch specific fields only when needed
- Implement React.memo for expensive components
- Use debounced auto-save

### 3. User Experience
- Provide real-time validation feedback
- Implement auto-save for long forms
- Show clear error messages
- Use progressive disclosure

### 4. Healthcare-Specific
- Validate medical data formats
- Implement audit trails
- Handle sensitive data appropriately
- Ensure accessibility compliance

### 5. Testing
- Test form validation thoroughly
- Mock API calls and async operations
- Test user interactions
- Verify error handling

## Resources
- [React Hook Form Documentation](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
- [React Hook Form DevTools](https://react-hook-form.com/dev-tools)
- [Form Accessibility Guidelines](https://www.w3.org/WAI/tutorials/forms/)