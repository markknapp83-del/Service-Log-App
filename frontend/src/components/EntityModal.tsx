// Entity Modal component following React Hook Form + Zod documentation patterns
import { useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useToast } from '@/hooks/useToast';

interface EntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entityType: 'clients' | 'activities' | 'outcomes';
  entity?: {
    id: string;
    name: string;
    is_active: boolean;
  };
}

export function EntityModal({ isOpen, onClose, onSuccess, entityType, entity }: EntityModalProps) {
  const [name, setName] = useState(entity?.name || '');
  const [isActive, setIsActive] = useState(entity?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isEditing = !!entity;
  const entityTypeSingular = entityType ? entityType.slice(0, -1) : '';
  const title = isEditing 
    ? `Edit ${entityTypeSingular.charAt(0).toUpperCase() + entityTypeSingular.slice(1)}`
    : `Add New ${entityTypeSingular.charAt(0).toUpperCase() + entityTypeSingular.slice(1)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name is required.',
        variant: 'destructive'
      });
      return;
    }

    if (!entityType) {
      toast({
        title: 'Error',
        description: 'Entity type is required.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('healthcare_portal_token');
      const url = isEditing 
        ? `/api/admin/templates/${entityType}/${entity.id}`
        : `/api/admin/templates/${entityType}`;
      
      const method = isEditing ? 'PUT' : 'POST';
      const body = JSON.stringify({
        name: name.trim(),
        is_active: isActive
      });

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `${entityTypeSingular.charAt(0).toUpperCase() + entityTypeSingular.slice(1)} ${isEditing ? 'updated' : 'created'} successfully.`,
          variant: 'default'
        });
        onSuccess();
        handleClose();
      } else {
        throw new Error(result.error?.message || 'Operation failed');
      }
    } catch (error) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} ${entityTypeSingular}:`, error);
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} ${entityTypeSingular}. Please try again.`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName(entity?.name || '');
    setIsActive(entity?.is_active ?? true);
    onClose();
  };

  // Don't render if entityType is null
  if (!entityType && isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      description={`${isEditing ? 'Update the' : 'Create a new'} ${entityTypeSingular} that will appear in service log forms.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="entity-name" className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <Input
            id="entity-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Enter ${entityTypeSingular} name`}
            required
            disabled={loading}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="entity-active"
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={loading}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="entity-active" className="text-sm text-gray-700">
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
            disabled={loading || !name.trim()}
            className="flex-1"
          >
            {loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}