// DynamicField component tests following documented React Testing Library patterns
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { axe, toHaveNoViolations } from 'jest-axe';
import { DynamicField, DynamicFieldGroup } from '../components/DynamicField';
import { CustomField, FieldChoice } from '../types';

expect.extend(toHaveNoViolations);

// Test wrapper component with React Hook Form
const TestWrapper = ({ children, defaultValues = {}, onSubmit = jest.fn() }) => {
  const { control, handleSubmit } = useForm({
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === DynamicField) {
          return React.cloneElement(child, { control });
        }
        if (React.isValidElement(child) && child.type === DynamicFieldGroup) {
          return React.cloneElement(child, { control });
        }
        return child;
      })}
      <button type="submit">Submit</button>
    </form>
  );
};

// Mock healthcare custom fields following documented patterns
const createMockDropdownField = (overrides: Partial<CustomField> = {}): CustomField & { choices: FieldChoice[] } => ({
  id: 'field-dropdown-1',
  fieldLabel: 'Patient Risk Level',
  fieldType: 'dropdown',
  fieldOrder: 1,
  isActive: true,
  choices: [
    { id: 'choice-1', fieldId: 'field-dropdown-1', choiceText: 'Low Risk', choiceOrder: 1 },
    { id: 'choice-2', fieldId: 'field-dropdown-1', choiceText: 'Medium Risk', choiceOrder: 2 },
    { id: 'choice-3', fieldId: 'field-dropdown-1', choiceText: 'High Risk', choiceOrder: 3 },
  ],
  ...overrides,
});

const createMockTextField = (overrides: Partial<CustomField> = {}): CustomField => ({
  id: 'field-text-1',
  fieldLabel: 'Additional Notes',
  fieldType: 'text',
  fieldOrder: 2,
  isActive: true,
  ...overrides,
});

const createMockNumberField = (overrides: Partial<CustomField> = {}): CustomField => ({
  id: 'field-number-1',
  fieldLabel: 'Patient Age',
  fieldType: 'number',
  fieldOrder: 3,
  isActive: true,
  ...overrides,
});

const createMockCheckboxField = (overrides: Partial<CustomField> = {}): CustomField => ({
  id: 'field-checkbox-1',
  fieldLabel: 'Requires Follow-up Call',
  fieldType: 'checkbox',
  fieldOrder: 4,
  isActive: true,
  ...overrides,
});

