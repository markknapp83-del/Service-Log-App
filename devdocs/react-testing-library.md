# React Testing Library Documentation for Healthcare Service Log Portal

## Overview
React Testing Library is a testing utility focused on testing React components from the user's perspective, making it perfect for healthcare applications where user experience and accessibility are critical.

## Installation and Setup

### Installation
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### Setup Configuration
```typescript
// src/setupTests.ts
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure testing library
configure({
  // Show suggestions for better queries
  testIdAttribute: 'data-testid',
  
  // Throw errors for inaccessible elements
  getElementError: (message, container) => {
    const error = new Error(message);
    error.name = 'TestingLibraryElementError';
    return error;
  },
});

// Mock ResizeObserver for components that use it
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window.matchMedia for responsive testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
```

## Core Testing Patterns

### Basic Component Testing
```typescript
// __tests__/components/PatientCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientCard } from '@/components/PatientCard';

const mockPatient = {
  id: 'patient-123',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1985-01-15',
  phone: '555-123-4567',
  email: 'john@example.com',
  status: 'active' as const,
  lastVisit: '2023-11-15',
};

describe('PatientCard', () => {
  test('displays patient information correctly', () => {
    render(<PatientCard patient={mockPatient} />);

    // Test that all patient information is displayed
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('555-123-4567')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  test('calls onSelect when patient card is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSelect = jest.fn();

    render(<PatientCard patient={mockPatient} onSelect={mockOnSelect} />);

    const card = screen.getByRole('button', { name: /view patient details/i });
    await user.click(card);

    expect(mockOnSelect).toHaveBeenCalledWith('patient-123');
  });

  test('shows different status colors', () => {
    const { rerender } = render(
      <PatientCard patient={{ ...mockPatient, status: 'active' }} />
    );

    expect(screen.getByText('Active')).toHaveClass('bg-green-100', 'text-green-800');

    rerender(<PatientCard patient={{ ...mockPatient, status: 'inactive' }} />);
    expect(screen.getByText('Inactive')).toHaveClass('bg-gray-100', 'text-gray-800');

    rerender(<PatientCard patient={{ ...mockPatient, status: 'pending' }} />);
    expect(screen.getByText('Pending')).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  test('handles missing optional fields gracefully', () => {
    const patientWithoutEmail = {
      ...mockPatient,
      email: undefined,
      lastVisit: undefined,
    };

    render(<PatientCard patient={patientWithoutEmail} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/last visit/i)).not.toBeInTheDocument();
  });
});
```

### Form Testing
```typescript
// __tests__/components/PatientForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientForm } from '@/components/PatientForm';

describe('PatientForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    
    render(<PatientForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Fill out the form
    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/date of birth/i), '1985-01-15');
    await user.type(screen.getByLabelText(/phone/i), '5551234567');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');

    // Emergency contact section
    await user.type(screen.getByLabelText(/emergency contact name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/emergency contact phone/i), '5551234568');
    await user.selectOptions(screen.getByLabelText(/relationship/i), 'spouse');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /save patient/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1985-01-15',
        phone: '5551234567',
        email: 'john@example.com',
        emergencyContact: {
          name: 'Jane Doe',
          phone: '5551234568',
          relationship: 'spouse',
        },
      });
    });
  });

  test('shows validation errors for invalid data', async () => {
    const user = userEvent.setup();
    
    render(<PatientForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Try to submit empty form
    const submitButton = screen.getByRole('button', { name: /save patient/i });
    await user.click(submitButton);

    // Check for validation errors
    await waitFor(() => {
      expect(screen.getByText(/first name must be at least 2 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/last name must be at least 2 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/phone must be 10 digits/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('validates phone number format', async () => {
    const user = userEvent.setup();
    
    render(<PatientForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const phoneInput = screen.getByLabelText(/phone/i);
    await user.type(phoneInput, '123');
    await user.tab(); // Trigger blur to show validation

    await waitFor(() => {
      expect(screen.getByText(/phone must be 10 digits/i)).toBeInTheDocument();
    });
  });

  test('cancels form submission', async () => {
    const user = userEvent.setup();
    
    render(<PatientForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('shows loading state during submission', async () => {
    const user = userEvent.setup();
    const slowSubmit = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );
    
    render(<PatientForm onSubmit={slowSubmit} onCancel={mockOnCancel} />);

    // Fill required fields
    await user.type(screen.getByLabelText(/first name/i), 'John');
    await user.type(screen.getByLabelText(/last name/i), 'Doe');
    await user.type(screen.getByLabelText(/date of birth/i), '1985-01-15');
    await user.type(screen.getByLabelText(/phone/i), '5551234567');

    const submitButton = screen.getByRole('button', { name: /save patient/i });
    await user.click(submitButton);

    // Check loading state
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    // Wait for submission to complete
    await waitFor(() => {
      expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
    });
  });
});
```

