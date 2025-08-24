// Dynamic Field component following documented React Hook Form + shadcn/ui patterns
import React from 'react';
import { Control, useController, FieldError } from 'react-hook-form';
import { Input } from './Input';
import { Select, SelectOption } from './Select';
import { CustomField, CustomFieldValue, FieldChoice } from '../types';

interface DynamicFieldProps {
  field: CustomField & { choices?: FieldChoice[] };
  control: Control<any>;
  name: string;
  error?: FieldError;
  required?: boolean;
  defaultValue?: string | number | boolean;
}

export function DynamicField({
  field,
  control,
  name,
  error,
  required = false,
  defaultValue
}: DynamicFieldProps) {
  const {
    field: controllerField,
    fieldState: { error: fieldError }
  } = useController({
    name,
    control,
    defaultValue: defaultValue || getDefaultValueForFieldType(field.fieldType),
    rules: {
      required: required ? `${field.fieldLabel} is required` : false,
    }
  });

  const displayError = error || fieldError;

  switch (field.fieldType) {
    case 'dropdown': {
      if (!field.choices || field.choices.length === 0) {
        return (
          <div className="text-sm text-red-600 p-2 border border-red-200 rounded-md bg-red-50">
            No options available for {field.fieldLabel}
          </div>
        );
      }

      const options: SelectOption[] = field.choices
        .sort((a, b) => a.choiceOrder - b.choiceOrder)
        .map(choice => ({
          value: choice.id.toString(),
          label: choice.choiceText
        }));

      return (
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            {field.fieldLabel}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <Select
            options={options}
            value={controllerField.value || ''}
            onValueChange={(value) => controllerField.onChange(value)}
            placeholder={`Select ${field.fieldLabel.toLowerCase()}`}
            error={displayError?.message}
            aria-describedby={displayError ? `${name}-error` : undefined}
          />
          {displayError && (
            <div id={`${name}-error`} className="mt-1 text-sm text-red-600">
              {displayError.message}
            </div>
          )}
        </div>
      );
    }

    case 'text': {
      return (
        <Input
          label={field.fieldLabel}
          type="text"
          value={controllerField.value || ''}
          onChange={(e) => controllerField.onChange(e.target.value)}
          onBlur={controllerField.onBlur}
          error={displayError?.message}
          required={required}
          placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
          aria-describedby={displayError ? `${name}-error` : undefined}
        />
      );
    }

    case 'number': {
      return (
        <Input
          label={field.fieldLabel}
          type="number"
          value={controllerField.value || ''}
          onChange={(e) => {
            const value = e.target.value === '' ? '' : Number(e.target.value);
            controllerField.onChange(value);
          }}
          onBlur={controllerField.onBlur}
          error={displayError?.message}
          required={required}
          placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
          aria-describedby={displayError ? `${name}-error` : undefined}
        />
      );
    }

    case 'checkbox': {
      return (
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id={name}
            checked={Boolean(controllerField.value)}
            onChange={(e) => controllerField.onChange(e.target.checked)}
            onBlur={controllerField.onBlur}
            className="mt-1 h-4 w-4 text-blue-600 border-neutral-300 rounded focus:ring-blue-500 focus:ring-2"
            aria-describedby={displayError ? `${name}-error` : undefined}
          />
          <div className="flex-1">
            <label htmlFor={name} className="text-sm font-medium text-neutral-700">
              {field.fieldLabel}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {displayError && (
              <div id={`${name}-error`} className="mt-1 text-sm text-red-600">
                {displayError.message}
              </div>
            )}
          </div>
        </div>
      );
    }

    default: {
      return (
        <div className="text-sm text-red-600 p-2 border border-red-200 rounded-md bg-red-50">
          Unsupported field type: {field.fieldType}
        </div>
      );
    }
  }
}

// Helper function to get default values based on field type
function getDefaultValueForFieldType(fieldType: string): string | number | boolean {
  switch (fieldType) {
    case 'dropdown':
    case 'text':
      return '';
    case 'number':
      return 0;
    case 'checkbox':
      return false;
    default:
      return '';
  }
}

// Component for rendering multiple dynamic fields
interface DynamicFieldGroupProps {
  fields: Array<CustomField & { choices?: FieldChoice[] }>;
  control: Control<any>;
  namePrefix: string;
  errors?: Record<string, FieldError>;
  values?: Record<string, CustomFieldValue>;
  className?: string;
}

export function DynamicFieldGroup({
  fields,
  control,
  namePrefix,
  errors,
  values,
  className = ''
}: DynamicFieldGroupProps) {
  if (!fields || fields.length === 0) {
    return null;
  }

  const activeFields = fields
    .filter(field => field.isActive)
    .sort((a, b) => a.fieldOrder - b.fieldOrder);

  if (activeFields.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-sm font-medium text-neutral-700 border-b border-neutral-200 pb-2">
        Additional Information
      </h3>
      {activeFields.map(field => {
        const fieldName = `${namePrefix}.customFields.${field.id}`;
        const existingValue = values?.[field.id.toString()];
        
        let defaultValue: string | number | boolean = getDefaultValueForFieldType(field.fieldType);
        
        // Set default value from existing data
        if (existingValue) {
          switch (field.fieldType) {
            case 'dropdown':
              defaultValue = existingValue.choiceId?.toString() || '';
              break;
            case 'text':
              defaultValue = existingValue.textValue || '';
              break;
            case 'number':
              defaultValue = existingValue.numberValue || 0;
              break;
            case 'checkbox':
              defaultValue = existingValue.checkboxValue || false;
              break;
          }
        }

        return (
          <DynamicField
            key={field.id}
            field={field}
            control={control}
            name={fieldName}
            error={errors?.[field.id.toString()]}
            defaultValue={defaultValue}
          />
        );
      })}
    </div>
  );
}