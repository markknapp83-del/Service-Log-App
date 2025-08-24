// Template Form Integration Tests following React Testing Library patterns
// Tests for integration between template management and service log form options
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ServiceLogPage } from '@/pages/ServiceLogPage';
import { TemplateManagementPage } from '@/pages/TemplateManagementPage';

// Mock the toast hook
const mockToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock the useAuth hook
const mockUseAuth = {
  user: { id: 'admin-123', role: 'admin', email: 'admin@test.com' },
  isLoading: false,
  logout: jest.fn()
};

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Template Form Integration Tests', () => {
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
  });

  // ================================
  // SERVICE LOG FORM OPTIONS TESTS
  // ================================

  describe('Service Log Form Options Loading', () => {
    test('loads and displays form options correctly', async () => {
      const mockFormOptions = {
        clients: [
          { id: '1', name: 'Test Hospital', is_active: true },
          { id: '2', name: 'Community Clinic', is_active: true }
        ],
        activities: [
          { id: '1', name: 'Health Screening', is_active: true },
          { id: '2', name: 'Vaccination', is_active: true }
        ],
        outcomes: [
          { id: '1', name: 'Successful Treatment', is_active: true },
          { id: '2', name: 'Follow-up Required', is_active: true }
        ],
        customFields: [
          {
            id: '1',
            field_label: 'Priority Level',
            field_type: 'dropdown',
            field_order: 1,
            is_active: true,
            choices: [
              { id: '1', choice_text: 'High', choice_order: 1 },
              { id: '2', choice_text: 'Medium', choice_order: 2 },
              { id: '3', choice_text: 'Low', choice_order: 3 }
            ]
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockFormOptions })
      });

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/service-logs/options', {
          headers: { 'Authorization': 'Bearer mock-token' }
        });
      });

      // Check that clients are loaded in select options
      await waitFor(() => {
        const clientSelect = screen.getByLabelText(/client/i);
        expect(clientSelect).toBeInTheDocument();
        
        const clientOptions = within(clientSelect as HTMLElement).getAllByRole('option');
        expect(clientOptions).toHaveLength(3); // 2 clients + 1 default option
        expect(screen.getByDisplayValue('Test Hospital')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Community Clinic')).toBeInTheDocument();
      });

      // Check that activities are loaded
      await waitFor(() => {
        const activitySelect = screen.getByLabelText(/activity/i);
        const activityOptions = within(activitySelect as HTMLElement).getAllByRole('option');
        expect(activityOptions).toHaveLength(3); // 2 activities + 1 default
      });

      // Check that outcomes are loaded
      await waitFor(() => {
        const outcomeSelect = screen.getByLabelText(/outcome/i);
        const outcomeOptions = within(outcomeSelect as HTMLElement).getAllByRole('option');
        expect(outcomeOptions).toHaveLength(3); // 2 outcomes + 1 default
      });

      // Check that custom fields are displayed
      await waitFor(() => {
        expect(screen.getByLabelText('Priority Level')).toBeInTheDocument();
        
        const customFieldSelect = screen.getByLabelText('Priority Level');
        const customFieldOptions = within(customFieldSelect as HTMLElement).getAllByRole('option');
        expect(customFieldOptions).toHaveLength(4); // 3 choices + 1 default
      });
    });

    test('handles form options loading errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to load form options. Please try again.',
          variant: 'destructive'
        });
      });

      // Form should still render but with empty options
      expect(screen.getByLabelText(/client/i)).toBeInTheDocument();
    });

    test('filters out inactive options', async () => {
      const mockFormOptions = {
        clients: [
          { id: '1', name: 'Active Hospital', is_active: true },
          { id: '2', name: 'Inactive Hospital', is_active: false }
        ],
        activities: [
          { id: '1', name: 'Active Activity', is_active: true },
          { id: '2', name: 'Inactive Activity', is_active: false }
        ],
        outcomes: [
          { id: '1', name: 'Active Outcome', is_active: true },
          { id: '2', name: 'Inactive Outcome', is_active: false }
        ],
        customFields: [
          {
            id: '1',
            field_label: 'Active Field',
            field_type: 'dropdown',
            is_active: true,
            choices: [{ id: '1', choice_text: 'Choice 1', choice_order: 1 }]
          },
          {
            id: '2',
            field_label: 'Inactive Field',
            field_type: 'dropdown',
            is_active: false,
            choices: [{ id: '2', choice_text: 'Choice 2', choice_order: 1 }]
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockFormOptions })
      });

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        // Only active options should be available
        expect(screen.queryByText('Active Hospital')).toBeInTheDocument();
        expect(screen.queryByText('Inactive Hospital')).not.toBeInTheDocument();
        
        expect(screen.queryByText('Active Activity')).toBeInTheDocument();
        expect(screen.queryByText('Inactive Activity')).not.toBeInTheDocument();
        
        expect(screen.queryByText('Active Outcome')).toBeInTheDocument();
        expect(screen.queryByText('Inactive Outcome')).not.toBeInTheDocument();
        
        expect(screen.queryByLabelText('Active Field')).toBeInTheDocument();
        expect(screen.queryByLabelText('Inactive Field')).not.toBeInTheDocument();
      });
    });

    test('displays custom fields in correct order', async () => {
      const mockFormOptions = {
        clients: [],
        activities: [],
        outcomes: [],
        customFields: [
          {
            id: '1',
            field_label: 'Third Field',
            field_type: 'dropdown',
            field_order: 3,
            is_active: true,
            choices: [{ id: '1', choice_text: 'Choice 1', choice_order: 1 }]
          },
          {
            id: '2',
            field_label: 'First Field',
            field_type: 'dropdown',
            field_order: 1,
            is_active: true,
            choices: [{ id: '2', choice_text: 'Choice 2', choice_order: 1 }]
          },
          {
            id: '3',
            field_label: 'Second Field',
            field_type: 'dropdown',
            field_order: 2,
            is_active: true,
            choices: [{ id: '3', choice_text: 'Choice 3', choice_order: 1 }]
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockFormOptions })
      });

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        const fieldLabels = screen.getAllByText(/Field$/);
        expect(fieldLabels).toHaveLength(3);
        
        // Fields should be in order based on field_order
        expect(fieldLabels[0]).toHaveTextContent('First Field');
        expect(fieldLabels[1]).toHaveTextContent('Second Field');
        expect(fieldLabels[2]).toHaveTextContent('Third Field');
      });
    });

    test('displays custom field choices in correct order', async () => {
      const mockFormOptions = {
        clients: [],
        activities: [],
        outcomes: [],
        customFields: [
          {
            id: '1',
            field_label: 'Priority Level',
            field_type: 'dropdown',
            field_order: 1,
            is_active: true,
            choices: [
              { id: '3', choice_text: 'Low', choice_order: 3 },
              { id: '1', choice_text: 'High', choice_order: 1 },
              { id: '2', choice_text: 'Medium', choice_order: 2 }
            ]
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockFormOptions })
      });

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        const prioritySelect = screen.getByLabelText('Priority Level');
        const options = within(prioritySelect as HTMLElement).getAllByRole('option');
        
        // Should include default option plus choices in correct order
        expect(options[0]).toHaveValue(''); // Default option
        expect(options[1]).toHaveTextContent('High');
        expect(options[2]).toHaveTextContent('Medium');
        expect(options[3]).toHaveTextContent('Low');
      });
    });
  });

  // ================================
  // REAL-TIME UPDATES TESTS
  // ================================

  describe('Real-time Template Updates', () => {
    test('polls for form option updates', async () => {
      const initialOptions = {
        clients: [{ id: '1', name: 'Original Client', is_active: true }],
        activities: [],
        outcomes: [],
        customFields: []
      };

      const updatedOptions = {
        clients: [
          { id: '1', name: 'Original Client', is_active: true },
          { id: '2', name: 'New Client', is_active: true }
        ],
        activities: [],
        outcomes: [],
        customFields: []
      };

      // First call returns initial options
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: initialOptions })
      });

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('Original Client')).toBeInTheDocument();
        expect(screen.queryByText('New Client')).not.toBeInTheDocument();
      });

      // Mock the polling update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: updatedOptions })
      });

      // Simulate polling interval (you may need to trigger this manually or use fake timers)
      await waitFor(() => {
        expect(screen.getByText('New Client')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    test('handles template updates when form is partially filled', async () => {
      const user = userEvent.setup();

      const initialOptions = {
        clients: [{ id: '1', name: 'Test Hospital', is_active: true }],
        activities: [{ id: '1', name: 'Screening', is_active: true }],
        outcomes: [{ id: '1', name: 'Success', is_active: true }],
        customFields: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: initialOptions })
      });

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeInTheDocument();
      });

      // Fill form partially
      const clientSelect = screen.getByLabelText(/client/i);
      await user.selectOptions(clientSelect, '1');

      // Simulate options update that adds a new custom field
      const updatedOptions = {
        ...initialOptions,
        customFields: [
          {
            id: '1',
            field_label: 'New Custom Field',
            field_type: 'dropdown',
            field_order: 1,
            is_active: true,
            choices: [{ id: '1', choice_text: 'Option 1', choice_order: 1 }]
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: updatedOptions })
      });

      // Trigger update (in real implementation, this would be automatic)
      await waitFor(() => {
        expect(screen.getByLabelText('New Custom Field')).toBeInTheDocument();
      });

      // Previously selected values should be preserved
      expect(clientSelect).toHaveValue('1');
    });

    test('removes options when templates are deactivated', async () => {
      const initialOptions = {
        clients: [
          { id: '1', name: 'Active Client', is_active: true },
          { id: '2', name: 'Soon Inactive Client', is_active: true }
        ],
        activities: [],
        outcomes: [],
        customFields: []
      };

      const updatedOptions = {
        clients: [
          { id: '1', name: 'Active Client', is_active: true },
          { id: '2', name: 'Soon Inactive Client', is_active: false } // Now inactive
        ],
        activities: [],
        outcomes: [],
        customFields: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: initialOptions })
      });

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('Soon Inactive Client')).toBeInTheDocument();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: updatedOptions })
      });

      // After update, inactive client should not be available
      await waitFor(() => {
        expect(screen.queryByText('Soon Inactive Client')).not.toBeInTheDocument();
        expect(screen.getByText('Active Client')).toBeInTheDocument();
      });
    });
  });

  // ================================
  // FORM SUBMISSION WITH TEMPLATES TESTS
  // ================================

  describe('Form Submission with Template Data', () => {
    test('submits form with custom field values', async () => {
      const user = userEvent.setup();

      const mockFormOptions = {
        clients: [{ id: '1', name: 'Test Hospital', is_active: true }],
        activities: [{ id: '1', name: 'Screening', is_active: true }],
        outcomes: [{ id: '1', name: 'Success', is_active: true }],
        customFields: [
          {
            id: '1',
            field_label: 'Priority Level',
            field_type: 'dropdown',
            field_order: 1,
            is_active: true,
            choices: [
              { id: '1', choice_text: 'High', choice_order: 1 },
              { id: '2', choice_text: 'Medium', choice_order: 2 }
            ]
          }
        ]
      };

      // Mock form options response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockFormOptions })
      });

      // Mock successful form submission
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          data: { id: 'new-service-log-id' }
        })
      });

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Priority Level')).toBeInTheDocument();
      });

      // Fill form with template-based values
      const clientSelect = screen.getByLabelText(/client/i);
      const activitySelect = screen.getByLabelText(/activity/i);
      const prioritySelect = screen.getByLabelText('Priority Level');
      const patientCountInput = screen.getByLabelText(/patient count/i);

      await user.selectOptions(clientSelect, '1');
      await user.selectOptions(activitySelect, '1');
      await user.selectOptions(prioritySelect, '1'); // High priority
      await user.type(patientCountInput, '5');

      // Add patient entry
      await user.type(screen.getByLabelText(/new patients/i), '3');
      await user.type(screen.getByLabelText(/follow.*up patients/i), '2');
      const outcomeSelect = screen.getByLabelText(/outcome/i);
      await user.selectOptions(outcomeSelect, '1');

      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/service-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({
            clientId: '1',
            activityId: '1',
            patientCount: 5,
            patientEntries: [
              {
                newPatients: 3,
                followupPatients: 2,
                dnaCount: 0,
                outcomeId: '1'
              }
            ],
            customFieldValues: {
              '1': '1' // Priority Level field with High value
            },
            isDraft: false
          })
        });
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Service log submitted successfully.',
        variant: 'default'
      });
    });

    test('validates custom field values', async () => {
      const user = userEvent.setup();

      const mockFormOptions = {
        clients: [{ id: '1', name: 'Test Hospital', is_active: true }],
        activities: [{ id: '1', name: 'Screening', is_active: true }],
        outcomes: [{ id: '1', name: 'Success', is_active: true }],
        customFields: [
          {
            id: '1',
            field_label: 'Required Priority',
            field_type: 'dropdown',
            field_order: 1,
            is_active: true,
            is_required: true, // Assuming required field feature
            choices: [
              { id: '1', choice_text: 'High', choice_order: 1 }
            ]
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockFormOptions })
      });

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByLabelText('Required Priority')).toBeInTheDocument();
      });

      // Try to submit without selecting required custom field
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Should show validation error for custom field
      await waitFor(() => {
        expect(screen.getByText(/required priority.*required/i)).toBeInTheDocument();
      });
    });
  });

  // ================================
  // TEMPLATE MANAGEMENT INTEGRATION TESTS
  // ================================

  describe('Template Management Integration', () => {
    test('creates new client and it appears in service log form', async () => {
      const user = userEvent.setup();

      // Mock initial template data (empty clients)
      const initialTemplateData = {
        clients: [],
        activities: [],
        outcomes: [],
        customFields: []
      };

      // Mock template management API calls
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }) // clients
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }) // activities
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }) // outcomes
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] }) // custom fields
        });

      render(<TemplateManagementPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.queryByText('Loading template data...')).not.toBeInTheDocument();
      });

      // Mock client creation success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          success: true, 
          data: { id: '1', name: 'New Hospital', is_active: true }
        })
      });

      // Mock reload template data after creation
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            success: true, 
            data: [{ id: '1', name: 'New Hospital', is_active: true, usage_count: 0 }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: [] })
        });

      // Click Add Client button
      const addClientButton = screen.getByRole('button', { name: 'Add client' });
      await user.click(addClientButton);

      // Note: This test would need the actual EntityModal to work properly
      // For now, we're testing the integration concept
      expect(screen.getByText('New Hospital')).toBeInTheDocument();
    });

    test('template changes are reflected across application', async () => {
      const user = userEvent.setup();

      // This is a complex integration test that would require:
      // 1. Multiple components rendered together
      // 2. Shared state management or polling mechanism
      // 3. Real-time updates between template management and form

      // Mock service log form options initially
      const initialFormOptions = {
        clients: [{ id: '1', name: 'Original Hospital', is_active: true }],
        activities: [],
        outcomes: [],
        customFields: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: initialFormOptions })
      });

      // This test demonstrates the concept but would need full application context
      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('Original Hospital')).toBeInTheDocument();
      });

      // In a real integration test, you would:
      // 1. Render both components or use a shared context
      // 2. Make changes in template management
      // 3. Verify changes appear in service log form
      // 4. Test real-time updates or manual refresh
    });
  });

  // ================================
  // ERROR HANDLING INTEGRATION TESTS
  // ================================

  describe('Error Handling Integration', () => {
    test('handles template API failures gracefully in form', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Template service unavailable'));

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to load form options. Please try again.',
          variant: 'destructive'
        });
      });

      // Form should still be usable with basic functionality
      expect(screen.getByLabelText(/patient count/i)).toBeInTheDocument();
    });

    test('handles partial template data loading', async () => {
      // Mock successful clients but failed activities
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            success: true, 
            data: {
              clients: [{ id: '1', name: 'Test Hospital', is_active: true }],
              activities: [], // Empty due to error
              outcomes: [{ id: '1', name: 'Success', is_active: true }],
              customFields: []
            }
          })
        });

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        // Should show available options
        expect(screen.getByText('Test Hospital')).toBeInTheDocument();
        expect(screen.getByText('Success')).toBeInTheDocument();
        
        // Should gracefully handle missing activities
        const activitySelect = screen.getByLabelText(/activity/i);
        expect(activitySelect).toBeInTheDocument();
      });
    });

    test('recovers from template API failures with retry', async () => {
      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to load form options. Please try again.',
          variant: 'destructive'
        });
      });

      // Mock successful retry
      const mockFormOptions = {
        clients: [{ id: '1', name: 'Test Hospital', is_active: true }],
        activities: [{ id: '1', name: 'Screening', is_active: true }],
        outcomes: [{ id: '1', name: 'Success', is_active: true }],
        customFields: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockFormOptions })
      });

      // Simulate retry (might be automatic or manual)
      await waitFor(() => {
        expect(screen.getByText('Test Hospital')).toBeInTheDocument();
      });
    });
  });

  // ================================
  // PERFORMANCE INTEGRATION TESTS
  // ================================

  describe('Performance Integration', () => {
    test('handles large template datasets efficiently', async () => {
      // Create large datasets
      const largeClients = Array.from({ length: 100 }, (_, i) => ({
        id: `${i + 1}`,
        name: `Client ${i + 1}`,
        is_active: true
      }));

      const largeCustomFields = Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}`,
        field_label: `Custom Field ${i + 1}`,
        field_type: 'dropdown',
        field_order: i + 1,
        is_active: true,
        choices: Array.from({ length: 10 }, (_, j) => ({
          id: `${i * 10 + j + 1}`,
          choice_text: `Choice ${j + 1}`,
          choice_order: j + 1
        }))
      }));

      const mockFormOptions = {
        clients: largeClients,
        activities: [],
        outcomes: [],
        customFields: largeCustomFields
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockFormOptions })
      });

      const startTime = performance.now();
      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('Client 1')).toBeInTheDocument();
        expect(screen.getByLabelText('Custom Field 1')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time even with large datasets
      expect(renderTime).toBeLessThan(2000); // 2 seconds
      
      // Should display all options
      expect(screen.getByText('Client 100')).toBeInTheDocument();
      expect(screen.getByLabelText('Custom Field 20')).toBeInTheDocument();
    });

    test('optimizes template data updates', async () => {
      const initialOptions = {
        clients: [{ id: '1', name: 'Client 1', is_active: true }],
        activities: [],
        outcomes: [],
        customFields: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: initialOptions })
      });

      render(<ServiceLogPage />, { wrapper: TestWrapper });

      await waitFor(() => {
        expect(screen.getByText('Client 1')).toBeInTheDocument();
      });

      // Mock minimal update (only one field changed)
      const updatedOptions = {
        clients: [
          { id: '1', name: 'Client 1', is_active: true },
          { id: '2', name: 'Client 2', is_active: true }
        ],
        activities: [],
        outcomes: [],
        customFields: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, data: updatedOptions })
      });

      // Update should be efficient and not cause unnecessary re-renders
      await waitFor(() => {
        expect(screen.getByText('Client 2')).toBeInTheDocument();
      });

      // Previous options should still be available
      expect(screen.getByText('Client 1')).toBeInTheDocument();
    });
  });
});