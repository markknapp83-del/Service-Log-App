// TemplateManagementPage Component Tests following React Testing Library patterns
// Comprehensive tests for the template management page
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { TemplateManagementPage } from '@/pages/TemplateManagementPage';

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock the modal components
jest.mock('@/components/EntityModal', () => ({
  EntityModal: ({ isOpen, onClose, onSuccess, entityType, entity }: {
    isOpen: boolean;
    onClose: () => void; 
    onSuccess: () => void;
    entityType: string;
    entity?: any;
  }) => (
    <div data-testid="entity-modal">
      {isOpen && (
        <div>
          <h3>{entity ? 'Edit' : 'Add'} {entityType.slice(0, -1)}</h3>
          <button onClick={onClose}>Cancel</button>
          <button onClick={onSuccess}>Save</button>
        </div>
      )}
    </div>
  )
}));

jest.mock('@/components/CustomFieldModal', () => ({
  CustomFieldModal: ({ isOpen, onClose, onSuccess, field }: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    field?: any;
  }) => (
    <div data-testid="custom-field-modal">
      {isOpen && (
        <div>
          <h3>{field ? 'Edit' : 'Add'} Custom Field</h3>
          <button onClick={onClose}>Cancel</button>
          <button onClick={onSuccess}>Save</button>
        </div>
      )}
    </div>
  )
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

// Mock data
const mockClients = [
  {
    id: '1',
    name: 'Test Hospital',
    is_active: true,
    usage_count: 5
  },
  {
    id: '2', 
    name: 'Community Clinic',
    is_active: false,
    usage_count: 0
  }
];

const mockActivities = [
  {
    id: '1',
    name: 'Health Screening',
    is_active: true,
    usage_count: 10
  },
  {
    id: '2',
    name: 'Vaccination',
    is_active: false,
    usage_count: 2
  }
];

const mockOutcomes = [
  {
    id: '1',
    name: 'Successful Treatment',
    is_active: true,
    usage_count: 8
  },
  {
    id: '2',
    name: 'Follow-up Required',
    is_active: true,
    usage_count: 3
  }
];

const mockCustomFields = [
  {
    id: '1',
    field_label: 'Priority Level',
    field_type: 'dropdown',
    field_order: 1,
    is_active: true,
    choices: [
      { id: '1', field_id: '1', choice_text: 'High', choice_order: 1 },
      { id: '2', field_id: '1', choice_text: 'Medium', choice_order: 2 },
      { id: '3', field_id: '1', choice_text: 'Low', choice_order: 3 }
    ]
  },
  {
    id: '2',
    field_label: 'Service Category',
    field_type: 'dropdown',
    field_order: 2,
    is_active: false,
    choices: [
      { id: '4', field_id: '2', choice_text: 'Primary Care', choice_order: 1 },
      { id: '5', field_id: '2', choice_text: 'Specialty Care', choice_order: 2 }
    ]
  }
];

describe('TemplateManagementPage', () => {
  const mockFetch = jest.fn();
  
  beforeAll(() => {
    global.fetch = mockFetch;
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn()
      }
    });
  });

  beforeEach(() => {
    mockFetch.mockClear();
    mockToast.mockClear();
    
    // Setup default successful API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockClients })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockActivities })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockOutcomes })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockCustomFields })
      });
  });

  // ================================
  // BASIC RENDERING TESTS
  // ================================

  describe('Basic Rendering', () => {
    test('renders page title and description', async () => {
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      expect(screen.getByText('Template Management')).toBeInTheDocument();
      expect(screen.getByText('Configure form templates and options')).toBeInTheDocument();
    });

    test('shows loading state initially', () => {
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      expect(screen.getByText('Loading template data...')).toBeInTheDocument();
    });

    test('renders tab navigation', async () => {
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      // Check all tabs are present
      expect(screen.getByRole('tab', { name: 'Clients' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Activities' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Outcomes' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Custom Fields' })).toBeInTheDocument();
    });

    test('has proper accessibility labels', async () => {
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
      
      const tabs = screen.getAllByRole('tab');
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected');
      });
    });
  });

  // ================================
  // DATA LOADING TESTS
  // ================================

  describe('Data Loading', () => {
    test('loads template data on mount', async () => {
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(4);
      });

      // Verify API calls were made correctly
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/clients', {
        headers: { 'Authorization': 'Bearer mock-token' }
      });
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/activities', {
        headers: { 'Authorization': 'Bearer mock-token' }
      });
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/outcomes', {
        headers: { 'Authorization': 'Bearer mock-token' }
      });
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/custom-fields', {
        headers: { 'Authorization': 'Bearer mock-token' }
      });
    });

    test('handles API errors gracefully', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockActivities })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockOutcomes })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockCustomFields })
        });

      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to load template data. Please try again.',
          variant: 'destructive'
        });
      });
    });

    test('handles API response errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: false, error: { message: 'Server error' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockActivities })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockOutcomes })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockCustomFields })
        });

      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      // Should still render page but clients data would be empty
      expect(screen.getByText('Template Management')).toBeInTheDocument();
    });
  });

  // ================================
  // CLIENT TAB TESTS
  // ================================

  describe('Clients Tab', () => {
    test('displays clients list correctly', async () => {
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      // Should be on clients tab by default
      expect(screen.getByText('Test Hospital')).toBeInTheDocument();
      expect(screen.getByText('Community Clinic')).toBeInTheDocument();
      
      // Check usage counts
      expect(screen.getByText('Used in 5 service logs')).toBeInTheDocument();
      expect(screen.getByText('Used in 0 service logs')).toBeInTheDocument();
    });

    test('shows active/inactive status correctly', async () => {
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      // Check status indicators
      const activeStatus = screen.getAllByText('Active');
      const inactiveStatus = screen.getAllByText('Inactive');
      
      expect(activeStatus).toHaveLength(1); // Test Hospital
      expect(inactiveStatus).toHaveLength(1); // Community Clinic
    });

    test('opens add client modal', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: 'Add client' });
      await user.click(addButton);

      expect(screen.getByTestId('entity-modal')).toBeInTheDocument();
      expect(screen.getByText('Add client')).toBeInTheDocument();
    });

    test('opens edit client modal', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: 'Edit' });
      await user.click(editButtons[0]);

      expect(screen.getByTestId('entity-modal')).toBeInTheDocument();
      expect(screen.getByText('Edit client')).toBeInTheDocument();
    });

    test('toggles client active status', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const toggleSwitches = screen.getAllByRole('switch');
      await user.click(toggleSwitches[0]); // Toggle first client

      await waitFor(() => {
        expect(mockFetch).toHaveBeenLastCalledWith('/api/admin/templates/clients/1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({ is_active: false }) // Was true, should toggle to false
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'client deactivated successfully.',
        variant: 'default'
      });
    });

    test('handles toggle error gracefully', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const toggleSwitches = screen.getAllByRole('switch');
      await user.click(toggleSwitches[0]);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to update clients. Please try again.',
          variant: 'destructive'
        });
      });
    });
  });

  // ================================
  // ACTIVITIES TAB TESTS
  // ================================

  describe('Activities Tab', () => {
    test('switches to activities tab and displays data', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const activitiesTab = screen.getByRole('tab', { name: 'Activities' });
      await user.click(activitiesTab);

      expect(screen.getByText('Health Screening')).toBeInTheDocument();
      expect(screen.getByText('Vaccination')).toBeInTheDocument();
      expect(screen.getByText('Used in 10 service logs')).toBeInTheDocument();
      expect(screen.getByText('Used in 2 service logs')).toBeInTheDocument();
    });

    test('shows add activity button', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const activitiesTab = screen.getByRole('tab', { name: 'Activities' });
      await user.click(activitiesTab);

      expect(screen.getByRole('button', { name: 'Add activity' })).toBeInTheDocument();
    });
  });

  // ================================
  // OUTCOMES TAB TESTS
  // ================================

  describe('Outcomes Tab', () => {
    test('switches to outcomes tab and displays data', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const outcomesTab = screen.getByRole('tab', { name: 'Outcomes' });
      await user.click(outcomesTab);

      expect(screen.getByText('Successful Treatment')).toBeInTheDocument();
      expect(screen.getByText('Follow-up Required')).toBeInTheDocument();
      expect(screen.getByText('Used in 8 service logs')).toBeInTheDocument();
      expect(screen.getByText('Used in 3 service logs')).toBeInTheDocument();
    });

    test('shows add outcome button', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const outcomesTab = screen.getByRole('tab', { name: 'Outcomes' });
      await user.click(outcomesTab);

      expect(screen.getByRole('button', { name: 'Add outcome' })).toBeInTheDocument();
    });
  });

  // ================================
  // CUSTOM FIELDS TAB TESTS
  // ================================

  describe('Custom Fields Tab', () => {
    test('switches to custom fields tab and displays data', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const customFieldsTab = screen.getByRole('tab', { name: 'Custom Fields' });
      await user.click(customFieldsTab);

      expect(screen.getByText('Priority Level')).toBeInTheDocument();
      expect(screen.getByText('Service Category')).toBeInTheDocument();
      
      // Check field details
      expect(screen.getByText('dropdown • 3 choices • Order: 1')).toBeInTheDocument();
      expect(screen.getByText('dropdown • 2 choices • Order: 2')).toBeInTheDocument();
    });

    test('displays field choices preview', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const customFieldsTab = screen.getByRole('tab', { name: 'Custom Fields' });
      await user.click(customFieldsTab);

      // Check choice previews
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByText('Primary Care')).toBeInTheDocument();
      expect(screen.getByText('Specialty Care')).toBeInTheDocument();
    });

    test('shows field reordering controls', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const customFieldsTab = screen.getByRole('tab', { name: 'Custom Fields' });
      await user.click(customFieldsTab);

      // Check for move up/down buttons
      const moveUpButtons = screen.getAllByTitle('Move up');
      const moveDownButtons = screen.getAllByTitle('Move down');
      
      expect(moveUpButtons).toHaveLength(2);
      expect(moveDownButtons).toHaveLength(2);

      // First field's move up button should be disabled
      expect(moveUpButtons[0]).toBeDisabled();
      // Last field's move down button should be disabled  
      expect(moveDownButtons[1]).toBeDisabled();
    });

    test('handles field reordering', async () => {
      const user = userEvent.setup();
      
      // Mock successful reorder API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      // Mock reload API calls after reorder
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockClients })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockActivities })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockOutcomes })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockCustomFields })
        });

      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const customFieldsTab = screen.getByRole('tab', { name: 'Custom Fields' });
      await user.click(customFieldsTab);

      const moveDownButtons = screen.getAllByTitle('Move down');
      await user.click(moveDownButtons[0]); // Move first field down

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/custom-fields/1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({ field_order: 2 })
        });
      });
    });

    test('opens add custom field modal', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const customFieldsTab = screen.getByRole('tab', { name: 'Custom Fields' });
      await user.click(customFieldsTab);

      const addButton = screen.getByRole('button', { name: 'Add Custom Field' });
      await user.click(addButton);

      expect(screen.getByTestId('custom-field-modal')).toBeInTheDocument();
      expect(screen.getByText('Add Custom Field')).toBeInTheDocument();
    });

    test('opens edit custom field modal', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const customFieldsTab = screen.getByRole('tab', { name: 'Custom Fields' });
      await user.click(customFieldsTab);

      const editButtons = screen.getAllByRole('button', { name: 'Edit' });
      await user.click(editButtons[0]);

      expect(screen.getByTestId('custom-field-modal')).toBeInTheDocument();
      expect(screen.getByText('Edit Custom Field')).toBeInTheDocument();
    });
  });

  // ================================
  // MODAL INTERACTION TESTS
  // ================================

  describe('Modal Interactions', () => {
    test('handles entity modal success callback', async () => {
      const user = userEvent.setup();
      
      // Mock reload API calls after modal success
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockClients })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockActivities })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockOutcomes })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockCustomFields })
        });

      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: 'Add client' });
      await user.click(addButton);

      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);

      // Should reload data after successful modal operation
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(8); // 4 initial + 4 reload calls
      });
    });

    test('handles custom field modal success callback', async () => {
      const user = userEvent.setup();
      
      // Mock reload API calls after modal success
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockClients })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockActivities })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockOutcomes })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockCustomFields })
        });

      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const customFieldsTab = screen.getByRole('tab', { name: 'Custom Fields' });
      await user.click(customFieldsTab);

      const addButton = screen.getByRole('button', { name: 'Add Custom Field' });
      await user.click(addButton);

      const saveButton = screen.getByRole('button', { name: 'Save' });
      await user.click(saveButton);

      // Should reload data after successful modal operation
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(8); // 4 initial + 4 reload calls
      });
    });

    test('handles modal cancel', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: 'Add client' });
      await user.click(addButton);

      expect(screen.getByTestId('entity-modal')).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      // Modal should be closed - the mock shows modal only when isOpen is true
      expect(screen.queryByText('Add client')).not.toBeInTheDocument();
    });
  });

  // ================================
  // KEYBOARD NAVIGATION TESTS
  // ================================

  describe('Keyboard Navigation', () => {
    test('supports tab navigation', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      // Test tab key navigation through interactive elements
      await user.tab();
      expect(screen.getByRole('tab', { name: 'Clients' })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('tab', { name: 'Activities' })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('tab', { name: 'Outcomes' })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('tab', { name: 'Custom Fields' })).toHaveFocus();
    });

    test('supports arrow key navigation in tabs', async () => {
      const user = userEvent.setup();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const clientsTab = screen.getByRole('tab', { name: 'Clients' });
      clientsTab.focus();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Activities' })).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Outcomes' })).toHaveFocus();
    });
  });

  // ================================
  // ERROR HANDLING TESTS
  // ================================

  describe('Error Handling', () => {
    test('handles network errors during toggle operations', async () => {
      const user = userEvent.setup();
      
      // Setup initial successful load, then error on toggle
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const toggleSwitches = screen.getAllByRole('switch');
      await user.click(toggleSwitches[0]);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to update clients. Please try again.',
          variant: 'destructive'
        });
      });
    });

    test('handles API errors during field reordering', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockRejectedValueOnce(new Error('Server error'));

      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const customFieldsTab = screen.getByRole('tab', { name: 'Custom Fields' });
      await user.click(customFieldsTab);

      const moveDownButtons = screen.getAllByTitle('Move down');
      await user.click(moveDownButtons[0]);

      // Error should be handled gracefully (no toast expected for field reordering errors)
      // but the operation should fail silently or show appropriate error handling
      expect(screen.getByText('Priority Level')).toBeInTheDocument();
    });
  });

  // ================================
  // PERFORMANCE TESTS
  // ================================

  describe('Performance', () => {
    test('renders efficiently with many items', async () => {
      // Create large datasets
      const manyClients = Array.from({ length: 100 }, (_, i) => ({
        id: `client-${i}`,
        name: `Client ${i}`,
        is_active: i % 2 === 0,
        usage_count: i
      }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: manyClients })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockActivities })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockOutcomes })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockCustomFields })
        });

      const startTime = performance.now();
      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(1000); // 1 second

      // Should display all clients
      expect(screen.getByText('Client 0')).toBeInTheDocument();
      expect(screen.getByText('Client 99')).toBeInTheDocument();
    });
  });
});