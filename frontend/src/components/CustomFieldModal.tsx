// Custom Field Modal component following React Hook Form + Zod documentation patterns
import { useState, useEffect } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { useToast } from '@/hooks/useToast';

interface FieldChoice {
  id?: string;
  choice_text: string;
  choice_order: number;
}

interface CustomFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  field?: {
    id: string;
    field_label: string;
    field_type: string;
    field_order: number;
    is_active: boolean;
    choices: FieldChoice[];
  };
}

export function CustomFieldModal({ isOpen, onClose, onSuccess, field }: CustomFieldModalProps) {
  const [fieldLabel, setFieldLabel] = useState(field?.field_label || '');
  const [fieldType, setFieldType] = useState(field?.field_type || 'dropdown');
  const [fieldOrder, setFieldOrder] = useState(field?.field_order || 1);
  const [isActive, setIsActive] = useState(field?.is_active ?? true);
  const [choices, setChoices] = useState<FieldChoice[]>(
    field?.choices || [{ choice_text: '', choice_order: 1 }]
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isEditing = !!field;
  const title = isEditing ? 'Edit Custom Field' : 'Add New Custom Field';

  useEffect(() => {
    if (field) {
      setFieldLabel(field.field_label);
      setFieldType(field.field_type);
      setFieldOrder(field.field_order);
      setIsActive(field.is_active);
      setChoices(field.choices.length > 0 ? field.choices : [{ choice_text: '', choice_order: 1 }]);
    }
  }, [field]);

  const handleAddChoice = () => {
    const newOrder = Math.max(...choices.map(c => c.choice_order), 0) + 1;
    setChoices([...choices, { choice_text: '', choice_order: newOrder }]);
  };

  const handleRemoveChoice = (index: number) => {
    if (choices.length > 1) {
      setChoices(choices.filter((_, i) => i !== index));
    }
  };

  const handleChoiceChange = (index: number, text: string) => {
    const newChoices = [...choices];
    newChoices[index].choice_text = text;
    setChoices(newChoices);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fieldLabel.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Field label is required.',
        variant: 'destructive'
      });
      return;
    }

    if (fieldType === 'dropdown' && choices.some(c => !c.choice_text.trim())) {
      toast({
        title: 'Validation Error',
        description: 'All choice options must have text.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('authToken');
      
      // First create/update the field
      const fieldUrl = isEditing 
        ? `/api/admin/templates/custom-fields/${field.id}`
        : '/api/admin/templates/custom-fields';
      
      const fieldMethod = isEditing ? 'PUT' : 'POST';
      const fieldBody = JSON.stringify({
        field_label: fieldLabel.trim(),
        field_type: fieldType,
        field_order: fieldOrder,
        is_active: isActive
      });

      const fieldResponse = await fetch(fieldUrl, {
        method: fieldMethod,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: fieldBody
      });

      const fieldResult = await fieldResponse.json();

      if (!fieldResult.success) {
        throw new Error(fieldResult.error?.message || 'Failed to save field');
      }

      const fieldId = fieldResult.data.id;

      // If it's a dropdown field, handle the choices
      if (fieldType === 'dropdown') {
        // Delete existing choices if editing
        if (isEditing) {
          await fetch(`/api/admin/templates/custom-fields/${fieldId}/choices`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }

        // Add new choices
        for (const choice of choices.filter(c => c.choice_text.trim())) {
          await fetch(`/api/admin/templates/field-choices`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              field_id: fieldId,
              choice_text: choice.choice_text.trim(),
              choice_order: choice.choice_order
            })
          });
        }
      }

      toast({
        title: 'Success',
        description: `Custom field ${isEditing ? 'updated' : 'created'} successfully.`,
        variant: 'default'
      });
      onSuccess();
      handleClose();
    } catch (error) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} custom field:`, error);
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} custom field. Please try again.`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFieldLabel(field?.field_label || '');
    setFieldType(field?.field_type || 'dropdown');
    setFieldOrder(field?.field_order || 1);
    setIsActive(field?.is_active ?? true);
    setChoices(field?.choices || [{ choice_text: '', choice_order: 1 }]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description="Create or modify custom dropdown fields that appear in service log forms."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="field-label" className="block text-sm font-medium text-gray-700 mb-1">
            Field Label *
          </label>
          <Input
            id="field-label"
            type="text"
            value={fieldLabel}
            onChange={(e) => setFieldLabel(e.target.value)}
            placeholder="Enter field label"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="field-type" className="block text-sm font-medium text-gray-700 mb-1">
            Field Type
          </label>
          <Select
            id="field-type"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
            disabled={loading}
          >
            <option value="dropdown">Dropdown</option>
            <option value="text" disabled>Text (Coming Soon)</option>
            <option value="number" disabled>Number (Coming Soon)</option>
          </Select>
        </div>

        <div>
          <label htmlFor="field-order" className="block text-sm font-medium text-gray-700 mb-1">
            Display Order
          </label>
          <Input
            id="field-order"
            type="number"
            value={fieldOrder}
            onChange={(e) => setFieldOrder(parseInt(e.target.value) || 1)}
            min="1"
            disabled={loading}
          />
        </div>

        {fieldType === 'dropdown' && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Dropdown Options *
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddChoice}
                disabled={loading}
              >
                Add Option
              </Button>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {choices.map((choice, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    type="text"
                    value={choice.choice_text}
                    onChange={(e) => handleChoiceChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    required
                    disabled={loading}
                    className="flex-1"
                  />
                  {choices.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveChoice(index)}
                      disabled={loading}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            id="field-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={loading}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="field-active" className="text-sm text-gray-700">
            Active (visible in forms)
          </label>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || !fieldLabel.trim()}
            className="flex-1"
          >
            {loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}