### Service List Testing
```typescript
// __tests__/components/ServiceList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceList } from '@/components/ServiceList';

const mockServices = [
  {
    id: 'service-1',
    patientId: 'patient-123',
    serviceType: 'consultation',
    providerId: 'provider-1',
    providerName: 'Dr. Smith',
    scheduledDate: '2023-12-01T09:00:00Z',
    duration: 30,
    status: 'scheduled',
    priority: 'routine',
    notes: 'Annual checkup',
  },
  {
    id: 'service-2',
    patientId: 'patient-123',
    serviceType: 'procedure',
    providerId: 'provider-2',
    providerName: 'Dr. Johnson',
    scheduledDate: '2023-12-02T14:00:00Z',
    duration: 60,
    status: 'completed',
    priority: 'urgent',
    notes: 'Blood work',
  },
];

describe('ServiceList', () => {
  test('displays list of services', () => {
    render(<ServiceList services={mockServices} />);

    expect(screen.getByText('Annual checkup')).toBeInTheDocument();
    expect(screen.getByText('Blood work')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Dr. Johnson')).toBeInTheDocument();
  });

  test('filters services by status', async () => {
    const user = userEvent.setup();
    
    render(<ServiceList services={mockServices} />);

    // Initially shows all services
    expect(screen.getAllByRole('row')).toHaveLength(3); // Including header

    // Filter by completed status
    const statusFilter = screen.getByLabelText(/filter by status/i);
    await user.selectOptions(statusFilter, 'completed');

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(2); // Header + 1 completed
      expect(screen.getByText('Blood work')).toBeInTheDocument();
      expect(screen.queryByText('Annual checkup')).not.toBeInTheDocument();
    });
  });

  test('sorts services by date', async () => {
    const user = userEvent.setup();
    
    render(<ServiceList services={mockServices} />);

    const sortButton = screen.getByRole('button', { name: /sort by date/i });
    await user.click(sortButton);

    await waitFor(() => {
      const rows = screen.getAllByRole('row').slice(1); // Exclude header
      const firstRowDate = rows[0].querySelector('[data-testid="scheduled-date"]')?.textContent;
      const secondRowDate = rows[1].querySelector('[data-testid="scheduled-date"]')?.textContent;
      
      // Dates should be in ascending order after sort
      expect(new Date(firstRowDate || '')).toBeLessThan(new Date(secondRowDate || ''));
    });
  });

  test('shows empty state when no services', () => {
    render(<ServiceList services={[]} />);

    expect(screen.getByText(/no services found/i)).toBeInTheDocument();
    expect(screen.getByText(/schedule a new service/i)).toBeInTheDocument();
  });

  test('handles service actions', async () => {
    const user = userEvent.setup();
    const mockOnEdit = jest.fn();
    const mockOnCancel = jest.fn();
    
    render(
      <ServiceList 
        services={mockServices} 
        onEdit={mockOnEdit}
        onCancel={mockOnCancel}
      />
    );

    // Test edit action
    const editButtons = screen.getAllByRole('button', { name: /edit service/i });
    await user.click(editButtons[0]);

    expect(mockOnEdit).toHaveBeenCalledWith('service-1');

    // Test cancel action (only for scheduled services)
    const cancelButtons = screen.getAllByRole('button', { name: /cancel service/i });
    await user.click(cancelButtons[0]);

    expect(mockOnCancel).toHaveBeenCalledWith('service-1');
  });
});
```

