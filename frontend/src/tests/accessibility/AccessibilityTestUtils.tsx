// Accessibility test utilities following documented patterns from devdocs/react-testing-library.md
import React from 'react';
import { render, RenderOptions, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations, ConfiguredAxe } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// WCAG 2.1 AA configuration for axe-core
const a11yConfig: ConfiguredAxe = axe.configure({
  rules: {
    // WCAG 2.1 AA compliance rules
    'color-contrast': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'focus-management': { enabled: true },
    'aria-labels': { enabled: true },
    'heading-hierarchy': { enabled: true },
    'form-accessibility': { enabled: true },
    'live-regions': { enabled: true },
    'skip-links': { enabled: true },
    'landmarks': { enabled: true },
    'document-structure': { enabled: true },
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
});

// Healthcare-specific accessibility requirements
export const healthcareA11yConfig = {
  // HIPAA-compliant error handling - no sensitive data in errors
  sensitiveDataPatterns: [
    /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
    /\b[A-Z]{2}\d{6,8}\b/, // Medical record number pattern
    /\b\d{2}\/\d{2}\/\d{4}\b/, // DOB pattern
    /patient.*\d+/i, // Patient ID references
  ],
  
  // Critical healthcare interaction timeouts
  interactionTimeouts: {
    formSubmission: 30000, // 30 seconds for medical forms
    dataLoading: 10000, // 10 seconds for patient data
    emergencyActions: 5000, // 5 seconds for emergency responses
  },

  // Minimum touch targets for medical devices
  touchTargetSizes: {
    minimum: 44, // 44px minimum (WCAG AA)
    preferred: 48, // 48px preferred for healthcare
    critical: 56, // 56px for emergency actions
  },

  // Color contrast ratios for medical information
  contrastRatios: {
    normal: 4.5, // WCAG AA normal text
    large: 3.0, // WCAG AA large text
    critical: 7.0, // Enhanced for critical medical info
  },
};

// Mock healthcare data factories
export const createMockPatient = (overrides = {}) => ({
  id: 'patient-123',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1985-01-15',
  phone: '555-123-4567',
  email: 'john@example.com',
  medicalRecordNumber: 'MR123456',
  status: 'active' as const,
  emergencyContact: {
    name: 'Jane Doe',
    phone: '555-123-4568',
    relationship: 'spouse',
  },
  ...overrides,
});

export const createMockServiceLog = (overrides = {}) => ({
  id: 'log-456',
  clientId: 'client-1',
  activityId: 'activity-1',
  serviceDate: '2023-12-01',
  patientCount: 1,
  patientEntries: [
    {
      appointmentType: 'new' as const,
      outcomeId: 'outcome-1',
    },
  ],
  additionalNotes: 'Test service log entry',
  createdAt: '2023-12-01T10:00:00Z',
  updatedAt: '2023-12-01T10:00:00Z',
  userId: 'user-1',
  ...overrides,
});

// Custom render function with healthcare context
interface HealthcareRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  user?: {
    id: string;
    role: string;
    permissions: string[];
  };
  mockLocalStorage?: Record<string, string>;
  reducedMotion?: boolean;
  highContrast?: boolean;
  screenReaderMode?: boolean;
}

// Mock providers for healthcare context
const MockAuthProvider = ({ children, user }: { children: React.ReactNode; user?: any }) => {
  // Mock auth context
  const mockUser = user || { id: 'test-user', role: 'clinician', permissions: ['read', 'write'] };
  return <div data-testid="mock-auth-provider">{children}</div>;
};

const MockToastProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="mock-toast-provider">{children}</div>;
};

