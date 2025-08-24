// Client Field Manager component for admin field management
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Settings } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { ClientFieldModal } from './ClientFieldModal';
import { Modal } from './Modal';
import { useClientFieldManagement } from '../hooks/useClientCustomFields';
import { useToast } from '../hooks/useToast';
import { CustomFieldWithChoices } from '../services/customFieldApi';

interface ClientFieldManagerProps {
  clientId: string;
  clientName: string;
  className?: string;
}

export function ClientFieldManager({ 
  clientId, 
  clientName, 
  className = '' 
}: ClientFieldManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldWithChoices | null>(null);
  const [deletingField, setDeletingField] = useState<CustomFieldWithChoices | null>(null);
  const { showToast } = useToast();

  const {
    fields,
    isLoading,
    error,
    createField,
    updateField,
    deleteField,
    refreshFields,
  } = useClientFieldManagement({ clientId });

  // Handle field creation
  const handleCreateField = async (fieldData: any) => {
    try {
      await createField(fieldData);
      setShowCreateModal(false);
    } catch (error) {
      // Error handling is done in the hook
      console.error('Field creation failed:', error);
    }
  };

  // Handle field update
  const handleUpdateField = async (fieldData: any) => {
    if (!editingField) return;

    try {
      await updateField(editingField.id, fieldData);
      setEditingField(null);
    } catch (error) {
      // Error handling is done in the hook
      console.error('Field update failed:', error);
    }
  };

  // Handle field deletion
  const handleDeleteField = async () => {
    if (!deletingField) return;

    try {
      await deleteField(deletingField.id);
      setDeletingField(null);
    } catch (error) {
      // Error handling is done in the hook
      console.error('Field deletion failed:', error);
    }
  };

  // Confirm delete modal
  const ConfirmDeleteModal = () => (
    <Modal 
      isOpen={!!deletingField} 
      onClose={() => setDeletingField(null)}
      size="sm"
    >
      <div className="p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
          <Trash2 className="w-6 h-6 text-red-600" />
        </div>
        
        <h3 className="text-lg font-medium text-neutral-900 text-center mb-2">
          Delete Custom Field
        </h3>
        
        <p className="text-sm text-neutral-600 text-center mb-6">
          Are you sure you want to delete "{deletingField?.fieldLabel}"? 
          This action cannot be undone and will remove all data associated with this field.
        </p>
        
        <div className="flex justify-center space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDeletingField(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDeleteField}
          >
            Delete Field
          </Button>
        </div>
      </div>
    </Modal>
  );

  if (isLoading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="text-red-600 mb-2">Failed to load fields</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refreshFields()}
          >
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-neutral-900">
              Custom Fields
            </h2>
            <p className="text-sm text-neutral-600">
              Manage custom fields for {clientName}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Field
          </Button>
        </div>

        {fields.length === 0 ? (
          <div className="text-center py-8">
            <Settings className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-neutral-900 mb-2">
              No custom fields
            </h3>
            <p className="text-sm text-neutral-600 mb-4">
              Create custom fields that will appear when {clientName} is selected in service logs.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center mx-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Field
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field) => (
              <div
                key={field.id}
                className="border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium text-neutral-900">
                        {field.fieldLabel}
                      </h3>
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {field.fieldType}
                      </span>
                      {field.isRequired && (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                          Required
                        </span>
                      )}
                    </div>
                    
                    {field.fieldType === 'dropdown' && field.choices && field.choices.length > 0 && (
                      <div className="text-sm text-neutral-600">
                        <span className="font-medium">Choices:</span>{' '}
                        {field.choices.slice(0, 3).map(choice => choice.choiceText).join(', ')}
                        {field.choices.length > 3 && ` (+${field.choices.length - 3} more)`}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingField(field)}
                      className="p-2"
                      title="Edit field"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingField(field)}
                      className="p-2 text-red-600 hover:text-red-700"
                      title="Delete field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Field Modal */}
      <ClientFieldModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        clientId={clientId}
        clientName={clientName}
        onSave={handleCreateField}
      />

      {/* Edit Field Modal */}
      {editingField && (
        <ClientFieldModal
          isOpen={!!editingField}
          onClose={() => setEditingField(null)}
          clientId={clientId}
          clientName={clientName}
          onSave={handleUpdateField}
          // Note: You might want to add initialData prop to the modal for editing
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal />
    </>
  );
}

// Field preview component for testing
export function FieldPreview({ 
  field, 
  className = '' 
}: { 
  field: CustomFieldWithChoices; 
  className?: string; 
}) {
  return (
    <div className={`p-4 border border-neutral-200 rounded-lg bg-neutral-50 ${className}`}>
      <h4 className="text-sm font-medium text-neutral-900 mb-2">
        Preview: {field.fieldLabel}
        {field.isRequired && <span className="text-red-500 ml-1">*</span>}
      </h4>
      
      {field.fieldType === 'dropdown' && field.choices && (
        <select className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-sm">
          <option value="">Select {field.fieldLabel.toLowerCase()}</option>
          {field.choices.map(choice => (
            <option key={choice.id} value={choice.id}>
              {choice.choiceText}
            </option>
          ))}
        </select>
      )}
      
      {field.fieldType === 'text' && (
        <input
          type="text"
          placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
        />
      )}
      
      {field.fieldType === 'number' && (
        <input
          type="number"
          placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
        />
      )}
      
      {field.fieldType === 'date' && (
        <input
          type="date"
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
        />
      )}
    </div>
  );
}