// Modal Component Tests following React Testing Library patterns
// Tests for the shared modal component used throughout the application
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/components/Modal';

describe('Modal Component', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    
    // Mock document.body.style for scroll lock
    Object.defineProperty(document.body, 'style', {
      writable: true,
      value: {
        overflow: '',
        paddingRight: ''
      }
    });
  });

  // ================================
  // BASIC RENDERING TESTS
  // ================================

  describe('Basic Rendering', () => {
    test('does not render when closed', () => {
      render(
        <Modal isOpen={false} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    test('renders when open', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    test('renders with title only', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Simple Modal">
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByText('Simple Modal')).toBeInTheDocument();
      expect(screen.queryByTestId('modal-description')).not.toBeInTheDocument();
    });

    test('renders with title and description', () => {
      render(
        <Modal 
          isOpen={true} 
          onClose={mockOnClose} 
          title="Modal Title"
          description="This is a modal description"
        >
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByText('Modal Title')).toBeInTheDocument();
      expect(screen.getByText('This is a modal description')).toBeInTheDocument();
    });

    test('applies custom className', () => {
      render(
        <Modal 
          isOpen={true} 
          onClose={mockOnClose} 
          title="Test Modal"
          className="custom-modal-class"
        >
          <p>Content</p>
        </Modal>
      );

      // The custom class should be applied to the modal content container
      const modalContent = screen.getByRole('dialog');
      expect(modalContent).toHaveClass('custom-modal-class');
    });

    test('renders close button', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    test('renders overlay backdrop', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      // Check for backdrop/overlay element
      const modal = screen.getByRole('dialog');
      const backdrop = modal.parentElement;
      expect(backdrop).toHaveClass('fixed', 'inset-0'); // Tailwind classes for overlay
    });
  });

  // ================================
  // ACCESSIBILITY TESTS
  // ================================

  describe('Accessibility', () => {
    test('has proper ARIA attributes', () => {
      render(
        <Modal 
          isOpen={true} 
          onClose={mockOnClose} 
          title="Test Modal"
          description="Modal description"
        >
          <p>Content</p>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('role', 'dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');

      const titleId = dialog.getAttribute('aria-labelledby');
      const descriptionId = dialog.getAttribute('aria-describedby');

      expect(screen.getByText('Test Modal')).toHaveAttribute('id', titleId);
      expect(screen.getByText('Modal description')).toHaveAttribute('id', descriptionId);
    });

    test('has proper ARIA attributes without description', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).not.toHaveAttribute('aria-describedby');
    });

    test('traps focus within modal', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <input placeholder="First input" />
          <button>Middle button</button>
          <input placeholder="Last input" />
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // The modal should be focused or contain the focused element
      const focusedElement = document.activeElement;
      expect(dialog.contains(focusedElement) || dialog === focusedElement).toBe(true);
    });

    test('restores focus when closed', () => {
      const triggerButton = document.createElement('button');
      triggerButton.textContent = 'Open Modal';
      document.body.appendChild(triggerButton);
      triggerButton.focus();

      const { rerender } = render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      // Close modal
      rerender(
        <Modal isOpen={false} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      // Focus should return to trigger button
      expect(document.activeElement).toBe(triggerButton);
      
      // Cleanup
      document.body.removeChild(triggerButton);
    });

    test('handles tab navigation correctly', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <input placeholder="First input" />
          <button>Middle button</button>
          <input placeholder="Last input" />
        </Modal>
      );

      const firstInput = screen.getByPlaceholderText('First input');
      const middleButton = screen.getByText('Middle button');
      const lastInput = screen.getByPlaceholderText('Last input');
      const closeButton = screen.getByRole('button', { name: /close/i });

      // Tab through focusable elements
      await user.tab();
      expect(firstInput).toHaveFocus();

      await user.tab();
      expect(middleButton).toHaveFocus();

      await user.tab();
      expect(lastInput).toHaveFocus();

      await user.tab();
      expect(closeButton).toHaveFocus();

      // Tab should wrap back to first element
      await user.tab();
      expect(firstInput).toHaveFocus();
    });

    test('handles Shift+Tab navigation correctly', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <input placeholder="First input" />
          <button>Second button</button>
        </Modal>
      );

      const firstInput = screen.getByPlaceholderText('First input');
      const secondButton = screen.getByText('Second button');
      const closeButton = screen.getByRole('button', { name: /close/i });

      // Start with close button focused
      closeButton.focus();

      // Shift+Tab should go backwards
      await user.tab({ shift: true });
      expect(secondButton).toHaveFocus();

      await user.tab({ shift: true });
      expect(firstInput).toHaveFocus();

      // Shift+Tab from first element should wrap to last
      await user.tab({ shift: true });
      expect(closeButton).toHaveFocus();
    });
  });

  // ================================
  // INTERACTION TESTS
  // ================================

  describe('User Interactions', () => {
    test('closes modal on close button click', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('closes modal on Escape key press', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('closes modal on backdrop click', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      // Click on the backdrop (overlay)
      const dialog = screen.getByRole('dialog');
      const backdrop = dialog.parentElement;
      
      await user.click(backdrop!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('does not close modal on content click', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const content = screen.getByText('Modal content');
      await user.click(content);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    test('prevents event bubbling from content to backdrop', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <button>Content button</button>
        </Modal>
      );

      const contentButton = screen.getByText('Content button');
      await user.click(contentButton);

      // Modal should not close when clicking content
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  // ================================
  // SCROLL LOCK TESTS
  // ================================

  describe('Scroll Management', () => {
    test('locks body scroll when open', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      // Body overflow should be hidden to prevent scrolling
      expect(document.body.style.overflow).toBe('hidden');
    });

    test('restores body scroll when closed', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Modal isOpen={false} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      // Body overflow should be restored
      expect(document.body.style.overflow).toBe('');
    });

    test('handles scrollbar width compensation', () => {
      // Mock scrollbar width calculation
      Object.defineProperty(window, 'innerWidth', { value: 1000 });
      Object.defineProperty(document.documentElement, 'clientWidth', { value: 985 }); // 15px scrollbar

      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      // Should add padding to compensate for scrollbar
      expect(document.body.style.paddingRight).toBe('15px');
    });
  });

  // ================================
  // PORTAL RENDERING TESTS
  // ================================

  describe('Portal Rendering', () => {
    test('renders modal in document.body by default', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      const modal = screen.getByRole('dialog');
      
      // Modal should be rendered as a direct child of body (via portal)
      expect(modal.closest('body')).toBe(document.body);
    });

    test('modal is above other page content', () => {
      render(
        <div>
          <div data-testid="page-content">Page content</div>
          <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
            <p>Modal content</p>
          </Modal>
        </div>
      );

      const modal = screen.getByRole('dialog');
      const backdrop = modal.parentElement;
      
      // Check z-index or positioning classes
      expect(backdrop).toHaveClass('fixed', 'inset-0');
      expect(backdrop).toHaveStyle({ zIndex: expect.any(String) });
    });
  });

  // ================================
  // ANIMATION TESTS
  // ================================

  describe('Animation and Transitions', () => {
    test('applies entrance animation classes', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      const modal = screen.getByRole('dialog');
      
      // Should have animation/transition classes
      expect(modal).toHaveClass('transform'); // Common in Tailwind animations
    });

    test('applies backdrop fade animation', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      const modal = screen.getByRole('dialog');
      const backdrop = modal.parentElement;
      
      // Backdrop should have opacity transition classes
      expect(backdrop).toHaveClass('bg-black', 'bg-opacity-50'); // Semi-transparent backdrop
    });
  });

  // ================================
  // ERROR HANDLING TESTS
  // ================================

  describe('Error Handling', () => {
    test('handles missing onClose gracefully', () => {
      // This should not throw an error
      expect(() => {
        render(
          <Modal isOpen={true} onClose={undefined as any} title="Test Modal">
            <p>Content</p>
          </Modal>
        );
      }).not.toThrow();
    });

    test('handles empty content', () => {
      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Empty Modal">
          {null}
        </Modal>
      );

      expect(screen.getByText('Empty Modal')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('handles very long titles gracefully', () => {
      const longTitle = 'This is a very long modal title that should be handled gracefully without breaking the layout or causing any issues with the modal display';

      render(
        <Modal isOpen={true} onClose={mockOnClose} title={longTitle}>
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    test('handles complex content with nested interactive elements', async () => {
      const user = userEvent.setup();
      const mockSubmit = jest.fn();

      render(
        <Modal isOpen={true} onClose={mockOnClose} title="Complex Modal">
          <form onSubmit={mockSubmit}>
            <input placeholder="Name input" />
            <select>
              <option value="1">Option 1</option>
              <option value="2">Option 2</option>
            </select>
            <button type="submit">Submit</button>
          </form>
        </Modal>
      );

      const nameInput = screen.getByPlaceholderText('Name input');
      const select = screen.getByRole('combobox');
      const submitButton = screen.getByText('Submit');

      // Should be able to interact with all form elements
      await user.type(nameInput, 'Test name');
      expect(nameInput).toHaveValue('Test name');

      await user.selectOptions(select, '2');
      expect(select).toHaveValue('2');

      await user.click(submitButton);
      expect(mockSubmit).toHaveBeenCalled();
      
      // Modal should not close when interacting with content
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  // ================================
  // MULTIPLE MODALS TESTS
  // ================================

  describe('Multiple Modals', () => {
    test('handles stacked modals correctly', () => {
      render(
        <>
          <Modal isOpen={true} onClose={mockOnClose} title="First Modal">
            <p>First modal content</p>
          </Modal>
          <Modal isOpen={true} onClose={jest.fn()} title="Second Modal">
            <p>Second modal content</p>
          </Modal>
        </>
      );

      expect(screen.getByText('First Modal')).toBeInTheDocument();
      expect(screen.getByText('Second Modal')).toBeInTheDocument();
      
      // Both modals should be present in the DOM
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs).toHaveLength(2);
    });

    test('manages scroll lock with multiple modals', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={mockOnClose} title="First Modal">
          <p>First modal</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      // Add second modal
      rerender(
        <>
          <Modal isOpen={true} onClose={mockOnClose} title="First Modal">
            <p>First modal</p>
          </Modal>
          <Modal isOpen={true} onClose={jest.fn()} title="Second Modal">
            <p>Second modal</p>
          </Modal>
        </>
      );

      expect(document.body.style.overflow).toBe('hidden');

      // Close first modal, second should still keep scroll locked
      rerender(
        <Modal isOpen={true} onClose={jest.fn()} title="Second Modal">
          <p>Second modal</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      // Close all modals
      rerender(<div />);

      expect(document.body.style.overflow).toBe('');
    });
  });
});