### Accessibility Testing
```typescript
// __tests__/accessibility/PatientDashboard.test.tsx
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PatientDashboard } from '@/components/PatientDashboard';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

const mockPatient = {
  id: 'patient-123',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1985-01-15',
  phone: '555-123-4567',
  email: 'john@example.com',
  status: 'active' as const,
};

describe('PatientDashboard Accessibility', () => {
  test('should not have accessibility violations', async () => {
    const { container } = render(<PatientDashboard patient={mockPatient} />);
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has proper ARIA labels', () => {
    render(<PatientDashboard patient={mockPatient} />);

    expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Patient dashboard');
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Patient actions');
    expect(screen.getByRole('region', { name: /patient information/i })).toBeInTheDocument();
  });

  test('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    
    render(<PatientDashboard patient={mockPatient} />);

    // Test tab navigation
    const editButton = screen.getByRole('button', { name: /edit patient/i });
    const viewServicesButton = screen.getByRole('button', { name: /view services/i });
    
    await user.tab();
    expect(editButton).toHaveFocus();
    
    await user.tab();
    expect(viewServicesButton).toHaveFocus();
  });

  test('announces status changes to screen readers', async () => {
    const user = userEvent.setup();
    
    render(<PatientDashboard patient={mockPatient} />);

    const statusButton = screen.getByRole('button', { name: /change status/i });
    await user.click(statusButton);

    // Check for live region that announces status changes
    expect(screen.getByRole('status')).toHaveTextContent(/patient status updated/i);
  });

  test('has proper heading hierarchy', () => {
    render(<PatientDashboard patient={mockPatient} />);

    const headings = screen.getAllByRole('heading');
    
    // Check heading levels are in proper order
    expect(headings[0]).toHaveAttribute('aria-level', '1');
    expect(headings[1]).toHaveAttribute('aria-level', '2');
    expect(headings[2]).toHaveAttribute('aria-level', '2');
  });

  test('provides alternative text for images', () => {
    render(<PatientDashboard patient={mockPatient} />);

    const patientAvatar = screen.getByRole('img', { name: /john doe avatar/i });
    expect(patientAvatar).toHaveAttribute('alt', 'John Doe avatar');
  });
});
```

### Integration Testing
```typescript
// __tests__/integration/PatientManagement.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { PatientManagement } from '@/pages/PatientManagement';
import { ApiProvider } from '@/contexts/ApiContext';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <ApiProvider>
        {children}
      </ApiProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe('Patient Management Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('loads and displays patient list', async () => {
    const mockPatients = [
      {
        id: 'patient-1',
        firstName: 'John',
        lastName: 'Doe',
        phone: '555-123-4567',
        status: 'active',
      },
      {
        id: 'patient-2',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '555-987-6543',
        status: 'pending',
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          patients: mockPatients,
          total: 2,
          page: 1,
          totalPages: 1,
        },
      }),
    });

    render(<PatientManagement />, { wrapper: TestWrapper });

    // Check loading state
    expect(screen.getByText(/loading patients/i)).toBeInTheDocument();

    // Wait for patients to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/patients?page=1&limit=20');
  });

  test('creates new patient end-to-end', async () => {
    const user = userEvent.setup();

    // Mock initial patient list (empty)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { patients: [], total: 0, page: 1, totalPages: 0 },
      }),
    });

    // Mock patient creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'new-patient-id',
          firstName: 'New',
          lastName: 'Patient',
          phone: '555-000-0000',
          status: 'active',
        },
      }),
    });

    render(<PatientManagement />, { wrapper: TestWrapper });

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/no patients found/i)).toBeInTheDocument();
    });

    // Click "Add Patient" button
    const addButton = screen.getByRole('button', { name: /add patient/i });
    await user.click(addButton);

    // Fill out the form in the modal
    await user.type(screen.getByLabelText(/first name/i), 'New');
    await user.type(screen.getByLabelText(/last name/i), 'Patient');
    await user.type(screen.getByLabelText(/phone/i), '5550000000');
    await user.type(screen.getByLabelText(/date of birth/i), '1990-01-01');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /save patient/i });
    await user.click(submitButton);

    // Verify API call was made
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: expect.stringContaining('Bearer'),
        },
        body: JSON.stringify({
          firstName: 'New',
          lastName: 'Patient',
          phone: '5550000000',
          dateOfBirth: '1990-01-01',
        }),
      });
    });

    // Check success message
    expect(screen.getByText(/patient created successfully/i)).toBeInTheDocument();
  });

  test('handles API errors gracefully', async () => {
    const user = userEvent.setup();

    // Mock API error
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<PatientManagement />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(screen.getByText(/failed to load patients/i)).toBeInTheDocument();
    });

    // Test retry functionality
    const retryButton = screen.getByRole('button', { name: /retry/i });
    
    // Mock successful retry
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { patients: [], total: 0, page: 1, totalPages: 0 },
      }),
    });

    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.queryByText(/failed to load patients/i)).not.toBeInTheDocument();
    });
  });
});
```

