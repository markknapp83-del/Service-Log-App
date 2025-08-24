// Validation schemas following Zod documentation patterns for healthcare data
import { z } from 'zod';

// Healthcare-specific validators
const positiveIntegerSchema = z.number()
  .int('Must be a whole number')
  .min(0, 'Cannot be negative');

const requiredStringSchema = z.string()
  .min(1, 'This field is required')
  .trim();

// Patient entry schema - following medical data validation patterns
const patientEntrySchema = z.object({
  newPatients: positiveIntegerSchema,
  followupPatients: positiveIntegerSchema,
  dnaCount: positiveIntegerSchema.refine((val, ctx) => {
    // DNA count should not exceed total patients
    const entry = ctx.path[0];
    if (typeof entry === 'object' && entry !== null) {
      const entryObj = entry as any;
      const total = entryObj.newPatients + entryObj.followupPatients;
      return val <= total;
    }
    return true;
  }, {
    message: 'DNA count cannot exceed total patients',
  }),
  outcomeId: requiredStringSchema.uuid('Please select an outcome'),
}).refine((data) => {
  // At least one patient must be recorded
  return data.newPatients + data.followupPatients > 0;
}, {
  message: 'At least one patient must be recorded',
  path: ['newPatients'],
});

// Service log form schema - following React Hook Form + Zod patterns
export const serviceLogFormSchema = z.object({
  clientId: requiredStringSchema.uuid('Please select a client/site'),
  activityId: requiredStringSchema.uuid('Please select an activity'),
  patientCount: z.number()
    .int('Patient count must be a whole number')
    .min(1, 'At least 1 patient is required')
    .max(100, 'Cannot exceed 100 patients per session'),
  patientEntries: z.array(patientEntrySchema)
    .min(1, 'At least one patient entry is required'),
}).refine((data) => {
  // Validate that patient entries match patient count
  const totalPatientsInEntries = data.patientEntries.reduce(
    (sum, entry) => sum + entry.newPatients + entry.followupPatients,
    0
  );
  return totalPatientsInEntries === data.patientCount;
}, {
  message: 'Patient entries must match the total patient count',
  path: ['patientEntries'],
});

// Type inference for form data
export type ServiceLogFormData = z.infer<typeof serviceLogFormSchema>;

// Validation helper functions following documented patterns
export const validatePatientCount = (count: number): boolean => {
  return count >= 1 && count <= 100 && Number.isInteger(count);
};

export const validatePatientEntry = (entry: any): boolean => {
  const result = patientEntrySchema.safeParse(entry);
  return result.success;
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