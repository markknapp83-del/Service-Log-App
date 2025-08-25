// Template Management Page following React 18 and shadcn/ui documentation patterns
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs';
import { EntityModal } from '@/components/EntityModal';
import { CustomFieldModal } from '@/components/CustomFieldModal';
import { useToast } from '@/hooks/useToast';

interface Client {
  id: string;
  name: string;
  is_active: boolean;
  usage_count: number;
}

interface Activity {
  id: string;
  name: string;
  is_active: boolean;
  usage_count: number;
}

interface Outcome {
  id: string;
  name: string;
  is_active: boolean;
  usage_count: number;
}

interface CustomField {
  id: string;
  field_label: string;
  field_type: string;
  field_order: number;
  is_active: boolean;
  choices: FieldChoice[];
}

interface FieldChoice {
  id: string;
  field_id: string;
  choice_text: string;
  choice_order: number;
}

export function TemplateManagementPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clients');
  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<any>(null);
  const [customFieldModalOpen, setCustomFieldModalOpen] = useState(false);
  const [editingCustomField, setEditingCustomField] = useState<CustomField | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplateData();
  }, []);

  const loadTemplateData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('healthcare_portal_token');
      
      // Load all template data in parallel
      const [clientsRes, activitiesRes, outcomesRes, customFieldsRes] = await Promise.all([
        fetch('/api/admin/templates/clients', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/templates/activities', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/templates/outcomes', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/templates/custom-fields', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [clientsData, activitiesData, outcomesData, customFieldsData] = await Promise.all([
        clientsRes.json(),
        activitiesRes.json(),
        outcomesRes.json(),
        customFieldsRes.json()
      ]);

      if (clientsData.success) setClients(clientsData.data);
      if (activitiesData.success) setActivities(activitiesData.data);
      if (outcomesData.success) setOutcomes(outcomesData.data);
      if (customFieldsData.success) setCustomFields(customFieldsData.data);

    } catch (error) {
      console.error('Failed to load template data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load template data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (type: string, id: string, currentState: boolean) => {
    try {
      const token = localStorage.getItem('healthcare_portal_token');
      const response = await fetch(`/api/admin/templates/${type}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !currentState })
      });

      const result = await response.json();
      if (result.success) {
        // Update local state
        if (type === 'clients') {
          setClients(prev => prev.map(item => 
            item.id === id ? { ...item, is_active: !currentState } : item
          ));
        } else if (type === 'activities') {
          setActivities(prev => prev.map(item => 
            item.id === id ? { ...item, is_active: !currentState } : item
          ));
        } else if (type === 'outcomes') {
          setOutcomes(prev => prev.map(item => 
            item.id === id ? { ...item, is_active: !currentState } : item
          ));
        }

        toast({
          title: 'Success',
          description: `${type.slice(0, -1)} ${!currentState ? 'activated' : 'deactivated'} successfully.`,
          variant: 'default'
        });
      }
    } catch (error) {
      console.error(`Failed to toggle ${type}:`, error);
      toast({
        title: 'Error',
        description: `Failed to update ${type}. Please try again.`,
        variant: 'destructive'
      });
    }
  };

  const handleAddEntity = () => {
    setEditingEntity(null);
    setEntityModalOpen(true);
  };

  const handleEditEntity = (entity: any) => {
    setEditingEntity(entity);
    setEntityModalOpen(true);
  };

  const handleEntityModalSuccess = () => {
    loadTemplateData(); // Reload data after successful operation
  };

  const handleAddCustomField = () => {
    setEditingCustomField(null);
    setCustomFieldModalOpen(true);
  };

  const handleEditCustomField = (field: CustomField) => {
    setEditingCustomField(field);
    setCustomFieldModalOpen(true);
  };

  const handleCustomFieldModalSuccess = () => {
    loadTemplateData(); // Reload data after successful operation
  };

  const handleMoveCustomFieldUp = async (fieldId: string, currentOrder: number) => {
    const fieldsToUpdate = customFields
      .filter(f => f.field_order <= currentOrder)
      .sort((a, b) => b.field_order - a.field_order);
    
    if (fieldsToUpdate.length < 2) return;

    const currentField = fieldsToUpdate.find(f => f.id === fieldId);
    const previousField = fieldsToUpdate.find(f => f.field_order < currentOrder);

    if (!currentField || !previousField) return;

    await updateFieldOrder(currentField.id, previousField.field_order);
    await updateFieldOrder(previousField.id, currentField.field_order);
    loadTemplateData();
  };

  const handleMoveCustomFieldDown = async (fieldId: string, currentOrder: number) => {
    const fieldsToUpdate = customFields
      .filter(f => f.field_order >= currentOrder)
      .sort((a, b) => a.field_order - b.field_order);
    
    if (fieldsToUpdate.length < 2) return;

    const currentField = fieldsToUpdate.find(f => f.id === fieldId);
    const nextField = fieldsToUpdate.find(f => f.field_order > currentOrder);

    if (!currentField || !nextField) return;

    await updateFieldOrder(currentField.id, nextField.field_order);
    await updateFieldOrder(nextField.id, currentField.field_order);
    loadTemplateData();
  };

  const updateFieldOrder = async (fieldId: string, newOrder: number) => {
    try {
      const token = localStorage.getItem('healthcare_portal_token');
      await fetch(`/api/admin/templates/custom-fields/${fieldId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ field_order: newOrder })
      });
    } catch (error) {
      console.error('Failed to update field order:', error);
    }
  };

  const renderEntityList = (entities: Array<{id: string, name: string, is_active: boolean, usage_count: number}>, type: string) => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold capitalize">{type}</h3>
            <p className="text-sm text-muted-foreground">
              Manage {type} that appear in service log forms
            </p>
          </div>
          <Button onClick={handleAddEntity}>
            Add {type.slice(0, -1)}
          </Button>
        </div>
        
        <div className="grid gap-4">
          {entities.map((entity) => (
            <Card key={entity.id} className="transition-all hover:shadow-md">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{entity.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Used in {entity.usage_count} service {entity.usage_count === 1 ? 'log' : 'logs'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-600 mr-2">
                        {entity.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => handleToggleActive(type, entity.id, entity.is_active)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          entity.is_active ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                        role="switch"
                        aria-checked={entity.is_active}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            entity.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    <Button variant="ghost" size="sm" onClick={() => handleEditEntity(entity)}>
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderCustomFields = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Custom Fields</h3>
            <p className="text-sm text-gray-600">
              Manage custom dropdown fields that appear in the service log form
            </p>
          </div>
          <Button onClick={handleAddCustomField}>
            Add Custom Field
          </Button>
        </div>
        
        <div className="grid gap-4">
          {customFields
            .sort((a, b) => a.field_order - b.field_order)
            .map((field, index) => (
            <Card key={field.id} className="transition-all hover:shadow-md">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{field.field_label}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {field.field_type} • {field.choices.length} choices • Order: {field.field_order}
                    </p>
                    {field.choices.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Choices:</p>
                        <div className="flex flex-wrap gap-1">
                          {field.choices.slice(0, 3).map((choice) => (
                            <span key={choice.id} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs">
                              {choice.choice_text}
                            </span>
                          ))}
                          {field.choices.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-gray-600 text-xs">
                              +{field.choices.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Reorder Controls */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveCustomFieldUp(field.id, field.field_order)}
                        disabled={index === 0}
                        className={`p-1 rounded hover:bg-gray-100 ${index === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}
                        title="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveCustomFieldDown(field.id, field.field_order)}
                        disabled={index === customFields.length - 1}
                        className={`p-1 rounded hover:bg-gray-100 ${index === customFields.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'}`}
                        title="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center">
                      <span className="text-sm text-gray-600 mr-2">
                        {field.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => handleToggleActive('custom-fields', field.id, field.is_active)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          field.is_active ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                        role="switch"
                        aria-checked={field.is_active}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            field.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    <Button variant="ghost" size="sm" onClick={() => handleEditCustomField(field)}>
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Template Management</h1>
            <p className="text-gray-600">Configure form templates and options</p>
          </div>
          
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading template data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Template Management</h1>
          <p className="text-muted-foreground">Configure form templates and options</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="activities">Activities</TabsTrigger>
            <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
            <TabsTrigger value="custom-fields">Custom Fields</TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="mt-6">
            {renderEntityList(clients, 'clients')}
          </TabsContent>

          <TabsContent value="activities" className="mt-6">
            {renderEntityList(activities, 'activities')}
          </TabsContent>

          <TabsContent value="outcomes" className="mt-6">
            {renderEntityList(outcomes, 'outcomes')}
          </TabsContent>

          <TabsContent value="custom-fields" className="mt-6">
            {renderCustomFields()}
          </TabsContent>
        </Tabs>

        {/* Entity Modal for clients, activities, outcomes */}
        {activeTab !== 'custom-fields' && (
          <EntityModal
            isOpen={entityModalOpen}
            onClose={() => setEntityModalOpen(false)}
            onSuccess={handleEntityModalSuccess}
            entityType={activeTab as 'clients' | 'activities' | 'outcomes'}
            entity={editingEntity}
          />
        )}

        {/* Custom Field Modal */}
        <CustomFieldModal
          isOpen={customFieldModalOpen}
          onClose={() => setCustomFieldModalOpen(false)}
          onSuccess={handleCustomFieldModalSuccess}
          field={editingCustomField}
        />
      </div>
    </div>
  );
}