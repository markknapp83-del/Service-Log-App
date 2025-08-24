// React Hook Form integration tests following documented patterns
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceLogFormSchema, ServiceLogFormData } from '../utils/validation';
import { ServiceLogForm } from '../components/ServiceLogForm';
import { Select } from '../components/Select';
import { Input } from '../components/Input';

// Mock hooks and services
jest.mock('../hooks/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Test component that uses React Hook Form with our schema
const TestFormComponent = ({ 
  onSubmit = jest.fn(),
  defaultValues = {},
  validationMode = 'onChange' as const
}) => {
  const form = useForm<ServiceLogFormData>({
    resolver: zodResolver(serviceLogFormSchema),
    mode: validationMode,
    defaultValues: {
      clientId: '',
      activityId: '',
      patientCount: 1,
      patientEntries: [],
      ...defaultValues,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'patientEntries',
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} data-testid="test-form">
        <div>
          <label htmlFor="clientId">Client ID</label>
          <input
            id="clientId"
            {...form.register('clientId')}
            data-testid="client-input"
          />
          {form.formState.errors.clientId && (
            <span data-testid="client-error">{form.formState.errors.clientId.message}</span>
          )}
        </div>

        <div>
          <label htmlFor="activityId">Activity ID</label>
          <input
            id="activityId"
            {...form.register('activityId')}
            data-testid="activity-input"
          />
          {form.formState.errors.activityId && (
            <span data-testid="activity-error">{form.formState.errors.activityId.message}</span>
          )}
        </div>

        <div>
          <label htmlFor="patientCount">Patient Count</label>
          <input
            id="patientCount"
            type="number"
            {...form.register('patientCount', { valueAsNumber: true })}
            data-testid="patient-count-input"
          />
          {form.formState.errors.patientCount && (
            <span data-testid="patient-count-error">{form.formState.errors.patientCount.message}</span>
          )}
        </div>

        <div data-testid="patient-entries">
          {fields.map((field, index) => (
            <div key={field.id} data-testid={`entry-${index}`}>
              <input
                type="number"
                {...form.register(`patientEntries.${index}.newPatients`, { valueAsNumber: true })}
                data-testid={`new-patients-${index}`}
                placeholder="New patients"
              />
              <input
                type="number"
                {...form.register(`patientEntries.${index}.followupPatients`, { valueAsNumber: true })}
                data-testid={`followup-patients-${index}`}
                placeholder="Follow-up patients"
              />
              <input
                type="number"
                {...form.register(`patientEntries.${index}.dnaCount`, { valueAsNumber: true })}
                data-testid={`dna-count-${index}`}
                placeholder="DNA count"
              />
              <input
                {...form.register(`patientEntries.${index}.outcomeId`)}
                data-testid={`outcome-${index}`}
                placeholder="Outcome ID"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                data-testid={`remove-entry-${index}`}
              >
                Remove
              </button>
              {form.formState.errors.patientEntries?.[index] && (
                <div data-testid={`entry-error-${index}`}>
                  {JSON.stringify(form.formState.errors.patientEntries[index])}
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => append({
              newPatients: 0,
              followupPatients: 0,
              dnaCount: 0,
              outcomeId: '',
            })}
            data-testid="add-entry"
          >
            Add Entry
          </button>
        </div>

        <div data-testid="form-state">
          <span data-testid="is-valid">{form.formState.isValid ? 'valid' : 'invalid'}</span>
          <span data-testid="is-dirty">{form.formState.isDirty ? 'dirty' : 'clean'}</span>
          <span data-testid="is-submitting">{form.formState.isSubmitting ? 'submitting' : 'idle'}</span>
        </div>

        <button type="submit" data-testid="submit-button">
          Submit
        </button>
      </form>
    </FormProvider>
  );
};

describe('React Hook Form Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('Form Initialization', () => {
    test('initializes with default values', () => {
      render(<TestFormComponent />);

      expect(screen.getByTestId('client-input')).toHaveValue('');
      expect(screen.getByTestId('activity-input')).toHaveValue('');
      expect(screen.getByTestId('patient-count-input')).toHaveValue(1);
      expect(screen.getByTestId('is-valid')).toHaveTextContent('invalid');
      expect(screen.getByTestId('is-dirty')).toHaveTextContent('clean');
    });

    test('initializes with custom default values', () => {
      const defaultValues = {
        clientId: '550e8400-e29b-41d4-a716-446655440000',
        activityId: '550e8400-e29b-41d4-a716-446655440001',
        patientCount: 5,
      };

      render(<TestFormComponent defaultValues={defaultValues} />);

      expect(screen.getByTestId('client-input')).toHaveValue('550e8400-e29b-41d4-a716-446655440000');
      expect(screen.getByTestId('activity-input')).toHaveValue('550e8400-e29b-41d4-a716-446655440001');
      expect(screen.getByTestId('patient-count-input')).toHaveValue(5);
    });
  });

  describe('Form State Management', () => {
    test('tracks dirty state correctly', async () => {
      render(<TestFormComponent />);

      expect(screen.getByTestId('is-dirty')).toHaveTextContent('clean');

      const clientInput = screen.getByTestId('client-input');
      await user.type(clientInput, 'test-value');

      await waitFor(() => {
        expect(screen.getByTestId('is-dirty')).toHaveTextContent('dirty');
      });
    });

    test('validates on change mode', async () => {
      render(<TestFormComponent validationMode="onChange" />);

      const clientInput = screen.getByTestId('client-input');
      await user.type(clientInput, 'invalid-uuid');

      await waitFor(() => {
        expect(screen.getByTestId('client-error')).toHaveTextContent('Please select a client/site');
      });
    });

    test('validates on blur mode', async () => {
      render(<TestFormComponent validationMode="onBlur" />);

      const clientInput = screen.getByTestId('client-input');
      await user.type(clientInput, 'invalid-uuid');

      // Error should not appear until blur
      expect(screen.queryByTestId('client-error')).not.toBeInTheDocument();

      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByTestId('client-error')).toHaveTextContent('Please select a client/site');
      });
    });

    test('updates validity state based on validation', async () => {
      render(<TestFormComponent />);

      expect(screen.getByTestId('is-valid')).toHaveTextContent('invalid');

      // Fill valid data
      await user.type(screen.getByTestId('client-input'), '550e8400-e29b-41d4-a716-446655440000');
      await user.type(screen.getByTestId('activity-input'), '550e8400-e29b-41d4-a716-446655440001');

      // Add patient entry
      await user.click(screen.getByTestId('add-entry'));

      await waitFor(() => {
        expect(screen.getByTestId('entry-0')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('new-patients-0'), '1');
      await user.type(screen.getByTestId('outcome-0'), '550e8400-e29b-41d4-a716-446655440002');

      await waitFor(() => {
        expect(screen.getByTestId('is-valid')).toHaveTextContent('valid');
      });
    });
  });

  describe('Field Array Management', () => {
    test('adds new patient entries', async () => {
      render(<TestFormComponent />);

      expect(screen.queryByTestId('entry-0')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('add-entry'));

      await waitFor(() => {
        expect(screen.getByTestId('entry-0')).toBeInTheDocument();
        expect(screen.getByTestId('new-patients-0')).toBeInTheDocument();
        expect(screen.getByTestId('followup-patients-0')).toBeInTheDocument();
        expect(screen.getByTestId('dna-count-0')).toBeInTheDocument();
        expect(screen.getByTestId('outcome-0')).toBeInTheDocument();
      });
    });

    test('removes patient entries', async () => {
      render(<TestFormComponent />);

      // Add two entries
      await user.click(screen.getByTestId('add-entry'));
      await user.click(screen.getByTestId('add-entry'));

      await waitFor(() => {
        expect(screen.getByTestId('entry-0')).toBeInTheDocument();
        expect(screen.getByTestId('entry-1')).toBeInTheDocument();
      });

      // Remove first entry
      await user.click(screen.getByTestId('remove-entry-0'));

      await waitFor(() => {
        expect(screen.queryByTestId('entry-1')).not.toBeInTheDocument();
        // The remaining entry should now be entry-0
        expect(screen.getByTestId('entry-0')).toBeInTheDocument();
      });
    });

    test('validates individual patient entries', async () => {
      render(<TestFormComponent />);

      await user.click(screen.getByTestId('add-entry'));

      await waitFor(() => {
        expect(screen.getByTestId('entry-0')).toBeInTheDocument();
      });

      // Enter invalid data
      await user.type(screen.getByTestId('new-patients-0'), '-1');
      await user.type(screen.getByTestId('outcome-0'), 'invalid-uuid');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByTestId('entry-error-0')).toBeInTheDocument();
      });
    });

    test('maintains entry data when reordering', async () => {
      render(<TestFormComponent />);

      // Add entries with data
      await user.click(screen.getByTestId('add-entry'));
      await user.type(screen.getByTestId('new-patients-0'), '3');
      await user.type(screen.getByTestId('followup-patients-0'), '2');

      await user.click(screen.getByTestId('add-entry'));
      await user.type(screen.getByTestId('new-patients-1'), '5');
      await user.type(screen.getByTestId('followup-patients-1'), '1');

      // Verify data
      expect(screen.getByTestId('new-patients-0')).toHaveValue(3);
      expect(screen.getByTestId('followup-patients-0')).toHaveValue(2);
      expect(screen.getByTestId('new-patients-1')).toHaveValue(5);
      expect(screen.getByTestId('followup-patients-1')).toHaveValue(1);

      // Remove first entry
      await user.click(screen.getByTestId('remove-entry-0'));

      await waitFor(() => {
        // The second entry should now be the first entry with preserved data
        expect(screen.getByTestId('new-patients-0')).toHaveValue(5);
        expect(screen.getByTestId('followup-patients-0')).toHaveValue(1);
      });
    });
  });

  describe('Validation Integration', () => {
    test('shows all validation errors on invalid submission', async () => {
      const mockSubmit = jest.fn();
      render(<TestFormComponent onSubmit={mockSubmit} />);

      await user.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('client-error')).toBeInTheDocument();
        expect(screen.getByTestId('activity-error')).toBeInTheDocument();
      });

      expect(mockSubmit).not.toHaveBeenCalled();
    });

    test('validates complex form with patient entries', async () => {
      const mockSubmit = jest.fn();
      render(<TestFormComponent onSubmit={mockSubmit} />);

      // Fill basic data
      await user.type(screen.getByTestId('client-input'), '550e8400-e29b-41d4-a716-446655440000');
      await user.type(screen.getByTestId('activity-input'), '550e8400-e29b-41d4-a716-446655440001');
      await user.clear(screen.getByTestId('patient-count-input'));
      await user.type(screen.getByTestId('patient-count-input'), '5');

      // Add patient entry with mismatched total
      await user.click(screen.getByTestId('add-entry'));
      await user.type(screen.getByTestId('new-patients-0'), '2');
      await user.type(screen.getByTestId('followup-patients-0'), '1'); // Total = 3, but patientCount = 5
      await user.type(screen.getByTestId('outcome-0'), '550e8400-e29b-41d4-a716-446655440002');

      await user.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        // Should show validation error for mismatched patient count
        expect(screen.getByText(/Patient entries must match the total patient count/)).toBeInTheDocument();
      });

      expect(mockSubmit).not.toHaveBeenCalled();
    });

    test('submits valid form data', async () => {
      const mockSubmit = jest.fn();
      render(<TestFormComponent onSubmit={mockSubmit} />);

      // Fill valid data
      await user.type(screen.getByTestId('client-input'), '550e8400-e29b-41d4-a716-446655440000');
      await user.type(screen.getByTestId('activity-input'), '550e8400-e29b-41d4-a716-446655440001');
      await user.clear(screen.getByTestId('patient-count-input'));
      await user.type(screen.getByTestId('patient-count-input'), '5');

      // Add matching patient entries
      await user.click(screen.getByTestId('add-entry'));
      await user.type(screen.getByTestId('new-patients-0'), '3');
      await user.type(screen.getByTestId('followup-patients-0'), '2'); // Total = 5, matches patientCount
      await user.type(screen.getByTestId('outcome-0'), '550e8400-e29b-41d4-a716-446655440002');

      await user.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({
          clientId: '550e8400-e29b-41d4-a716-446655440000',
          activityId: '550e8400-e29b-41d4-a716-446655440001',
          patientCount: 5,
          patientEntries: [
            {
              newPatients: 3,
              followupPatients: 2,
              dnaCount: 0,
              outcomeId: '550e8400-e29b-41d4-a716-446655440002',
            },
          ],
        });
      });
    });

    test('handles async validation errors', async () => {
      const mockSubmit = jest.fn().mockRejectedValue(new Error('Server validation error'));
      render(<TestFormComponent onSubmit={mockSubmit} />);

      // Fill valid data
      await user.type(screen.getByTestId('client-input'), '550e8400-e29b-41d4-a716-446655440000');
      await user.type(screen.getByTestId('activity-input'), '550e8400-e29b-41d4-a716-446655440001');

      await user.click(screen.getByTestId('add-entry'));
      await user.type(screen.getByTestId('new-patients-0'), '1');
      await user.type(screen.getByTestId('outcome-0'), '550e8400-e29b-41d4-a716-446655440002');

      await user.click(screen.getByTestId('submit-button'));

      // Should call submit function even though it rejects
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('Form Performance', () => {
    test('handles many patient entries efficiently', async () => {
      render(<TestFormComponent />);

      const startTime = performance.now();

      // Add many entries quickly
      for (let i = 0; i < 20; i++) {
        await user.click(screen.getByTestId('add-entry'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('entry-19')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle many entries within reasonable time
      expect(duration).toBeLessThan(2000); // 2 seconds
    });

    test('form validation is performant with many entries', async () => {
      render(<TestFormComponent />);

      // Add entries
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByTestId('add-entry'));
      }

      await waitFor(() => {
        expect(screen.getByTestId('entry-9')).toBeInTheDocument();
      });

      const startTime = performance.now();

      // Trigger validation by typing
      await user.type(screen.getByTestId('client-input'), '550e8400-e29b-41d4-a716-446655440000');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Validation should be fast even with many entries
      expect(duration).toBeLessThan(1000); // 1 second
    });
  });

  describe('Form Reset and Control', () => {
    test('resets form to initial state', async () => {
      const TestFormWithReset = () => {
        const form = useForm<ServiceLogFormData>({
          resolver: zodResolver(serviceLogFormSchema),
          mode: 'onChange',
          defaultValues: {
            clientId: '',
            activityId: '',
            patientCount: 1,
            patientEntries: [],
          },
        });

        return (
          <form>
            <input
              {...form.register('clientId')}
              data-testid="client-input"
            />
            <button
              type="button"
              onClick={() => form.reset()}
              data-testid="reset-button"
            >
              Reset
            </button>
            <span data-testid="is-dirty">{form.formState.isDirty ? 'dirty' : 'clean'}</span>
          </form>
        );
      };

      render(<TestFormWithReset />);

      const clientInput = screen.getByTestId('client-input');
      
      // Make form dirty
      await user.type(clientInput, 'test-value');
      
      await waitFor(() => {
        expect(screen.getByTestId('is-dirty')).toHaveTextContent('dirty');
      });

      // Reset form
      await user.click(screen.getByTestId('reset-button'));

      await waitFor(() => {
        expect(clientInput).toHaveValue('');
        expect(screen.getByTestId('is-dirty')).toHaveTextContent('clean');
      });
    });
  });

  describe('Error Boundaries and Edge Cases', () => {
    test('handles malformed field array data', async () => {
      const TestFormWithBadData = () => {
        const form = useForm<ServiceLogFormData>({
          resolver: zodResolver(serviceLogFormSchema),
          mode: 'onChange',
          defaultValues: {
            clientId: '',
            activityId: '',
            patientCount: 1,
            patientEntries: [null as any], // Bad data
          },
        });

        return (
          <form>
            <div data-testid="form-errors">
              {form.formState.errors.patientEntries && (
                <span>Patient entries error</span>
              )}
            </div>
          </form>
        );
      };

      // Should not crash with malformed data
      expect(() => render(<TestFormWithBadData />)).not.toThrow();
    });

    test('handles extremely large numbers', async () => {
      render(<TestFormComponent />);

      const patientCountInput = screen.getByTestId('patient-count-input');
      
      await user.clear(patientCountInput);
      await user.type(patientCountInput, String(Number.MAX_SAFE_INTEGER));
      
      await user.tab(); // Trigger validation

      await waitFor(() => {
        expect(screen.getByTestId('patient-count-error')).toBeInTheDocument();
      });
    });

    test('handles special characters in form fields', async () => {
      render(<TestFormComponent />);

      const clientInput = screen.getByTestId('client-input');
      
      await user.type(clientInput, '特殊字符<script>alert("xss")</script>');

      // Should not crash and should validate normally
      expect(clientInput).toHaveValue('特殊字符<script>alert("xss")</script>');
    });
  });
});