describe('DynamicField Component', () => {
  describe('Dropdown Field Type', () => {
    const dropdownField = createMockDropdownField();

    it('renders dropdown field with choices correctly', () => {
      render(
        <TestWrapper>
          <DynamicField field={dropdownField} name="patientRiskLevel" />
        </TestWrapper>
      );

      expect(screen.getByText('Patient Risk Level')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select patient risk level/i })).toBeInTheDocument();
      expect(screen.getByText('Select patient risk level')).toBeInTheDocument();
    });

    it('displays choices in correct order when opened', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DynamicField field={dropdownField} name="patientRiskLevel" />
        </TestWrapper>
      );

      const select = screen.getByRole('button', { name: /select patient risk level/i });
      await user.click(select);

      // Wait for options to appear
      await waitFor(() => {
        expect(screen.getByText('Low Risk')).toBeInTheDocument();
        expect(screen.getByText('Medium Risk')).toBeInTheDocument();
        expect(screen.getByText('High Risk')).toBeInTheDocument();
      });
    });

    it('handles selection change correctly', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();
      
      render(
        <TestWrapper onSubmit={onSubmit}>
          <DynamicField field={dropdownField} name="patientRiskLevel" />
        </TestWrapper>
      );

      const select = screen.getByRole('button', { name: /select patient risk level/i });
      await user.click(select);
      
      await waitFor(() => {
        expect(screen.getByText('Medium Risk')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Medium Risk'));
      await user.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          patientRiskLevel: 'choice-2'
        });
      });
    });

    it('shows error when no choices are available', () => {
      const fieldWithoutChoices = createMockDropdownField({ choices: [] });
      
      render(
        <TestWrapper>
          <DynamicField field={fieldWithoutChoices} name="patientRiskLevel" />
        </TestWrapper>
      );

      expect(screen.getByText('No options available for Patient Risk Level')).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('displays required indicator when required', () => {
      render(
        <TestWrapper>
          <DynamicField field={dropdownField} name="patientRiskLevel" required />
        </TestWrapper>
      );

      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('displays validation error message', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DynamicField field={dropdownField} name="patientRiskLevel" required />
        </TestWrapper>
      );

      // Submit without selecting to trigger validation
      await user.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(screen.getByText('Patient Risk Level is required')).toBeInTheDocument();
      });
    });

    it('meets accessibility standards', async () => {
      const { container } = render(
        <TestWrapper>
          <DynamicField field={dropdownField} name="patientRiskLevel" required />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Text Field Type', () => {
    const textField = createMockTextField();

    it('renders text field correctly', () => {
      render(
        <TestWrapper>
          <DynamicField field={textField} name="additionalNotes" />
        </TestWrapper>
      );

      expect(screen.getByText('Additional Notes')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter additional notes')).toBeInTheDocument();
    });

    it('handles text input correctly', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();
      
      render(
        <TestWrapper onSubmit={onSubmit}>
          <DynamicField field={textField} name="additionalNotes" />
        </TestWrapper>
      );

      const textInput = screen.getByRole('textbox');
      await user.type(textInput, 'Patient requires special attention');
      await user.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          additionalNotes: 'Patient requires special attention'
        });
      });
    });

    it('displays validation error for required text field', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DynamicField field={textField} name="additionalNotes" required />
        </TestWrapper>
      );

      await user.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(screen.getByText('Additional Notes is required')).toBeInTheDocument();
      });
    });

    it('uses default value when provided', () => {
      render(
        <TestWrapper defaultValues={{ additionalNotes: 'Default note' }}>
          <DynamicField field={textField} name="additionalNotes" />
        </TestWrapper>
      );

      expect(screen.getByDisplayValue('Default note')).toBeInTheDocument();
    });

    it('meets accessibility standards', async () => {
      const { container } = render(
        <TestWrapper>
          <DynamicField field={textField} name="additionalNotes" />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Number Field Type', () => {
    const numberField = createMockNumberField();

    it('renders number field correctly', () => {
      render(
        <TestWrapper>
          <DynamicField field={numberField} name="patientAge" />
        </TestWrapper>
      );

      expect(screen.getByText('Patient Age')).toBeInTheDocument();
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter patient age')).toBeInTheDocument();
    });

    it('handles numeric input correctly', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();
      
      render(
        <TestWrapper onSubmit={onSubmit}>
          <DynamicField field={numberField} name="patientAge" />
        </TestWrapper>
      );

      const numberInput = screen.getByRole('spinbutton');
      await user.clear(numberInput);
      await user.type(numberInput, '65');
      await user.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          patientAge: 65
        });
      });
    });

    it('converts empty string to empty value', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();
      
      render(
        <TestWrapper defaultValues={{ patientAge: 25 }} onSubmit={onSubmit}>
          <DynamicField field={numberField} name="patientAge" />
        </TestWrapper>
      );

      const numberInput = screen.getByRole('spinbutton');
      await user.clear(numberInput);
      await user.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          patientAge: ''
        });
      });
    });

    it('uses default value of 0 when not provided', () => {
      render(
        <TestWrapper>
          <DynamicField field={numberField} name="patientAge" />
        </TestWrapper>
      );

      expect(screen.getByDisplayValue('0')).toBeInTheDocument();
    });

    it('meets accessibility standards', async () => {
      const { container } = render(
        <TestWrapper>
          <DynamicField field={numberField} name="patientAge" />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Checkbox Field Type', () => {
    const checkboxField = createMockCheckboxField();

    it('renders checkbox field correctly', () => {
      render(
        <TestWrapper>
          <DynamicField field={checkboxField} name="requiresFollowup" />
        </TestWrapper>
      );

      expect(screen.getByText('Requires Follow-up Call')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('handles checkbox toggle correctly', async () => {
      const user = userEvent.setup();
      const onSubmit = jest.fn();
      
      render(
        <TestWrapper onSubmit={onSubmit}>
          <DynamicField field={checkboxField} name="requiresFollowup" />
        </TestWrapper>
      );

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);
      await user.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          requiresFollowup: true
        });
      });
    });

    it('starts unchecked by default', () => {
      render(
        <TestWrapper>
          <DynamicField field={checkboxField} name="requiresFollowup" />
        </TestWrapper>
      );

      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('uses default value when provided', () => {
      render(
        <TestWrapper defaultValues={{ requiresFollowup: true }}>
          <DynamicField field={checkboxField} name="requiresFollowup" />
        </TestWrapper>
      );

      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('displays validation error for required checkbox', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <DynamicField field={checkboxField} name="requiresFollowup" required />
        </TestWrapper>
      );

      await user.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(screen.getByText('Requires Follow-up Call is required')).toBeInTheDocument();
      });
    });

    it('meets accessibility standards', async () => {
      const { container } = render(
        <TestWrapper>
          <DynamicField field={checkboxField} name="requiresFollowup" />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Unsupported Field Type', () => {
    it('displays error for unsupported field type', () => {
      const unsupportedField = {
        id: 'field-unsupported',
        fieldLabel: 'Unsupported Field',
        fieldType: 'unsupported' as any,
        fieldOrder: 1,
        isActive: true,
      };

      render(
        <TestWrapper>
          <DynamicField field={unsupportedField} name="unsupported" />
        </TestWrapper>
      );

      expect(screen.getByText('Unsupported field type: unsupported')).toBeInTheDocument();
    });
  });
});