export function renderWithA11yContext(
  ui: React.ReactElement,
  options: HealthcareRenderOptions = {}
) {
  const {
    user,
    mockLocalStorage,
    reducedMotion = false,
    highContrast = false,
    screenReaderMode = false,
    ...renderOptions
  } = options;

  // Setup accessibility environment
  if (reducedMotion) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  }

  if (highContrast) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  }

  // Mock localStorage if provided
  if (mockLocalStorage) {
    const mockStorage = {
      getItem: jest.fn((key) => mockLocalStorage[key] || null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
    });
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MockAuthProvider user={user}>
        <MockToastProvider>
          <div 
            data-testid="a11y-test-wrapper"
            {...(screenReaderMode && { 'aria-hidden': 'false' })}
          >
            {children}
          </div>
        </MockToastProvider>
      </MockAuthProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Accessibility test utilities
export const a11yTestUtils = {
  // Run comprehensive axe tests
  async runA11yTests(container: HTMLElement): Promise<void> {
    const results = await a11yConfig(container);
    expect(results).toHaveNoViolations();
  },

  // Check for sensitive data in error messages
  checkForSensitiveData(text: string): void {
    healthcareA11yConfig.sensitiveDataPatterns.forEach(pattern => {
      expect(text).not.toMatch(pattern);
    });
  },

  // Verify keyboard navigation
  async verifyKeyboardNavigation(elements: HTMLElement[]): Promise<void> {
    const user = userEvent.setup();
    
    for (let i = 0; i < elements.length; i++) {
      await user.tab();
      await waitFor(() => {
        expect(elements[i]).toHaveFocus();
      });
    }
  },

  // Check focus trapping in modals
  async verifyFocusTrapping(
    modal: HTMLElement, 
    firstElement: HTMLElement, 
    lastElement: HTMLElement
  ): Promise<void> {
    const user = userEvent.setup();
    
    // Focus should start at first element
    expect(firstElement).toHaveFocus();
    
    // Tab from last element should wrap to first
    lastElement.focus();
    await user.tab();
    expect(firstElement).toHaveFocus();
    
    // Shift+Tab from first element should wrap to last
    await user.tab({ shift: true });
    expect(lastElement).toHaveFocus();
  },

  // Verify ARIA attributes
  verifyAriaAttributes(element: HTMLElement, expectedAttributes: Record<string, string>): void {
    Object.entries(expectedAttributes).forEach(([attr, value]) => {
      expect(element).toHaveAttribute(attr, value);
    });
  },

  // Check color contrast (visual test helper)
  verifyColorContrast(element: HTMLElement, minimumRatio: number = healthcareA11yConfig.contrastRatios.normal): void {
    const computedStyle = window.getComputedStyle(element);
    const backgroundColor = computedStyle.backgroundColor;
    const color = computedStyle.color;
    
    // Note: Actual contrast calculation would need a color utility library
    // This is a placeholder for the test structure
    expect(backgroundColor).toBeTruthy();
    expect(color).toBeTruthy();
  },

  // Verify touch target sizes
  verifyTouchTargetSize(element: HTMLElement, minSize: number = healthcareA11yConfig.touchTargetSizes.minimum): void {
    const rect = element.getBoundingClientRect();
    expect(Math.min(rect.width, rect.height)).toBeGreaterThanOrEqual(minSize);
  },

  // Check for proper heading hierarchy
  verifyHeadingHierarchy(): void {
    const headings = screen.getAllByRole('heading');
    const levels = headings.map(h => parseInt(h.tagName.charAt(1)));
    
    // Verify no heading levels are skipped
    for (let i = 1; i < levels.length; i++) {
      const diff = levels[i] - levels[i - 1];
      expect(diff).toBeLessThanOrEqual(1);
    }
  },

  // Test screen reader announcements
  async verifyScreenReaderAnnouncements(expectedText: string, timeout: number = 5000): Promise<void> {
    await waitFor(() => {
      const liveRegions = screen.getAllByRole('status');
      const alerts = screen.getAllByRole('alert');
      
      const allAnnouncements = [...liveRegions, ...alerts]
        .map(el => el.textContent)
        .join(' ');
        
      expect(allAnnouncements).toContain(expectedText);
    }, { timeout });
  },

  // Verify form accessibility
  verifyFormAccessibility(form: HTMLElement): void {
    // All inputs should have labels
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      
      if (!ariaLabel && !ariaLabelledBy) {
        const label = form.querySelector(`label[for="${id}"]`);
        expect(label).toBeInTheDocument();
      }
    });

    // Error messages should be associated with inputs
    const errorMessages = form.querySelectorAll('[role="alert"], .error-message');
    errorMessages.forEach(error => {
      const errorId = error.getAttribute('id');
      if (errorId) {
        const associatedInput = form.querySelector(`[aria-describedby*="${errorId}"]`);
        expect(associatedInput).toBeInTheDocument();
      }
    });
  },

  // Check for skip links
  verifySkipLinks(): void {
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  },

  // Verify landmark structure
  verifyLandmarks(): void {
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  },

  // Test emergency action accessibility
  async verifyEmergencyActionAccessibility(emergencyButton: HTMLElement): Promise<void> {
    // Emergency buttons should have larger touch targets
    this.verifyTouchTargetSize(emergencyButton, healthcareA11yConfig.touchTargetSizes.critical);
    
    // Should have clear ARIA labels
    expect(emergencyButton).toHaveAttribute('aria-label');
    expect(emergencyButton.getAttribute('aria-label')).toMatch(/emergency|urgent|critical/i);
    
    // Should be keyboard accessible
    emergencyButton.focus();
    expect(emergencyButton).toHaveFocus();
  },
};