### Custom Queries and Utilities
```typescript
// src/testUtils/customQueries.ts
import { queries, buildQueries, Matcher, MatcherOptions } from '@testing-library/react';

// Custom query for finding elements by data-testid with healthcare context
const queryAllByTestId = (
  container: HTMLElement,
  id: Matcher,
  options?: MatcherOptions
) => {
  return Array.from(container.querySelectorAll(`[data-testid="${id}"]`));
};

const getMultipleError = (container: HTMLElement, id: string) =>
  `Found multiple elements with the testId of: ${id}`;

const getMissingError = (container: HTMLElement, id: string) =>
  `Unable to find an element with the testId of: ${id}`;

const [
  queryByTestId,
  getAllByTestId,
  getByTestId,
  findAllByTestId,
  findByTestId,
] = buildQueries(queryAllByTestId, getMultipleError, getMissingError);

// Custom render function with providers
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  user?: {
    id: string;
    role: string;
    permissions: string[];
  };
}

function customRender(
  ui: ReactElement,
  {
    initialEntries = ['/'],
    user = { id: 'test-user', role: 'admin', permissions: ['*'] },
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <AuthProvider initialUser={user}>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Healthcare-specific test utilities
export const healthcareTestUtils = {
  // Create mock patient data
  createMockPatient: (overrides = {}) => ({
    id: 'patient-123',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1985-01-15',
    phone: '555-123-4567',
    email: 'john@example.com',
    status: 'active',
    emergencyContact: {
      name: 'Jane Doe',
      phone: '555-123-4568',
      relationship: 'spouse',
    },
    ...overrides,
  }),

  // Create mock service data
  createMockService: (overrides = {}) => ({
    id: 'service-456',
    patientId: 'patient-123',
    serviceType: 'consultation',
    providerId: 'provider-789',
    providerName: 'Dr. Smith',
    scheduledDate: '2023-12-01T09:00:00Z',
    duration: 30,
    status: 'scheduled',
    priority: 'routine',
    ...overrides,
  }),

  // Wait for loading to complete
  waitForLoadingToFinish: async () => {
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  },

  // Fill out patient form
  fillPatientForm: async (user: any, patientData: any) => {
    await user.type(screen.getByLabelText(/first name/i), patientData.firstName);
    await user.type(screen.getByLabelText(/last name/i), patientData.lastName);
    await user.type(screen.getByLabelText(/phone/i), patientData.phone);
    await user.type(screen.getByLabelText(/date of birth/i), patientData.dateOfBirth);
    
    if (patientData.email) {
      await user.type(screen.getByLabelText(/email/i), patientData.email);
    }
  },
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
export { healthcareTestUtils };
```

### Snapshot Testing
```typescript
// __tests__/snapshots/PatientCard.test.tsx
import { render } from '@testing-library/react';
import { PatientCard } from '@/components/PatientCard';

const mockPatient = {
  id: 'patient-123',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1985-01-15',
  phone: '555-123-4567',
  email: 'john@example.com',
  status: 'active' as const,
};

describe('PatientCard Snapshots', () => {
  test('renders correctly with all props', () => {
    const { container } = render(
      <PatientCard 
        patient={mockPatient}
        onSelect={jest.fn()}
        onEdit={jest.fn()}
      />
    );
    
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly without optional props', () => {
    const patientWithoutEmail = { ...mockPatient, email: undefined };
    const { container } = render(<PatientCard patient={patientWithoutEmail} />);
    
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders different status variants', () => {
    const statuses = ['active', 'inactive', 'pending'] as const;
    
    statuses.forEach(status => {
      const { container } = render(
        <PatientCard patient={{ ...mockPatient, status }} />
      );
      
      expect(container.firstChild).toMatchSnapshot(`status-${status}`);
    });
  });
});
```

## Best Practices

### 1. Query Priority
Use queries in this order of preference:
1. **Accessible to everyone**: `getByRole`, `getByLabelText`, `getByPlaceholderText`, `getByText`
2. **Semantic HTML**: `getByAltText`, `getByTitle`
3. **Test IDs**: `getByTestId` (only as last resort)

```typescript
// Good - accessible queries
const submitButton = screen.getByRole('button', { name: /save patient/i });
const nameInput = screen.getByLabelText(/patient name/i);

// Avoid - implementation details
const submitButton = screen.getByClassName('submit-btn');
const nameInput = screen.getBySelector('input[name="patientName"]');
```

### 2. User-Centric Testing
Test what users can see and do, not implementation details:

