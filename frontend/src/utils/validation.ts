// Validation schemas following Zod documentation patterns for healthcare data
import { z } from 'zod';

// Healthcare-specific validators
const positiveIntegerSchema = z.number()
  .int('Must be a whole number')
  .min(0, 'Cannot be negative');

const requiredStringSchema = z.string()
  .min(1, 'This field is required')
  .trim();

// Appointment type validation
const appointmentTypeSchema = z.enum(['new', 'followup', 'dna'], {
  errorMap: () => ({ message: 'Please select an appointment type' }),
});

// Patient entry schema - following medical data validation patterns
const patientEntrySchema = z.object({
  appointmentType: appointmentTypeSchema,
  outcomeId: requiredStringSchema.min(1, 'Please select an outcome'),
});

// Service log form schema - following React Hook Form + Zod patterns
export const serviceLogFormSchema = z.object({
  clientId: requiredStringSchema.min(1, 'Please select a client/site'),
  activityId: requiredStringSchema.min(1, 'Please select an activity'),
  serviceDate: z.string()
    .min(1, 'Service date is required')
    .refine((date) => {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime()) && parsed <= new Date();
    }, 'Service date must be a valid date and not in the future'),
  patientCount: z.number()
    .int('Patient count must be a whole number')
    .min(1, 'At least 1 patient entry is required')
    .max(100, 'Cannot exceed 100 patient entries per session'),
  patientEntries: z.array(patientEntrySchema)
    .min(1, 'At least one patient entry is required'),
  customFields: z.record(z.string(), z.any()).optional(),
  additionalNotes: z.string().optional(),
}).refine((data) => {
  // Validate that patient entries match patient count
  return data.patientEntries.length === data.patientCount;
}, {
  message: 'Number of patient entries must match the patient count',
  path: ['patientEntries'],
});

// Type inference for form data
export type ServiceLogFormData = z.infer<typeof serviceLogFormSchema>;

// Validation helper functions following documented patterns
export const validatePatientCount = (count: number): boolean => {
  return count >= 1 && count <= 100 && Number.isInteger(count);
};

export const validatePatientEntry = (entry: any): boolean => {
  try {
    const result = patientEntrySchema.safeParse(entry);
    return result.success;
  } catch (error) {
    return false;
  }
};

// Error formatting function following Zod documentation
export const formatValidationError = (error: z.ZodError): Record<string, string> => {
  const formattedErrors: Record<string, string> = {};
  
  error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    formattedErrors[path] = issue.message;
  });
  
  return formattedErrors;
};

// Safe parsing wrapper
export const safeParseServiceLog = (data: unknown) => {
  return serviceLogFormSchema.safeParse(data);
};