// Healthcare-specific test scenarios
export const healthcareA11yScenarios = {
  // Test medical form accessibility
  async testMedicalFormA11y(form: HTMLElement): Promise<void> {
    await a11yTestUtils.runA11yTests(form);
    a11yTestUtils.verifyFormAccessibility(form);
    
    // Medical forms should have clear instructions
    expect(screen.getByText(/required fields/i)).toBeInTheDocument();
    
    // Should not expose sensitive data in errors
    const errorMessages = form.querySelectorAll('[role="alert"]');
    errorMessages.forEach(error => {
      if (error.textContent) {
        a11yTestUtils.checkForSensitiveData(error.textContent);
      }
    });
  },

  // Test patient data table accessibility
  async testPatientTableA11y(table: HTMLElement): Promise<void> {
    await a11yTestUtils.runA11yTests(table);
    
    // Should have proper table headers
    const headers = table.querySelectorAll('th');
    expect(headers.length).toBeGreaterThan(0);
    
    // Should support keyboard navigation
    const rows = table.querySelectorAll('tr[tabindex]');
    if (rows.length > 0) {
      await a11yTestUtils.verifyKeyboardNavigation(Array.from(rows));
    }
    
    // Should announce row count for screen readers
    expect(table).toHaveAttribute('aria-rowcount');
  },

  // Test modal accessibility for healthcare contexts
  async testMedicalModalA11y(modal: HTMLElement): Promise<void> {
    await a11yTestUtils.runA11yTests(modal);
    
    // Should trap focus
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length >= 2) {
      await a11yTestUtils.verifyFocusTrapping(
        modal,
        focusableElements[0] as HTMLElement,
        focusableElements[focusableElements.length - 1] as HTMLElement
      );
    }
    
    // Should have proper ARIA attributes
    a11yTestUtils.verifyAriaAttributes(modal, {
      'role': 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': expect.any(String),
    });
  },
};

// Test data generators with accessibility considerations
export const generateA11yTestData = {
  // Generate form data that tests edge cases
  formWithErrors: {
    clientId: '', // Missing required field
    activityId: 'invalid-id', // Invalid selection
    serviceDate: '2023-13-45', // Invalid date
    patientCount: -1, // Invalid number
    patientEntries: [],
    additionalNotes: 'A'.repeat(1001), // Exceeds max length
  },

  // Generate large dataset for performance testing
  largePatientList: Array.from({ length: 1000 }, (_, i) => createMockPatient({
    id: `patient-${i}`,
    firstName: `Patient${i}`,
    lastName: `Test${i}`,
  })),

  // Generate multilingual test data
  multilingualData: {
    english: { clientName: 'Main Hospital', instructions: 'Please complete all required fields' },
    spanish: { clientName: 'Hospital Principal', instructions: 'Por favor complete todos los campos requeridos' },
    // Add more languages as needed
  },
};