```typescript
// Good - tests user behavior
test('shows validation error when required field is empty', async () => {
  const user = userEvent.setup();
  render(<PatientForm onSubmit={jest.fn()} />);
  
  await user.click(screen.getByRole('button', { name: /save/i }));
  
  expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
});

// Avoid - tests internal state
test('sets error state when validation fails', () => {
  const form = render(<PatientForm onSubmit={jest.fn()} />);
  form.instance().validateForm();
  expect(form.state.errors.firstName).toBeTruthy();
});
```

### 3. Async Testing
Always use `waitFor` for asynchronous operations:

```typescript
// Good - waits for async operation
test('loads patient data', async () => {
  render(<PatientDashboard patientId="123" />);
  
  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});

// Avoid - may cause race conditions
test('loads patient data', () => {
  render(<PatientDashboard patientId="123" />);
  expect(screen.getByText('John Doe')).toBeInTheDocument(); // Might not be loaded yet
});
```

### 4. Healthcare-Specific Considerations

#### HIPAA Compliance Testing
```typescript
test('does not display sensitive data in error messages', async () => {
  const user = userEvent.setup();
  const mockSubmit = jest.fn().mockRejectedValue(new Error('Database error'));
  
  render(<PatientForm onSubmit={mockSubmit} />);
  
  // Fill and submit form
  await fillForm();
  await user.click(screen.getByRole('button', { name: /save/i }));
  
  await waitFor(() => {
    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).not.toHaveTextContent(/patient.*123/i); // No patient ID in error
    expect(errorMessage).not.toHaveTextContent(/john.*doe/i); // No patient name in error
  });
});
```

#### Accessibility for Medical Devices
```typescript
test('supports high contrast mode', () => {
  // Mock high contrast media query
  Object.defineProperty(window, 'matchMedia', {
    value: jest.fn(() => ({
      matches: true, // Simulate high contrast mode
      media: '(prefers-contrast: high)',
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
  });
  
  render(<PatientCard patient={mockPatient} />);
  
  const card = screen.getByRole('article');
  expect(card).toHaveStyle({ 'border-width': '2px' }); // Thicker borders in high contrast
});
```

#### Medical Data Validation
```typescript
test('validates medical record number format', async () => {
  const user = userEvent.setup();
  render(<PatientForm onSubmit={jest.fn()} />);
  
  const mrnInput = screen.getByLabelText(/medical record number/i);
  await user.type(mrnInput, 'invalid-mrn');
  await user.tab(); // Trigger validation
  
  await waitFor(() => {
    expect(screen.getByText(/medical record number must start with MR/i)).toBeInTheDocument();
  });
});
```

### 5. Performance Testing
```typescript
test('renders large patient list efficiently', () => {
  const manyPatients = Array.from({ length: 1000 }, (_, i) => 
    healthcareTestUtils.createMockPatient({ id: `patient-${i}` })
  );
  
  const startTime = performance.now();
  render(<PatientList patients={manyPatients} />);
  const endTime = performance.now();
  
  // Should render within reasonable time
  expect(endTime - startTime).toBeLessThan(100); // milliseconds
  
  // Should use virtualization for large lists
  const visibleRows = screen.getAllByRole('row');
  expect(visibleRows.length).toBeLessThan(50); // Not all 1000 rendered
});
```

## Testing Utilities and Helpers

### Mock Service Worker (MSW) Integration
```typescript
// src/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/patients', (req, res, ctx) => {
    const page = req.url.searchParams.get('page') || '1';
    const limit = req.url.searchParams.get('limit') || '20';
    
    return res(
      ctx.json({
        success: true,
        data: {
          patients: [
            healthcareTestUtils.createMockPatient(),
          ],
          total: 1,
          page: parseInt(page),
          totalPages: 1,
        },
      })
    );
  }),

  rest.post('/api/patients', (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: {
          id: 'new-patient-id',
          ...req.body,
          createdAt: new Date().toISOString(),
        },
      })
    );
  }),

  rest.get('/api/patients/:id', (req, res, ctx) => {
    const { id } = req.params;
    
    if (id === 'non-existent') {
      return res(
        ctx.status(404),
        ctx.json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Patient not found' },
        })
      );
    }
    
    return res(
      ctx.json({
        success: true,
        data: healthcareTestUtils.createMockPatient({ id }),
      })
    );
  }),
];

// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// src/setupTests.ts
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Resources
- [React Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Jest Accessibility Testing](https://github.com/nickcolley/jest-axe)
- [MSW for API Mocking](https://mswjs.io/)
- [Healthcare Software Testing Standards](https://www.fda.gov/medical-devices/software-medical-device-samd)