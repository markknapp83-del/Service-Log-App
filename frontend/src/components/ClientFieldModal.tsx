// Client Field Modal component following documented Modal + Form patterns
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Select, SelectOption } from './Select';
import { Modal } from './Modal';
import { useToast } from '../hooks/useToast';

// Field creation schema
const fieldSchema = z.object({
  fieldLabel: z.string().min(1, 'Field label is required'),
  fieldType: z.enum(['dropdown', 'text', 'number', 'date'], {
    errorMap: () => ({ message: 'Please select a field type' }),
  }),
  isRequired: z.boolean().optional(),
});

const choiceSchema = z.object({
  choiceText: z.string().min(1, 'Choice text is required'),
});

type FieldFormData = z.infer<typeof fieldSchema>;
type ChoiceFormData = z.infer<typeof choiceSchema>;

interface ClientFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName?: string;
  onSave: (fieldData: any) => Promise<void>;
}

export function ClientFieldModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  onSave,
}: ClientFieldModalProps) {
  const [choices, setChoices] = useState<Array<{ id: string; text: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FieldFormData>({
    resolver: zodResolver(fieldSchema),
    defaultValues: {
      isRequired: false,
    },
  });

  const fieldType = watch('fieldType');

  // Field type options
  const fieldTypeOptions: SelectOption[] = [
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
  ];

  // Add choice for dropdown fields
  const addChoice = () => {
    const newChoice = {
      id: crypto.randomUUID(),
      text: '',
    };
    setChoices([...choices, newChoice]);
  };

  // Remove choice
  const removeChoice = (id: string) => {
    setChoices(choices.filter(choice => choice.id !== id));
  };

  // Update choice text
  const updateChoice = (id: string, text: string) => {
    setChoices(choices.map(choice => 
      choice.id === id ? { ...choice, text } : choice
    ));
  };

  // Handle form submission
  const onSubmit = async (data: FieldFormData) => {
    try {
      setIsSubmitting(true);

      // Validate dropdown choices
      if (data.fieldType === 'dropdown') {
        const validChoices = choices.filter(choice => choice.text.trim());
        if (validChoices.length === 0) {
          showToast({
            type: 'error',
            message: 'Dropdown fields must have at least one choice',
          });
          return;
        }
      }

      // Prepare field data
      const fieldData = {
        ...data,
        clientId,
        fieldOrder: 0, // Default order, can be updated later
        isActive: true,
        ...(data.fieldType === 'dropdown' && {
          choices: choices
            .filter(choice => choice.text.trim())
            .map((choice, index) => ({
              choiceText: choice.text.trim(),
              choiceOrder: index,
            })),
        }),
      };

      await onSave(fieldData);
      handleClose();
    } catch (error) {
      // Error handling is done in the parent component
      console.error('Field creation failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    reset();
    setChoices([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-900">
            Add Custom Field
            {clientName && (
              <span className="text-sm font-normal text-neutral-600 block">
                for {clientName}
              </span>
            )}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Field Label */}
          <div>
            <Input
              label="Field Label"
              placeholder="e.g., Referral Source, Priority Level"
              {...register('fieldLabel')}
              error={errors.fieldLabel?.message}
              required
            />
          </div>

          {/* Field Type */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Field Type <span className="text-red-500">*</span>
            </label>
            <Select
              options={fieldTypeOptions}
              value={watch('fieldType') || ''}
              onValueChange={(value) => 
                register('fieldType').onChange({ target: { value } })
              }
              placeholder="Select field type"
              error={errors.fieldType?.message}
            />
          </div>

          {/* Required Toggle */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isRequired"
              {...register('isRequired')}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isRequired" className="ml-2 text-sm text-neutral-700">
              Make this field required
            </label>
          </div>

          {/* Dropdown Choices */}
          {fieldType === 'dropdown' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-neutral-700">
                  Dropdown Choices
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addChoice}
                  className="flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Choice
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {choices.map((choice, index) => (
                  <div key={choice.id} className="flex items-center space-x-2">
                    <Input
                      placeholder={`Choice ${index + 1}`}
                      value={choice.text}
                      onChange={(e) => updateChoice(choice.id, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChoice(choice.id)}
                      className="p-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {choices.length === 0 && (
                  <p className="text-sm text-neutral-500 py-4 text-center">
                    No choices added yet. Click "Add Choice" to start.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-200">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Field'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}