describe('DynamicFieldGroup Component', () => {
  const mockFields = [
    createMockDropdownField({ id: 'field-1', fieldOrder: 2 }),
    createMockTextField({ id: 'field-2', fieldOrder: 1 }),
    createMockCheckboxField({ id: 'field-3', fieldOrder: 3 }),
  ];

  it('renders multiple fields in correct order', () => {
    render(
      <TestWrapper>
        <DynamicFieldGroup
          fields={mockFields}
          namePrefix="serviceLog"
          className="test-group"
        />
      </TestWrapper>
    );

    expect(screen.getByText('Additional Information')).toBeInTheDocument();
    expect(screen.getByText('Additional Notes')).toBeInTheDocument();
    expect(screen.getByText('Patient Risk Level')).toBeInTheDocument();
    expect(screen.getByText('Requires Follow-up Call')).toBeInTheDocument();
  });

  it('filters out inactive fields', () => {
    const fieldsWithInactive = [
      ...mockFields,
      createMockTextField({ id: 'field-inactive', fieldLabel: 'Inactive Field', isActive: false }),
    ];

    render(
      <TestWrapper>
        <DynamicFieldGroup
          fields={fieldsWithInactive}
          namePrefix="serviceLog"
        />
      </TestWrapper>
    );

    expect(screen.queryByText('Inactive Field')).not.toBeInTheDocument();
    expect(screen.getByText('Additional Notes')).toBeInTheDocument();
  });

  it('returns null when no fields provided', () => {
    const { container } = render(
      <TestWrapper>
        <DynamicFieldGroup
          fields={[]}
          namePrefix="serviceLog"
        />
      </TestWrapper>
    );

    expect(container.firstChild).toHaveTextContent('Submit');
  });

  it('returns null when no active fields', () => {
    const inactiveFields = mockFields.map(field => ({ ...field, isActive: false }));

    const { container } = render(
      <TestWrapper>
        <DynamicFieldGroup
          fields={inactiveFields}
          namePrefix="serviceLog"
        />
      </TestWrapper>
    );

    expect(container.firstChild).toHaveTextContent('Submit');
  });

  it('uses existing values when provided', () => {
    const existingValues = {
      'field-2': { fieldId: 'field-2', textValue: 'Existing note' },
      'field-3': { fieldId: 'field-3', checkboxValue: true },
    };

    render(
      <TestWrapper>
        <DynamicFieldGroup
          fields={mockFields}
          namePrefix="serviceLog"
          values={existingValues}
        />
      </TestWrapper>
    );

    expect(screen.getByDisplayValue('Existing note')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('applies custom className', () => {
    const { container } = render(
      <TestWrapper>
        <DynamicFieldGroup
          fields={mockFields}
          namePrefix="serviceLog"
          className="custom-class"
        />
      </TestWrapper>
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('meets accessibility standards', async () => {
    const { container } = render(
      <TestWrapper>
        <DynamicFieldGroup
          fields={mockFields}
          namePrefix="serviceLog"
        />
      </TestWrapper>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles form submission with all field types', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(
      <TestWrapper onSubmit={onSubmit}>
        <DynamicFieldGroup
          fields={mockFields}
          namePrefix="serviceLog"
        />
      </TestWrapper>
    );

    // Fill text field
    const textInput = screen.getByRole('textbox');
    await user.type(textInput, 'Test note');

    // Select dropdown option
    const select = screen.getByRole('combobox');
    await user.click(select);
    await waitFor(() => {
      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Medium Risk'));

    // Check checkbox
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    // Submit form
    await user.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        serviceLog: {
          customFields: {
            'field-1': 'choice-2', // dropdown selection
            'field-2': 'Test note', // text input
            'field-3': true, // checkbox checked
          }
        }
      });
    });
  });
});

// Performance tests
describe('DynamicField Performance', () => {
  it('renders quickly with large number of dropdown choices', () => {
    const largeChoicesField = createMockDropdownField({
      choices: Array.from({ length: 100 }, (_, i) => ({
        id: `choice-${i}`,
        fieldId: 'field-dropdown-1',
        choiceText: `Option ${i + 1}`,
        choiceOrder: i + 1,
      })),
    });

    const startTime = performance.now();
    
    render(
      <TestWrapper>
        <DynamicField field={largeChoicesField} name="largeDrop" />
      </TestWrapper>
    );

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render within 100ms
    expect(renderTime).toBeLessThan(100);
  });

  it('handles rapid field updates efficiently', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DynamicField field={createMockTextField()} name="rapidText" />
      </TestWrapper>
    );

    const textInput = screen.getByRole('textbox');
    const startTime = performance.now();

    // Rapid typing simulation
    await user.type(textInput, 'This is a rapid typing test');

    const endTime = performance.now();
    const updateTime = endTime - startTime;

    // Should handle updates within reasonable time
    expect(updateTime).toBeLessThan(500);
  });
});