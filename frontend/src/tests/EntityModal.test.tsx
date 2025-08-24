// EntityModal Component Tests following React Testing Library patterns
// Tests for entity (clients, activities, outcomes) creation and editing modal
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityModal } from '@/components/EntityModal';

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock the Modal component
jest.mock('@/components/Modal', () => ({
  Modal: ({ children, isOpen, onClose, title, description }: any) => (
    <div data-testid="modal">
      {isOpen && (
        <div>
          <div data-testid="modal-title">{title}</div>
          <div data-testid="modal-description">{description}</div>
          <div data-testid="modal-content">{children}</div>
          <button onClick={onClose} data-testid="modal-close">Close Modal</button>
        </div>
      )}
    </div>
  )
}));

// Mock the Input and Button components
jest.mock('@/components/Input', () => ({
  Input: ({ id, value, onChange, placeholder, required, disabled, ...props }: any) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      data-testid={id}
      {...props}
    />
  )
}));

jest.mock('@/components/Button', () => ({
  Button: ({ children, onClick, disabled, type, variant, className }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      type={type}
      data-variant={variant}
      className={className}
      data-testid={`button-${children?.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {children}
    </button>
  )
}));

describe('EntityModal', () => {
  const mockFetch = jest.fn();
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeAll(() => {
    global.fetch = mockFetch;
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-auth-token'),
        setItem: jest.fn(),
        removeItem: jest.fn()
      }
    });
  });

  beforeEach(() => {
    mockFetch.mockClear();
    mockOnClose.mockClear();
    mockOnSuccess.mockClear();
    mockToast.mockClear();
  });

  // ================================
  // BASIC RENDERING TESTS
  // ================================

  describe('Basic Rendering', () => {
    test('does not render when closed', () => {
      render(
        <EntityModal
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      expect(screen.queryByTestId('modal-content')).not.toBeInTheDocument();
    });

    test('renders create modal for clients', () => {
      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      expect(screen.getByTestId('modal-title')).toHaveTextContent('Add New Client');
      expect(screen.getByTestId('modal-description')).toHaveTextContent('Create a new client that will appear in service log forms.');
      expect(screen.getByTestId('entity-name')).toBeInTheDocument();
      expect(screen.getByTestId('button-create')).toBeInTheDocument();
      expect(screen.getByTestId('button-cancel')).toBeInTheDocument();
    });

    test('renders create modal for activities', () => {
      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="activities"
        />
      );

      expect(screen.getByTestId('modal-title')).toHaveTextContent('Add New Activity');
      expect(screen.getByTestId('modal-description')).toHaveTextContent('Create a new activity that will appear in service log forms.');
    });

    test('renders create modal for outcomes', () => {
      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="outcomes"
        />
      );

      expect(screen.getByTestId('modal-title')).toHaveTextContent('Add New Outcome');
      expect(screen.getByTestId('modal-description')).toHaveTextContent('Create a new outcome that will appear in service log forms.');
    });

    test('renders edit modal with existing entity', () => {
      const existingEntity = {
        id: 'client-123',
        name: 'Existing Hospital',
        is_active: true
      };

      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
          entity={existingEntity}
        />
      );

      expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit Client');
      expect(screen.getByTestId('modal-description')).toHaveTextContent('Update the client that will appear in service log forms.');
      expect(screen.getByTestId('entity-name')).toHaveValue('Existing Hospital');
      expect(screen.getByRole('checkbox')).toBeChecked();
      expect(screen.getByTestId('button-update')).toBeInTheDocument();
    });

    test('has proper form labels and accessibility', () => {
      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      const nameLabel = screen.getByLabelText(/name/i);
      expect(nameLabel).toBeInTheDocument();
      expect(nameLabel).toHaveAttribute('required');

      const activeLabel = screen.getByLabelText(/active/i);
      expect(activeLabel).toBeInTheDocument();
      expect(activeLabel).toHaveAttribute('type', 'checkbox');
    });
  });

  // ================================
  // FORM INTERACTION TESTS
  // ================================

  describe('Form Interactions', () => {
    test('updates form fields correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      const activeCheckbox = screen.getByRole('checkbox');

      await user.type(nameInput, 'New Hospital');
      expect(nameInput).toHaveValue('New Hospital');

      await user.click(activeCheckbox);
      expect(activeCheckbox).toBeChecked();

      await user.click(activeCheckbox);
      expect(activeCheckbox).not.toBeChecked();
    });

    test('validates required name field', async () => {
      const user = userEvent.setup();
      
      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'Name is required.',
          variant: 'destructive'
        });
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('validates whitespace-only names', async () => {
      const user = userEvent.setup();
      
      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      await user.type(nameInput, '   '); // Only spaces

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'Name is required.',
          variant: 'destructive'
        });
      });
    });

    test('disables form during loading', async () => {
      const user = userEvent.setup();
      
      // Mock slow API response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { id: 'new-id' } })
        }), 100))
      );

      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      const submitButton = screen.getByTestId('button-create');

      await user.type(nameInput, 'Test Hospital');
      await user.click(submitButton);

      // During loading, form should be disabled
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('Saving...');
      expect(nameInput).toBeDisabled();

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });
  });

  // ================================
  // API INTEGRATION TESTS
  // ================================

  describe('API Integration - Create Operations', () => {
    test('creates new client successfully', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'new-client-id', name: 'New Hospital', is_active: true }
        })
      });

      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      await user.type(nameInput, 'New Hospital');

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token'
          },
          body: JSON.stringify({
            name: 'New Hospital',
            is_active: true
          })
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Client created successfully.',
        variant: 'default'
      });

      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    test('creates new activity successfully', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'new-activity-id', name: 'Health Screening', is_active: false }
        })
      });

      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="activities"
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      const activeCheckbox = screen.getByRole('checkbox');

      await user.type(nameInput, 'Health Screening');
      await user.click(activeCheckbox); // Uncheck active (default is true)

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/activities', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token'
          },
          body: JSON.stringify({
            name: 'Health Screening',
            is_active: false
          })
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Activity created successfully.',
        variant: 'default'
      });
    });

    test('trims whitespace from name', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'new-id', name: 'Trimmed Name', is_active: true }
        })
      });

      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="outcomes"
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      await user.type(nameInput, '  Trimmed Name  ');

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/outcomes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token'
          },
          body: JSON.stringify({
            name: 'Trimmed Name', // Should be trimmed
            is_active: true
          })
        });
      });
    });
  });

  describe('API Integration - Update Operations', () => {
    test('updates existing entity successfully', async () => {
      const user = userEvent.setup();
      const existingEntity = {
        id: 'client-123',
        name: 'Original Name',
        is_active: false
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'client-123', name: 'Updated Name', is_active: true }
        })
      });

      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
          entity={existingEntity}
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      const activeCheckbox = screen.getByRole('checkbox');

      // Clear and type new name
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');
      
      // Toggle active status
      await user.click(activeCheckbox);

      const submitButton = screen.getByTestId('button-update');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/clients/client-123', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token'
          },
          body: JSON.stringify({
            name: 'Updated Name',
            is_active: true
          })
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Client updated successfully.',
        variant: 'default'
      });
    });

    test('handles update with no changes', async () => {
      const user = userEvent.setup();
      const existingEntity = {
        id: 'client-123',
        name: 'Existing Name',
        is_active: true
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: existingEntity
        })
      });

      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
          entity={existingEntity}
        />
      );

      const submitButton = screen.getByTestId('button-update');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/clients/client-123', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token'
          },
          body: JSON.stringify({
            name: 'Existing Name',
            is_active: true
          })
        });
      });
    });
  });

  // ================================
  // ERROR HANDLING TESTS
  // ================================

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: { message: 'Client name already exists' }
        })
      });

      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      await user.type(nameInput, 'Duplicate Name');

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to create client. Please try again.',
          variant: 'destructive'
        });
      });

      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    test('handles network errors', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="activities"
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      await user.type(nameInput, 'Test Activity');

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to create activity. Please try again.',
          variant: 'destructive'
        });
      });
    });

    test('handles server error with custom message', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: { message: 'Custom error message' }
        })
      });

      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="outcomes"
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      await user.type(nameInput, 'Test Outcome');

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to create outcome. Please try again.',
          variant: 'destructive'
        });
      });
    });
  });

  // ================================
  // MODAL BEHAVIOR TESTS
  // ================================

  describe('Modal Behavior', () => {
    test('closes modal on cancel', async () => {
      const user = userEvent.setup();
      
      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      const cancelButton = screen.getByTestId('button-cancel');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('resets form state when closed and reopened', async () => {
      const user = userEvent.setup();
      
      const { rerender } = render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      await user.type(nameInput, 'Some Name');

      // Close modal
      rerender(
        <EntityModal
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      // Reopen modal
      rerender(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      // Form should be reset
      expect(screen.getByTestId('entity-name')).toHaveValue('');
      expect(screen.getByRole('checkbox')).toBeChecked(); // Default is true
    });

    test('preserves entity data when editing', () => {
      const existingEntity = {
        id: 'test-id',
        name: 'Test Entity',
        is_active: false
      };

      const { rerender } = render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
          entity={existingEntity}
        />
      );

      expect(screen.getByTestId('entity-name')).toHaveValue('Test Entity');
      expect(screen.getByRole('checkbox')).not.toBeChecked();

      // Close and reopen with same entity
      rerender(
        <EntityModal
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
          entity={existingEntity}
        />
      );

      rerender(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
          entity={existingEntity}
        />
      );

      // Should still show entity data
      expect(screen.getByTestId('entity-name')).toHaveValue('Test Entity');
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });
  });

  // ================================
  // KEYBOARD INTERACTION TESTS
  // ================================

  describe('Keyboard Interactions', () => {
    test('supports Enter key to submit form', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'new-id', name: 'New Entity', is_active: true }
        })
      });

      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      const nameInput = screen.getByTestId('entity-name');
      await user.type(nameInput, 'New Entity');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    test('supports Escape key to close modal', async () => {
      const user = userEvent.setup();
      
      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });

    test('supports Tab navigation between form elements', async () => {
      const user = userEvent.setup();
      
      render(
        <EntityModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          entityType="clients"
        />
      );

      await user.tab();
      expect(screen.getByTestId('entity-name')).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('checkbox')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('button-cancel')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('button-create')).toHaveFocus();
    });
  });
});