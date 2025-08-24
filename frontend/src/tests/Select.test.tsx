// Select component tests following React Testing Library and accessibility patterns
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select, SelectOption } from '../components/Select';

// Test data
const mockOptions: SelectOption[] = [
  { value: 'option1', label: 'First Option' },
  { value: 'option2', label: 'Second Option' },
  { value: 'option3', label: 'Third Option' },
  { value: 'disabled-option', label: 'Disabled Option', disabled: true },
];

const defaultProps = {
  options: mockOptions,
  onValueChange: jest.fn(),
  placeholder: 'Select an option',
};

describe('Select Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    test('renders with placeholder text', () => {
      render(<Select {...defaultProps} />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    test('renders with selected value', () => {
      render(<Select {...defaultProps} value="option1" />);
      
      expect(screen.getByText('First Option')).toBeInTheDocument();
      expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
    });

    test('shows chevron icon', () => {
      render(<Select {...defaultProps} />);
      
      const chevron = screen.getByRole('button').querySelector('svg');
      expect(chevron).toBeInTheDocument();
    });

    test('is closed by default', () => {
      render(<Select {...defaultProps} />);
      
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Opening and Closing Dropdown', () => {
    test('opens dropdown on click', async () => {
      render(<Select {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('First Option')).toBeInTheDocument();
      expect(screen.getByText('Second Option')).toBeInTheDocument();
      expect(screen.getByText('Third Option')).toBeInTheDocument();
      expect(screen.getByText('Disabled Option')).toBeInTheDocument();
    });

    test('closes dropdown on second click', async () => {
      render(<Select {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      await user.click(button);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    test('closes dropdown when clicking outside', async () => {
      render(
        <div>
          <Select {...defaultProps} />
          <div data-testid="outside">Outside element</div>
        </div>
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Click outside
      await user.click(screen.getByTestId('outside'));
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });

    test('rotates chevron when open', async () => {
      render(<Select {...defaultProps} />);
      
      const button = screen.getByRole('button');
      const chevron = button.querySelector('svg');
      
      // Closed state
      expect(chevron).not.toHaveClass('rotate-180');
      
      await user.click(button);
      
      // Open state
      expect(chevron).toHaveClass('rotate-180');
    });
  });

  describe('Option Selection', () => {
    test('selects option on click', async () => {
      const mockOnValueChange = jest.fn();
      render(<Select {...defaultProps} onValueChange={mockOnValueChange} />);
      
      const button = screen.getByRole('button');
      await user.click(button);

      const option = screen.getByText('First Option');
      await user.click(option);

      expect(mockOnValueChange).toHaveBeenCalledWith('option1');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    test('shows selected option in button', async () => {
      const mockOnValueChange = jest.fn();
      const { rerender } = render(<Select {...defaultProps} onValueChange={mockOnValueChange} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      await user.click(screen.getByText('Second Option'));

      // Simulate parent component updating value
      rerender(<Select {...defaultProps} value="option2" onValueChange={mockOnValueChange} />);

      expect(screen.getByText('Second Option')).toBeInTheDocument();
      expect(screen.queryByText('Select an option')).not.toBeInTheDocument();
    });

    test('highlights selected option in dropdown', async () => {
      render(<Select {...defaultProps} value="option2" />);
      
      await user.click(screen.getByRole('button'));

      const selectedOption = screen.getByText('Second Option');
      expect(selectedOption).toHaveClass('bg-blue-50', 'text-blue-600');
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    });

    test('does not select disabled options', async () => {
      const mockOnValueChange = jest.fn();
      render(<Select {...defaultProps} onValueChange={mockOnValueChange} />);
      
      await user.click(screen.getByRole('button'));

      const disabledOption = screen.getByText('Disabled Option');
      expect(disabledOption).toHaveAttribute('disabled');
      expect(disabledOption).toHaveClass('cursor-not-allowed', 'opacity-50');

      await user.click(disabledOption);

      expect(mockOnValueChange).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    test('opens dropdown with Enter key', async () => {
      render(<Select {...defaultProps} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard('{Enter}');

      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    test('opens dropdown with Space key', async () => {
      render(<Select {...defaultProps} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard(' ');

      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    test('closes dropdown with Escape key', async () => {
      render(<Select {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    test('navigates options with Arrow Down key', async () => {
      render(<Select {...defaultProps} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      // Open dropdown with Arrow Down
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // First option should be highlighted
      const firstOption = screen.getByText('First Option');
      expect(firstOption).toHaveClass('bg-neutral-100');

      // Navigate to second option
      await user.keyboard('{ArrowDown}');
      const secondOption = screen.getByText('Second Option');
      expect(secondOption).toHaveClass('bg-neutral-100');
      expect(firstOption).not.toHaveClass('bg-neutral-100');

      // Navigate to third option
      await user.keyboard('{ArrowDown}');
      const thirdOption = screen.getByText('Third Option');
      expect(thirdOption).toHaveClass('bg-neutral-100');
      expect(secondOption).not.toHaveClass('bg-neutral-100');

      // Should not go past last option
      await user.keyboard('{ArrowDown}');
      expect(thirdOption).toHaveClass('bg-neutral-100');
    });

    test('navigates options with Arrow Up key', async () => {
      render(<Select {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);

      // Navigate to last option first
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      
      const thirdOption = screen.getByText('Third Option');
      expect(thirdOption).toHaveClass('bg-neutral-100');

      // Navigate up
      await user.keyboard('{ArrowUp}');
      const secondOption = screen.getByText('Second Option');
      expect(secondOption).toHaveClass('bg-neutral-100');
      expect(thirdOption).not.toHaveClass('bg-neutral-100');

      // Navigate up again
      await user.keyboard('{ArrowUp}');
      const firstOption = screen.getByText('First Option');
      expect(firstOption).toHaveClass('bg-neutral-100');
      expect(secondOption).not.toHaveClass('bg-neutral-100');

      // Should not go above first option
      await user.keyboard('{ArrowUp}');
      expect(firstOption).toHaveClass('bg-neutral-100');
    });

    test('selects highlighted option with Enter key', async () => {
      const mockOnValueChange = jest.fn();
      render(<Select {...defaultProps} onValueChange={mockOnValueChange} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(mockOnValueChange).toHaveBeenCalledWith('option2');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    test('selects highlighted option with Space key', async () => {
      const mockOnValueChange = jest.fn();
      render(<Select {...defaultProps} onValueChange={mockOnValueChange} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard(' ');

      expect(mockOnValueChange).toHaveBeenCalledWith('option3');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA attributes', () => {
      render(<Select {...defaultProps} aria-label="Test select" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
      expect(button).toHaveAttribute('aria-label', 'Test select');
    });

    test('has proper ARIA attributes when open', async () => {
      render(<Select {...defaultProps} />);
      
      const button = screen.getByRole('button');
      await user.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(4); // Including disabled option
      
      options.forEach((option, index) => {
        const isSelected = defaultProps.options[index].value === '';
        expect(option).toHaveAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    });

    test('supports aria-describedby for error messages', () => {
      render(
        <Select 
          {...defaultProps} 
          error="This field is required"
          aria-describedby="error-message"
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'error-message');
      
      const errorMessage = screen.getByText('This field is required');
      expect(errorMessage).toBeInTheDocument();
    });

    test('is properly labeled for screen readers', async () => {
      render(<Select {...defaultProps} value="option1" />);
      
      await user.click(screen.getByRole('button'));
      
      const selectedOption = screen.getByText('First Option');
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    });

    test('handles focus management correctly', async () => {
      render(<Select {...defaultProps} />);
      
      const button = screen.getByRole('button');
      
      // Focus should be on button initially
      button.focus();
      expect(document.activeElement).toBe(button);
      
      // Opening dropdown should keep focus on button
      await user.keyboard('{Enter}');
      expect(document.activeElement).toBe(button);
      
      // Selecting an option should keep focus on button
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      expect(document.activeElement).toBe(button);
    });
  });

  describe('Error States', () => {
    test('applies error styling when error prop is provided', () => {
      render(<Select {...defaultProps} error="This field is required" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border-red-500', 'focus:ring-red-500');
    });

    test('displays error message', () => {
      render(<Select {...defaultProps} error="This field is required" />);
      
      const errorMessage = screen.getByText('This field is required');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveClass('text-red-600');
      
      const errorIcon = errorMessage.querySelector('svg');
      expect(errorIcon).toBeInTheDocument();
    });

    test('does not show error message when error is null', () => {
      render(<Select {...defaultProps} error={undefined} />);
      
      expect(screen.queryByText('This field is required')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    test('renders as disabled when disabled prop is true', () => {
      render(<Select {...defaultProps} disabled />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
    });

    test('does not open when disabled', async () => {
      render(<Select {...defaultProps} disabled />);
      
      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    test('does not respond to keyboard when disabled', async () => {
      render(<Select {...defaultProps} disabled />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard('{Enter}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      
      await user.keyboard(' ');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      
      await user.keyboard('{ArrowDown}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty options array', () => {
      render(<Select {...defaultProps} options={[]} />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    test('shows "No options available" when dropdown is empty', async () => {
      render(<Select {...defaultProps} options={[]} />);
      
      await user.click(screen.getByRole('button'));
      
      expect(screen.getByText('No options available')).toBeInTheDocument();
    });

    test('handles invalid selected value gracefully', () => {
      render(<Select {...defaultProps} value="invalid-value" />);
      
      // Should show placeholder since selected value doesn't match any option
      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    test('handles long option labels', () => {
      const longOptions: SelectOption[] = [
        { 
          value: 'long', 
          label: 'This is a very long option label that might overflow the container and cause layout issues if not handled properly' 
        },
      ];
      
      render(<Select {...defaultProps} options={longOptions} />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
      // Component should not crash
    });

    test('handles special characters in option labels', async () => {
      const specialOptions: SelectOption[] = [
        { value: 'special1', label: 'Option with "quotes"' },
        { value: 'special2', label: 'Option with <tags>' },
        { value: 'special3', label: 'Option with &amp; entity' },
      ];
      
      render(<Select {...defaultProps} options={specialOptions} />);
      
      await user.click(screen.getByRole('button'));
      
      expect(screen.getByText('Option with "quotes"')).toBeInTheDocument();
      expect(screen.getByText('Option with <tags>')).toBeInTheDocument();
      expect(screen.getByText('Option with &amp; entity')).toBeInTheDocument();
    });

    test('handles rapid keyboard navigation', async () => {
      render(<Select {...defaultProps} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard('{ArrowDown}');
      
      // Rapidly press arrow keys
      for (let i = 0; i < 10; i++) {
        await user.keyboard('{ArrowDown}');
      }
      
      // Should not crash and should be on last option
      const lastOption = screen.getByText('Third Option');
      expect(lastOption).toHaveClass('bg-neutral-100');
    });
  });

  describe('Performance', () => {
    test('handles large number of options efficiently', async () => {
      const manyOptions: SelectOption[] = Array.from({ length: 1000 }, (_, i) => ({
        value: `option${i}`,
        label: `Option ${i}`,
      }));
      
      const startTime = performance.now();
      render(<Select {...defaultProps} options={manyOptions} />);
      const endTime = performance.now();
      
      // Should render within reasonable time
      expect(endTime - startTime).toBeLessThan(100);
      
      await user.click(screen.getByRole('button'));
      
      // Should show all options (limited by max-height and scroll)
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(listbox).toHaveClass('max-h-60', 'overflow-auto');
    });
  });
});