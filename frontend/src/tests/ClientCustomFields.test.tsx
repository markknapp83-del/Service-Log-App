// Tests for client-specific custom fields functionality
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceLogForm } from '../components/ServiceLogForm';
import { ClientFieldManager } from '../components/ClientFieldManager';
import { customFieldApi } from '../services/customFieldApi';
import { TestWrapper } from './TestWrapper';

// Mock the API service
vi.mock('../services/customFieldApi', () => ({
  customFieldApi: {
    getFormConfig: vi.fn(),
    getClientFields: vi.fn(),
    createClientField: vi.fn(),
    updateClientField: vi.fn(),
    deleteClientField: vi.fn(),
  },
}));

// Mock the auth hook
const mockUser = { id: '1', email: 'admin@test.com', role: 'admin' };
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
  }),
}));

// Mock data
const mockClients = [
  { id: '1', name: 'General Hospital', isActive: true },
  { id: '2', name: 'Community Clinic', isActive: true },
];

const mockActivities = [
  { id: '1', name: 'Consultation', isActive: true },
];

const mockOutcomes = [
  { id: '1', name: 'Completed', isActive: true },
];

const mockClientFields = [
  {
    id: '1',
    fieldLabel: 'Priority Level',
    fieldType: 'dropdown' as const,
    fieldOrder: 0,
    isActive: true,
    isRequired: false,
    clientId: '1',
    choices: [
      { id: '1', fieldId: '1', choiceText: 'High', choiceOrder: 0 },
      { id: '2', fieldId: '1', choiceText: 'Medium', choiceOrder: 1 },
      { id: '3', fieldId: '1', choiceText: 'Low', choiceOrder: 2 },
    ],
  },
  {
    id: '2',
    fieldLabel: 'Referral Source',
    fieldType: 'text' as const,
    fieldOrder: 1,
    isActive: true,
    isRequired: true,
    clientId: '1',
  },
];

