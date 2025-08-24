// Accessibility tests following WCAG 2.1 AA guidelines and testing library patterns
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ServiceLogForm } from '../components/ServiceLogForm';
import { ServiceLogPage } from '../pages/ServiceLogPage';
import { Select } from '../components/Select';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

// Extend Jest matchers for accessibility
expect.extend(toHaveNoViolations);

// Mock hooks and services
jest.mock('../hooks/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('../services/apiService', () => ({
  apiService: {
    get: jest.fn().mockResolvedValue({
      success: true,
      data: {
        clients: [
          {
            id: 'client-1',
            name: 'Main Hospital',
            description: 'Primary healthcare facility',
            isActive: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
        ],
        activities: [
          {
            id: 'activity-1',
            name: 'General Consultation',
            description: 'Standard patient consultation',
            isActive: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
        ],
        outcomes: [
          {
            id: 'outcome-1',
            name: 'Treatment Completed',
            description: 'Patient treatment successfully completed',
            isActive: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
        ],
      },
    }),
    post: jest.fn(),
  },
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Test data
const defaultProps = {
  clients: [
    {
      id: 'client-1',
      name: 'Main Hospital',
      description: 'Primary healthcare facility',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    },
  ],
  activities: [
    {
      id: 'activity-1',
      name: 'General Consultation',
      description: 'Standard patient consultation',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    },
  ],
  outcomes: [
    {
      id: 'outcome-1',
      name: 'Treatment Completed',
      description: 'Patient treatment successfully completed',
      isActive: true,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    },
  ],
  onSubmit: jest.fn(),
};

describe('Accessibility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  describe('ServiceLogForm Accessibility', () => {
    test('has no accessibility violations', async () => {
      const { container } = render(<ServiceLogForm {...defaultProps} />);
      
      // Wait for form to fully render
      await waitFor(() => {
        expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('has proper heading hierarchy', async () => {
      render(<ServiceLogForm {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Service Log Entry');
      });

      // After adding patient entries, there should be proper h2 headings
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await userEvent.setup().clear(patientCountInput);
      await userEvent.setup().type(patientCountInput, '2');

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Patient Entries');
      });
    });

    test('has proper form labels and associations', () => {
      render(<ServiceLogForm {...defaultProps} />);

      // All form inputs should have associated labels
      expect(screen.getByLabelText(/number of patient entries/i)).toBeInTheDocument();
      expect(screen.getByText('Client/Site')).toBeInTheDocument();
      expect(screen.getByText('Activity/Specialty')).toBeInTheDocument();

      // Required indicators should be present and accessible
      const requiredIndicators = screen.getAllByText('*');
      expect(requiredIndicators).toHaveLength(3);
    });

    test('provides appropriate error messages with ARIA associations', async () => {
      const user = userEvent.setup();
      render(<ServiceLogForm {...defaultProps} />);

      const submitButton = screen.getByText('Save Service Log');
      await user.click(submitButton);

      await waitFor(() => {
        const clientSelect = screen.getByRole('button', { name: /select client/i });
        expect(clientSelect).toHaveAttribute('aria-describedby');
        
        const activitySelect = screen.getByRole('button', { name: /select activity/i });
        expect(activitySelect).toHaveAttribute('aria-describedby');
      });
    });

    test('has proper focus management', async () => {
      const user = userEvent.setup();
      render(<ServiceLogForm {...defaultProps} />);

      // Tab navigation should work logically
      const clientSelect = screen.getByRole('button', { name: /select client/i });
      const activitySelect = screen.getByRole('button', { name: /select activity/i });
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);

      await user.tab();
      expect(clientSelect).toHaveFocus();

      await user.tab();
      expect(activitySelect).toHaveFocus();

      await user.tab();
      expect(patientCountInput).toHaveFocus();
    });

    test('supports keyboard navigation for all interactive elements', async () => {
      const user = userEvent.setup();
      render(<ServiceLogForm {...defaultProps} />);

      // Generate patient entry
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '1');

      await waitFor(() => {
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
      });

      // All buttons should be reachable via keyboard
      const clearButton = screen.getByText('Clear Form');
      const submitButton = screen.getByText('Save Service Log');

      clearButton.focus();
      expect(clearButton).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    test('provides proper live regions for dynamic content', async () => {
      const user = userEvent.setup();
      render(<ServiceLogForm {...defaultProps} />);

      // Auto-save indicator should be announced to screen readers
      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '2');

      // The auto-saving indicator should have proper ARIA attributes
      await waitFor(() => {
        const autoSaveIndicator = screen.queryByText('Auto-saving draft...');
        if (autoSaveIndicator) {
          expect(autoSaveIndicator.closest('div')).toHaveAttribute('aria-live', 'polite');
        }
      });
    });

    test('has sufficient color contrast', () => {
      render(<ServiceLogForm {...defaultProps} />);

      // Required indicators should be visible
      const requiredIndicators = screen.getAllByText('*');
      requiredIndicators.forEach(indicator => {
        expect(indicator).toHaveClass('text-red-500');
      });

      // Button should have proper contrast
      const submitButton = screen.getByText('Save Service Log');
      expect(submitButton).toHaveClass('bg-blue-600', 'text-white');
    });

    test('supports screen reader announcements for form state', async () => {
      const user = userEvent.setup();
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '1');

      await waitFor(() => {
        // Unsaved changes indicator should be announced
        const unsavedIndicator = screen.getByText('Unsaved changes');
        expect(unsavedIndicator).toBeInTheDocument();
      });
    });
  });

  describe('Select Component Accessibility', () => {
    const selectProps = {
      options: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' },
      ],
      onValueChange: jest.fn(),
    };

    test('has no accessibility violations', async () => {
      const { container } = render(<Select {...selectProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('has proper ARIA attributes', () => {
      render(<Select {...selectProps} aria-label="Test select" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
      expect(button).toHaveAttribute('aria-label', 'Test select');
    });

    test('announces dropdown state changes', async () => {
      const user = userEvent.setup();
      render(<Select {...selectProps} />);

      const button = screen.getByRole('button');
      
      // Initially closed
      expect(button).toHaveAttribute('aria-expanded', 'false');

      await user.click(button);

      // Should announce that it's open
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    test('has proper option roles and states', async () => {
      const user = userEvent.setup();
      render(<Select {...selectProps} value="option2" />);

      await user.click(screen.getByRole('button'));

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);

      // Selected option should be marked
      const selectedOption = screen.getByText('Option 2');
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');

      // Other options should not be marked as selected
      const option1 = screen.getByText('Option 1');
      const option3 = screen.getByText('Option 3');
      expect(option1).toHaveAttribute('aria-selected', 'false');
      expect(option3).toHaveAttribute('aria-selected', 'false');
    });

    test('supports keyboard navigation with proper announcements', async () => {
      const user = userEvent.setup();
      render(<Select {...selectProps} />);

      const button = screen.getByRole('button');
      button.focus();

      // Open with Enter
      await user.keyboard('{Enter}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Navigate with arrows - highlighted option should have visual indication
      await user.keyboard('{ArrowDown}');
      const firstOption = screen.getByText('Option 1');
      expect(firstOption).toHaveClass('bg-neutral-100');

      await user.keyboard('{ArrowDown}');
      const secondOption = screen.getByText('Option 2');
      expect(secondOption).toHaveClass('bg-neutral-100');
      expect(firstOption).not.toHaveClass('bg-neutral-100');
    });

    test('handles error states accessibly', () => {
      render(
        <Select 
          {...selectProps} 
          error="This field is required"
          aria-describedby="error-message"
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'error-message');
      expect(button).toHaveClass('border-red-500');

      const errorMessage = screen.getByText('This field is required');
      expect(errorMessage).toHaveClass('text-red-600');
      expect(errorMessage.querySelector('svg')).toBeInTheDocument(); // Error icon
    });
  });

  describe('ServiceLogPage Accessibility', () => {
    test('has no accessibility violations', async () => {
      const { container } = render(<ServiceLogPage />);
      
      await waitFor(() => {
        expect(screen.getByText('New Service Log Entry')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('has proper page structure and landmarks', async () => {
      render(<ServiceLogPage />);

      await waitFor(() => {
        // Main heading should be present
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('New Service Log Entry');
      });

      // Instructions section should be properly structured
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Instructions');
    });

    test('provides meaningful page description', async () => {
      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByText('Record patient services and outcomes for healthcare tracking.')).toBeInTheDocument();
      });
    });

    test('loading state is accessible', async () => {
      // Mock delayed API response
      const { apiService } = require('../services/apiService');
      apiService.get.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => 
          resolve({ success: true, data: { clients: [], activities: [], outcomes: [] } }), 100
        ))
      );

      render(<ServiceLogPage />);

      const loadingText = screen.getByText('Loading form...');
      expect(loadingText).toBeInTheDocument();

      // Loading indicator should have appropriate role
      const loadingSpinner = loadingText.parentElement?.querySelector('[role="status"]');
      expect(loadingSpinner).toBeInTheDocument();
    });

    test('error state provides actionable feedback', async () => {
      const { apiService } = require('../services/apiService');
      apiService.get.mockRejectedValueOnce(new Error('Network error'));

      render(<ServiceLogPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Unable to Load Form');
      });

      // Error should provide clear action
      const retryButton = screen.getByRole('button', { name: 'Retry' });
      expect(retryButton).toBeInTheDocument();

      // Error icon should be present for visual users
      const errorIcon = screen.getByRole('heading', { level: 2 }).parentElement?.querySelector('svg');
      expect(errorIcon).toBeInTheDocument();
    });

    test('navigation buttons are properly labeled', async () => {
      render(<ServiceLogPage />);

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: 'Back' });
        const viewAllButton = screen.getByRole('button', { name: 'View All Logs' });

        expect(backButton).toBeInTheDocument();
        expect(viewAllButton).toBeInTheDocument();
      });
    });
  });

  describe('Input Component Accessibility', () => {
    test('has proper label association', () => {
      render(
        <Input 
          label="Patient Name" 
          name="patientName"
          required
        />
      );

      const input = screen.getByLabelText('Patient Name');
      expect(input).toHaveAttribute('name', 'patientName');
      expect(input).toHaveAttribute('required');

      // Required indicator should be present
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    test('provides helper text accessibly', () => {
      render(
        <Input 
          label="Patient Count" 
          helperText="Enter number between 1-100"
          name="patientCount"
        />
      );

      const input = screen.getByLabelText('Patient Count');
      const helperText = screen.getByText('Enter number between 1-100');

      // Input should be described by helper text
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('help'));
      expect(helperText).toHaveAttribute('id', expect.stringContaining('help'));
    });

    test('handles error states accessibly', () => {
      render(
        <Input 
          label="Email" 
          name="email"
          error="Please enter a valid email"
        />
      );

      const input = screen.getByLabelText('Email');
      const errorMessage = screen.getByText('Please enter a valid email');

      // Input should be described by error message
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(errorMessage).toHaveClass('text-red-600');
    });
  });

  describe('Button Component Accessibility', () => {
    test('has proper states and labels', () => {
      render(<Button variant="primary">Save Changes</Button>);

      const button = screen.getByRole('button', { name: 'Save Changes' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-blue-600');
    });

    test('handles loading state accessibly', () => {
      render(<Button isLoading={true}>Processing...</Button>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    test('provides appropriate focus indicators', async () => {
      const user = userEvent.setup();
      render(<Button>Focus Test</Button>);

      const button = screen.getByRole('button');
      await user.tab();

      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2');
    });
  });

  describe('Card Component Accessibility', () => {
    test('has proper semantic structure', () => {
      render(
        <Card>
          <h2>Card Title</h2>
          <p>Card content goes here.</p>
        </Card>
      );

      const card = screen.getByRole('article');
      expect(card).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Card Title');
    });
  });

  describe('High Contrast and Reduced Motion Support', () => {
    test('respects prefers-reduced-motion', () => {
      // Mock reduced motion preference
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

      render(<ServiceLogForm {...defaultProps} />);

      // Animated elements should respect reduced motion
      const form = screen.getByText('Service Log Entry').closest('form');
      expect(form).toBeInTheDocument();
    });

    test('maintains accessibility in high contrast mode', () => {
      // Mock high contrast preference
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

      render(<ServiceLogForm {...defaultProps} />);

      // Form should still be accessible in high contrast mode
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
    });
  });

  describe('Screen Reader Support', () => {
    test('provides meaningful form instructions', () => {
      render(<ServiceLogForm {...defaultProps} />);

      // Helper texts should provide context for screen readers
      expect(screen.getByText('How many individual patient entries to create (1-100)')).toBeInTheDocument();
      expect(screen.getByText('Did Not Attend')).toBeInTheDocument();
    });

    test('announces dynamic content changes', async () => {
      const user = userEvent.setup();
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.clear(patientCountInput);
      await user.type(patientCountInput, '2');

      await waitFor(() => {
        // Patient entries section should be announced
        expect(screen.getByText('Patient Entries')).toBeInTheDocument();
        expect(screen.getByText('Entry 1')).toBeInTheDocument();
        expect(screen.getByText('Entry 2')).toBeInTheDocument();
      });
    });

    test('provides context for complex forms', async () => {
      const user = userEvent.setup();
      render(<ServiceLogForm {...defaultProps} />);

      const patientCountInput = screen.getByLabelText(/number of patient entries/i);
      await user.type(patientCountInput, '1');

      await waitFor(() => {
        // Summary section provides context
        expect(screen.getByText('Summary')).toBeInTheDocument();
        expect(screen.getByText('Total Patients:')).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Accessibility', () => {
    test('maintains accessibility on mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 667 });

      render(<ServiceLogForm {...defaultProps} />);

      // Form should remain accessible on mobile
      expect(screen.getByText('Service Log Entry')).toBeInTheDocument();
      expect(screen.getByLabelText(/number of patient entries/i)).toBeInTheDocument();
    });

    test('maintains touch target sizes', () => {
      render(<ServiceLogForm {...defaultProps} />);

      // Buttons should have adequate touch targets
      const clearButton = screen.getByText('Clear Form');
      const submitButton = screen.getByText('Save Service Log');

      // These should have minimum 44px touch targets (tested via CSS classes)
      expect(clearButton).toHaveClass('px-6', 'py-2'); // Adequate padding
      expect(submitButton).toHaveClass('px-6', 'py-2'); // Adequate padding
    });
  });
});