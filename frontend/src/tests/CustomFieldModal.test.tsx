// CustomFieldModal Component Tests following React Testing Library patterns
// Tests for custom field creation and editing modal with choices management
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomFieldModal } from '@/components/CustomFieldModal';

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock the Modal component
jest.mock('@/components/Modal', () => ({
  Modal: ({ children, isOpen, onClose, title, description, className }: any) => (
    <div data-testid="modal" className={className}>
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

// Mock the Input, Select, and Button components
jest.mock('@/components/Input', () => ({
  Input: ({ id, value, onChange, placeholder, required, disabled, type, min, className, ...props }: any) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      type={type}
      min={min}
      className={className}
      data-testid={id || `input-${type}`}
      {...props}
    />
  )
}));

jest.mock('@/components/Select', () => ({
  Select: ({ id, value, onChange, disabled, children }: any) => (
    <select
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      data-testid={id}
    >
      {children}
    </select>
  )
}));

jest.mock('@/components/Button', () => ({
  Button: ({ children, onClick, disabled, type, variant, size, className }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      type={type}
      data-variant={variant}
      data-size={size}
      className={className}
      data-testid={`button-${children?.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {children}
    </button>
  )
}));

describe('CustomFieldModal', () => {
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
        <CustomFieldModal
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByTestId('modal-content')).not.toBeInTheDocument();
    });

    test('renders create modal with default values', () => {
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByTestId('modal-title')).toHaveTextContent('Add New Custom Field');
      expect(screen.getByTestId('modal-description')).toHaveTextContent('Create or modify custom dropdown fields that appear in service log forms.');
      
      expect(screen.getByTestId('field-label')).toBeInTheDocument();
      expect(screen.getByTestId('field-type')).toBeInTheDocument();
      expect(screen.getByTestId('field-order')).toBeInTheDocument();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      
      // Should show dropdown options section by default
      expect(screen.getByText('Dropdown Options *')).toBeInTheDocument();
      expect(screen.getByTestId('button-add-option')).toBeInTheDocument();
      
      // Should have one default choice field
      const choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
      expect(choiceInputs).toHaveLength(1);
      
      expect(screen.getByTestId('button-create')).toBeInTheDocument();
      expect(screen.getByTestId('button-cancel')).toBeInTheDocument();
    });

    test('renders edit modal with existing field data', () => {
      const existingField = {
        id: 'field-123',
        field_label: 'Priority Level',
        field_type: 'dropdown',
        field_order: 5,
        is_active: false,
        choices: [
          { id: '1', choice_text: 'High', choice_order: 1 },
          { id: '2', choice_text: 'Medium', choice_order: 2 },
          { id: '3', choice_text: 'Low', choice_order: 3 }
        ]
      };

      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          field={existingField}
        />
      );

      expect(screen.getByTestId('modal-title')).toHaveTextContent('Edit Custom Field');
      
      expect(screen.getByTestId('field-label')).toHaveValue('Priority Level');
      expect(screen.getByTestId('field-type')).toHaveValue('dropdown');
      expect(screen.getByTestId('field-order')).toHaveValue('5');
      expect(screen.getByRole('checkbox')).not.toBeChecked();
      
      // Should show existing choices
      const choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
      expect(choiceInputs).toHaveLength(3);
      expect(choiceInputs[0]).toHaveValue('High');
      expect(choiceInputs[1]).toHaveValue('Medium');
      expect(choiceInputs[2]).toHaveValue('Low');
      
      expect(screen.getByTestId('button-update')).toBeInTheDocument();
    });

    test('has proper form labels and accessibility', () => {
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByLabelText(/field label/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/field type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/display order/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/active/i)).toBeInTheDocument();

      const fieldLabelInput = screen.getByTestId('field-label');
      expect(fieldLabelInput).toHaveAttribute('required');
    });

    test('shows modal with custom className', () => {
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const modal = screen.getByTestId('modal');
      expect(modal).toHaveClass('max-w-lg');
    });
  });

  // ================================
  // FORM FIELD INTERACTION TESTS
  // ================================

  describe('Form Field Interactions', () => {
    test('updates basic field values correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fieldLabelInput = screen.getByTestId('field-label');
      const fieldTypeSelect = screen.getByTestId('field-type');
      const fieldOrderInput = screen.getByTestId('field-order');
      const activeCheckbox = screen.getByRole('checkbox');

      await user.type(fieldLabelInput, 'Test Field');
      expect(fieldLabelInput).toHaveValue('Test Field');

      await user.selectOptions(fieldTypeSelect, 'dropdown');
      expect(fieldTypeSelect).toHaveValue('dropdown');

      await user.clear(fieldOrderInput);
      await user.type(fieldOrderInput, '3');
      expect(fieldOrderInput).toHaveValue('3');

      await user.click(activeCheckbox);
      expect(activeCheckbox).not.toBeChecked();
    });

    test('shows field type options correctly', () => {
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fieldTypeSelect = screen.getByTestId('field-type');
      const options = Array.from(fieldTypeSelect.querySelectorAll('option'));
      
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveValue('dropdown');
      expect(options[0]).not.toBeDisabled();
      expect(options[1]).toHaveValue('text');
      expect(options[1]).toBeDisabled();
      expect(options[2]).toHaveValue('number');
      expect(options[2]).toBeDisabled();
    });

    test('manages choice fields correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Add second choice
      const addButton = screen.getByTestId('button-add-option');
      await user.click(addButton);

      const choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
      expect(choiceInputs).toHaveLength(2);

      // Type in choice values
      await user.type(choiceInputs[0], 'First Choice');
      await user.type(choiceInputs[1], 'Second Choice');

      expect(choiceInputs[0]).toHaveValue('First Choice');
      expect(choiceInputs[1]).toHaveValue('Second Choice');

      // Add third choice
      await user.click(addButton);
      const updatedChoiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
      expect(updatedChoiceInputs).toHaveLength(3);
    });

    test('removes choice fields correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Add multiple choices
      const addButton = screen.getByTestId('button-add-option');
      await user.click(addButton);
      await user.click(addButton);

      let choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
      expect(choiceInputs).toHaveLength(3);

      // Remove buttons should be available (since we have more than 1 choice)
      const removeButtons = screen.getAllByTestId('button-remove');
      expect(removeButtons).toHaveLength(3);

      // Remove second choice
      await user.click(removeButtons[1]);

      choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
      expect(choiceInputs).toHaveLength(2);
    });

    test('prevents removing the last choice field', async () => {
      const user = userEvent.setup();
      
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Should start with one choice and no remove button
      const choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
      expect(choiceInputs).toHaveLength(1);
      
      const removeButtons = screen.queryAllByTestId('button-remove');
      expect(removeButtons).toHaveLength(0); // No remove button when only one choice
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
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fieldLabelInput = screen.getByTestId('field-label');
      const submitButton = screen.getByTestId('button-create');
      const addButton = screen.getByTestId('button-add-option');

      await user.type(fieldLabelInput, 'Test Field');
      await user.click(submitButton);

      // During loading, form should be disabled
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('Saving...');
      expect(fieldLabelInput).toBeDisabled();
      expect(addButton).toBeDisabled();
    });
  });

  // ================================
  // VALIDATION TESTS
  // ================================

  describe('Form Validation', () => {
    test('validates required field label', async () => {
      const user = userEvent.setup();
      
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'Field label is required.',
          variant: 'destructive'
        });
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('validates whitespace-only field labels', async () => {
      const user = userEvent.setup();
      
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fieldLabelInput = screen.getByTestId('field-label');
      await user.type(fieldLabelInput, '   '); // Only spaces

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'Field label is required.',
          variant: 'destructive'
        });
      });
    });

    test('validates dropdown fields have choice options', async () => {
      const user = userEvent.setup();
      
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fieldLabelInput = screen.getByTestId('field-label');
      await user.type(fieldLabelInput, 'Test Field');

      // Leave choice field empty
      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'All choice options must have text.',
          variant: 'destructive'
        });
      });
    });

    test('validates all choice options have text', async () => {
      const user = userEvent.setup();
      
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fieldLabelInput = screen.getByTestId('field-label');
      await user.type(fieldLabelInput, 'Test Field');

      // Add multiple choices but leave one empty
      const addButton = screen.getByTestId('button-add-option');
      await user.click(addButton);

      const choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
      await user.type(choiceInputs[0], 'Valid Choice');
      // Leave second choice empty

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Validation Error',
          description: 'All choice options must have text.',
          variant: 'destructive'
        });
      });
    });
  });

  // ================================
  // API INTEGRATION TESTS
  // ================================

  describe('API Integration - Create Operations', () => {
    test('creates new custom field with choices successfully', async () => {
      const user = userEvent.setup();
      
      // Mock field creation response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'new-field-id', field_label: 'Priority Level', field_type: 'dropdown' }
        })
      });

      // Mock choice creation responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} })
      });

      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Fill field details
      const fieldLabelInput = screen.getByTestId('field-label');
      const fieldOrderInput = screen.getByTestId('field-order');
      await user.type(fieldLabelInput, 'Priority Level');
      await user.clear(fieldOrderInput);
      await user.type(fieldOrderInput, '2');

      // Add choices
      const addButton = screen.getByTestId('button-add-option');
      await user.click(addButton);
      await user.click(addButton);

      const choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
      await user.type(choiceInputs[0], 'High');
      await user.type(choiceInputs[1], 'Medium');
      await user.type(choiceInputs[2], 'Low');

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        // Verify field creation API call
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/custom-fields', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token'
          },
          body: JSON.stringify({
            field_label: 'Priority Level',
            field_type: 'dropdown',
            field_order: 2,
            is_active: true
          })
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Custom field created successfully.',
        variant: 'default'
      });

      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    test('handles field creation with minimal choices', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'new-field-id' }
        })
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} })
      });

      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fieldLabelInput = screen.getByTestId('field-label');
      await user.type(fieldLabelInput, 'Simple Field');

      const choiceInput = screen.getByPlaceholderText(/option 1/i);
      await user.type(choiceInput, 'Single Option');

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/field-choices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token'
          },
          body: JSON.stringify({
            field_id: 'new-field-id',
            choice_text: 'Single Option',
            choice_order: 1
          })
        });
      });
    });
  });

  describe('API Integration - Update Operations', () => {
    test('updates existing custom field successfully', async () => {
      const user = userEvent.setup();
      const existingField = {
        id: 'field-123',
        field_label: 'Original Label',
        field_type: 'dropdown',
        field_order: 1,
        is_active: true,
        choices: [
          { id: '1', choice_text: 'Option 1', choice_order: 1 }
        ]
      };
      
      // Mock field update response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'field-123', field_label: 'Updated Label' }
        })
      });

      // Mock choice deletion and creation
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          field={existingField}
        />
      );

      const fieldLabelInput = screen.getByTestId('field-label');
      await user.clear(fieldLabelInput);
      await user.type(fieldLabelInput, 'Updated Label');

      const submitButton = screen.getByTestId('button-update');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/custom-fields/field-123', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-auth-token'
          },
          body: JSON.stringify({
            field_label: 'Updated Label',
            field_type: 'dropdown',
            field_order: 1,
            is_active: true
          })
        });
      });

      // Should also delete existing choices and create new ones
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/templates/custom-fields/field-123/choices', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer mock-auth-token' }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Custom field updated successfully.',
        variant: 'default'
      });
    });
  });

  // ================================
  // ERROR HANDLING TESTS
  // ================================

  describe('Error Handling', () => {
    test('handles field creation API errors', async () => {
      const user = userEvent.setup();
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: { message: 'Field label already exists' }
        })
      });

      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fieldLabelInput = screen.getByTestId('field-label');
      await user.type(fieldLabelInput, 'Duplicate Field');

      const choiceInput = screen.getByPlaceholderText(/option 1/i);
      await user.type(choiceInput, 'Test Choice');

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to create custom field. Please try again.',
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
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fieldLabelInput = screen.getByTestId('field-label');
      await user.type(fieldLabelInput, 'Test Field');

      const choiceInput = screen.getByPlaceholderText(/option 1/i);
      await user.type(choiceInput, 'Test Choice');

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to create custom field. Please try again.',
          variant: 'destructive'
        });
      });
    });

    test('handles choice creation errors during field creation', async () => {
      const user = userEvent.setup();
      
      // Field creation succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { id: 'new-field-id' }
        })
      });

      // Choice creation fails
      mockFetch.mockRejectedValueOnce(new Error('Choice creation failed'));

      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fieldLabelInput = screen.getByTestId('field-label');
      await user.type(fieldLabelInput, 'Test Field');

      const choiceInput = screen.getByPlaceholderText(/option 1/i);
      await user.type(choiceInput, 'Test Choice');

      const submitButton = screen.getByTestId('button-create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to create custom field. Please try again.',
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
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByTestId('button-cancel');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('resets form state when closed and reopened', () => {
      const { rerender } = render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Close modal
      rerender(
        <CustomFieldModal
          isOpen={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Reopen modal
      rerender(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Form should be reset
      expect(screen.getByTestId('field-label')).toHaveValue('');
      expect(screen.getByTestId('field-type')).toHaveValue('dropdown');
      expect(screen.getByTestId('field-order')).toHaveValue('1');
      expect(screen.getByRole('checkbox')).toBeChecked();
      
      // Should have one empty choice
      const choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
      expect(choiceInputs).toHaveLength(1);
      expect(choiceInputs[0]).toHaveValue('');
    });

    test('preserves field data when editing', () => {
      const existingField = {
        id: 'field-123',
        field_label: 'Test Field',
        field_type: 'dropdown',
        field_order: 3,
        is_active: false,
        choices: [
          { id: '1', choice_text: 'Choice A', choice_order: 1 },
          { id: '2', choice_text: 'Choice B', choice_order: 2 }
        ]
      };

      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          field={existingField}
        />
      );

      expect(screen.getByTestId('field-label')).toHaveValue('Test Field');
      expect(screen.getByTestId('field-type')).toHaveValue('dropdown');
      expect(screen.getByTestId('field-order')).toHaveValue('3');
      expect(screen.getByRole('checkbox')).not.toBeChecked();

      const choiceInputs = screen.getAllByPlaceholderText(/option \d+/i);
      expect(choiceInputs).toHaveLength(2);
      expect(choiceInputs[0]).toHaveValue('Choice A');
      expect(choiceInputs[1]).toHaveValue('Choice B');
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
          data: { id: 'new-id' }
        })
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const fieldLabelInput = screen.getByTestId('field-label');
      const choiceInput = screen.getByPlaceholderText(/option 1/i);
      
      await user.type(fieldLabelInput, 'Test Field');
      await user.type(choiceInput, 'Test Choice');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    test('supports Tab navigation between form elements', async () => {
      const user = userEvent.setup();
      
      render(
        <CustomFieldModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      await user.tab();
      expect(screen.getByTestId('field-label')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('field-type')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('field-order')).toHaveFocus();

      // Skip to choice input
      await user.tab();
      await user.tab();
      const choiceInput = screen.getByPlaceholderText(/option 1/i);
      expect(choiceInput).toHaveFocus();
    });
  });
});