describe('Client-Specific Custom Fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ServiceLogForm with Client Fields', () => {
    it('should show Additional Information section when client is selected', async () => {
      // Mock API response for client fields
      vi.mocked(customFieldApi.getFormConfig).mockResolvedValue({
        success: true,
        data: mockClientFields,
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ServiceLogForm
            clients={mockClients}
            activities={mockActivities}
            outcomes={mockOutcomes}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Select a client
      const clientSelect = screen.getByLabelText(/client\/site/i);
      fireEvent.change(clientSelect, { target: { value: '1' } });

      // Wait for fields to load and check Additional Information section appears
      await waitFor(() => {
        expect(screen.getByText('Additional Information')).toBeInTheDocument();
      });
    });

    it('should load client-specific fields when client changes', async () => {
      let resolveGetFormConfig: (value: any) => void;
      const getFormConfigPromise = new Promise((resolve) => {
        resolveGetFormConfig = resolve;
      });

      vi.mocked(customFieldApi.getFormConfig).mockReturnValue(getFormConfigPromise as any);

      render(
        <TestWrapper>
          <ServiceLogForm
            clients={mockClients}
            activities={mockActivities}
            outcomes={mockOutcomes}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Select a client
      const clientSelect = screen.getByLabelText(/client\/site/i);
      fireEvent.change(clientSelect, { target: { value: '1' } });

      // Verify API was called with correct client ID
      expect(customFieldApi.getFormConfig).toHaveBeenCalledWith('1');

      // Resolve the promise with mock data
      resolveGetFormConfig({
        success: true,
        data: mockClientFields,
        timestamp: new Date().toISOString(),
      });

      // Wait for fields to appear
      await waitFor(() => {
        expect(screen.getByLabelText(/priority level/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/referral source/i)).toBeInTheDocument();
      });
    });

    it('should show "Add New Capture" button for admin users when client is selected', async () => {
      vi.mocked(customFieldApi.getFormConfig).mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ServiceLogForm
            clients={mockClients}
            activities={mockActivities}
            outcomes={mockOutcomes}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Select a client
      const clientSelect = screen.getByLabelText(/client\/site/i);
      fireEvent.change(clientSelect, { target: { value: '1' } });

      // Wait for the button to appear
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add new capture/i })).toBeInTheDocument();
      });
    });

    it('should not show "Add New Capture" button for non-admin users', async () => {
      // Mock non-admin user
      vi.mocked(vi.mocked(require('../hooks/useAuth')).useAuth).mockReturnValue({
        user: { id: '1', email: 'user@test.com', role: 'candidate' },
        isAuthenticated: true,
      });

      vi.mocked(customFieldApi.getFormConfig).mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ServiceLogForm
            clients={mockClients}
            activities={mockActivities}
            outcomes={mockOutcomes}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Select a client
      const clientSelect = screen.getByLabelText(/client\/site/i);
      fireEvent.change(clientSelect, { target: { value: '1' } });

      // Wait and verify button is not present
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /add new capture/i })).not.toBeInTheDocument();
      });
    });

    it('should display custom fields with correct types', async () => {
      vi.mocked(customFieldApi.getFormConfig).mockResolvedValue({
        success: true,
        data: mockClientFields,
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ServiceLogForm
            clients={mockClients}
            activities={mockActivities}
            outcomes={mockOutcomes}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Select a client
      const clientSelect = screen.getByLabelText(/client\/site/i);
      fireEvent.change(clientSelect, { target: { value: '1' } });

      await waitFor(() => {
        // Check dropdown field
        const priorityField = screen.getByLabelText(/priority level/i);
        expect(priorityField).toBeInTheDocument();
        expect(priorityField.tagName.toLowerCase()).toBe('select');

        // Check text field
        const referralField = screen.getByLabelText(/referral source/i);
        expect(referralField).toBeInTheDocument();
        expect(referralField.tagName.toLowerCase()).toBe('input');
        expect(referralField).toHaveAttribute('type', 'text');

        // Check required indicator
        expect(screen.getByText('Referral Source')).toBeInTheDocument();
        // The required asterisk should be present
        expect(screen.getByText('*')).toBeInTheDocument();
      });
    });
  });

  describe('ClientFieldManager Component', () => {
    it('should render empty state when no fields exist', async () => {
      vi.mocked(customFieldApi.getClientFields).mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ClientFieldManager
            clientId="1"
            clientName="General Hospital"
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('No custom fields')).toBeInTheDocument();
        expect(screen.getByText(/create custom fields that will appear when general hospital is selected/i)).toBeInTheDocument();
      });
    });

    it('should display existing fields with their properties', async () => {
      vi.mocked(customFieldApi.getClientFields).mockResolvedValue({
        success: true,
        data: mockClientFields,
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ClientFieldManager
            clientId="1"
            clientName="General Hospital"
          />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check field titles
        expect(screen.getByText('Priority Level')).toBeInTheDocument();
        expect(screen.getByText('Referral Source')).toBeInTheDocument();

        // Check field types
        expect(screen.getByText('dropdown')).toBeInTheDocument();
        expect(screen.getByText('text')).toBeInTheDocument();

        // Check required indicator
        expect(screen.getByText('Required')).toBeInTheDocument();

        // Check choices display for dropdown
        expect(screen.getByText(/choices:/i)).toBeInTheDocument();
        expect(screen.getByText(/high, medium, low/i)).toBeInTheDocument();
      });
    });

    it('should open create modal when "Add Field" button is clicked', async () => {
      vi.mocked(customFieldApi.getClientFields).mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ClientFieldManager
            clientId="1"
            clientName="General Hospital"
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /add field/i });
        fireEvent.click(addButton);
        
        // Modal should appear
        expect(screen.getByText('Add Custom Field')).toBeInTheDocument();
      });
    });

    it('should call delete API when field is deleted', async () => {
      vi.mocked(customFieldApi.getClientFields).mockResolvedValue({
        success: true,
        data: mockClientFields,
        timestamp: new Date().toISOString(),
      });

      vi.mocked(customFieldApi.deleteClientField).mockResolvedValue({
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ClientFieldManager
            clientId="1"
            clientName="General Hospital"
          />
        </TestWrapper>
      );

      await waitFor(() => {
        // Click delete button for first field
        const deleteButtons = screen.getAllByTitle('Delete field');
        fireEvent.click(deleteButtons[0]);

        // Confirm in delete modal
        expect(screen.getByText('Delete Custom Field')).toBeInTheDocument();
      });

      // Click confirm delete
      const confirmButton = screen.getByRole('button', { name: /delete field/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(customFieldApi.deleteClientField).toHaveBeenCalledWith('1', '1');
      });
    });
  });

  describe('ClientFieldModal Component', () => {
    it('should validate required fields', async () => {
      render(
        <TestWrapper>
          <ClientFieldManager
            clientId="1"
            clientName="General Hospital"
          />
        </TestWrapper>
      );

      // Mock empty fields response first
      vi.mocked(customFieldApi.getClientFields).mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /add field/i });
        fireEvent.click(addButton);
      });

      // Try to submit without filling required fields
      const createButton = screen.getByRole('button', { name: /create field/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Field label is required')).toBeInTheDocument();
        expect(screen.getByText('Please select a field type')).toBeInTheDocument();
      });
    });

    it('should create dropdown field with choices', async () => {
      vi.mocked(customFieldApi.getClientFields).mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });

      vi.mocked(customFieldApi.createClientField).mockResolvedValue({
        success: true,
        data: mockClientFields[0],
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ClientFieldManager
            clientId="1"
            clientName="General Hospital"
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /add field/i });
        fireEvent.click(addButton);
      });

      // Fill out the form
      fireEvent.change(screen.getByLabelText(/field label/i), {
        target: { value: 'Priority Level' }
      });

      fireEvent.change(screen.getByLabelText(/field type/i), {
        target: { value: 'dropdown' }
      });

      // Add choices
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add choice/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /add choice/i }));
      
      const choiceInput = screen.getByPlaceholderText('Choice 1');
      fireEvent.change(choiceInput, { target: { value: 'High' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /create field/i }));

      await waitFor(() => {
        expect(customFieldApi.createClientField).toHaveBeenCalledWith('1', {
          fieldLabel: 'Priority Level',
          fieldType: 'dropdown',
          isRequired: false,
          clientId: '1',
          fieldOrder: 0,
          isActive: true,
          choices: [
            { choiceText: 'High', choiceOrder: 0 }
          ]
        });
      });
    });
  });

  describe('Form Integration', () => {
    it('should include custom field values in form submission', async () => {
      const mockOnSubmit = vi.fn();

      vi.mocked(customFieldApi.getFormConfig).mockResolvedValue({
        success: true,
        data: mockClientFields,
        timestamp: new Date().toISOString(),
      });

      render(
        <TestWrapper>
          <ServiceLogForm
            clients={mockClients}
            activities={mockActivities}
            outcomes={mockOutcomes}
            onSubmit={mockOnSubmit}
          />
        </TestWrapper>
      );

      // Fill out the form
      fireEvent.change(screen.getByLabelText(/client\/site/i), {
        target: { value: '1' }
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/priority level/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/activity/i), {
        target: { value: '1' }
      });

      fireEvent.change(screen.getByLabelText(/service date/i), {
        target: { value: '2023-12-01' }
      });

      fireEvent.change(screen.getByLabelText(/number of patient entries/i), {
        target: { value: '1' }
      });

      // Wait for patient entries to be generated
      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // Fill patient entry
      fireEvent.change(screen.getByLabelText(/appointment type/i), {
        target: { value: 'new' }
      });

      fireEvent.change(screen.getByLabelText(/outcome/i), {
        target: { value: '1' }
      });

      // Fill custom fields
      fireEvent.change(screen.getByLabelText(/priority level/i), {
        target: { value: '1' }
      });

      fireEvent.change(screen.getByLabelText(/referral source/i), {
        target: { value: 'GP Referral' }
      });

      // Submit form
      fireEvent.click(screen.getByRole('button', { name: /save service log/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            customFields: {
              '1': '1', // Priority Level field selection
              '2': 'GP Referral', // Referral Source text
            }
          })
        );
      });
    });
  });
});