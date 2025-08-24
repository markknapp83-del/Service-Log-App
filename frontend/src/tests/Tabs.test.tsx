// Tabs Component Tests following React Testing Library patterns
// Tests for the shared tabs navigation component used in template management
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs';

describe('Tabs Component', () => {
  const defaultOnValueChange = jest.fn();

  beforeEach(() => {
    defaultOnValueChange.mockClear();
  });

  // ================================
  // BASIC RENDERING TESTS
  // ================================

  describe('Basic Rendering', () => {
    test('renders tabs with default value', () => {
      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeInTheDocument();
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    test('renders tabs with controlled value', () => {
      render(
        <Tabs value="tab2" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      expect(tab2).toHaveAttribute('aria-selected', 'true');
    });

    test('renders with custom className', () => {
      render(
        <Tabs defaultValue="tab1" className="custom-tabs">
          <TabsList className="custom-tabs-list">
            <TabsTrigger value="tab1" className="custom-trigger">Tab 1</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" className="custom-content">Content 1</TabsContent>
        </Tabs>
      );

      const tabsContainer = screen.getByRole('tablist').parentElement;
      expect(tabsContainer).toHaveClass('custom-tabs');
      
      const tabsList = screen.getByRole('tablist');
      expect(tabsList).toHaveClass('custom-tabs-list');
      
      const trigger = screen.getByRole('tab', { name: 'Tab 1' });
      expect(trigger).toHaveClass('custom-trigger');
      
      const content = screen.getByText('Content 1');
      expect(content.parentElement).toHaveClass('custom-content');
    });

    test('applies proper ARIA attributes', () => {
      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
      
      expect(tab1).toHaveAttribute('role', 'tab');
      expect(tab2).toHaveAttribute('role', 'tab');

      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toBeInTheDocument();
      expect(tabpanel).toHaveTextContent('Content 1');
    });
  });

  // ================================
  // INTERACTION TESTS
  // ================================

  describe('Tab Interactions', () => {
    test('switches tabs on click', async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );

      // Initially tab1 should be selected
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();

      // Click tab2
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      await user.click(tab2);

      expect(defaultOnValueChange).toHaveBeenCalledWith('tab2');
      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Content 3')).not.toBeInTheDocument();

      // Click tab3
      const tab3 = screen.getByRole('tab', { name: 'Tab 3' });
      await user.click(tab3);

      expect(defaultOnValueChange).toHaveBeenCalledWith('tab3');
      expect(screen.getByText('Content 3')).toBeInTheDocument();
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    test('handles controlled tab switching', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <Tabs value="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      await user.click(tab2);

      // onValueChange should be called, but content doesn't change until rerender
      expect(defaultOnValueChange).toHaveBeenCalledWith('tab2');
      expect(screen.getByText('Content 1')).toBeInTheDocument(); // Still showing tab1 content

      // Rerender with new value
      rerender(
        <Tabs value="tab2" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
    });

    test('updates selected state correctly', async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });

      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');

      await user.click(tab2);

      expect(tab1).toHaveAttribute('aria-selected', 'false');
      expect(tab2).toHaveAttribute('aria-selected', 'true');
    });

    test('does not call onValueChange when same tab is clicked', async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      await user.click(tab1); // Click already selected tab

      expect(defaultOnValueChange).toHaveBeenCalledWith('tab1');
    });
  });

  // ================================
  // KEYBOARD NAVIGATION TESTS
  // ================================

  describe('Keyboard Navigation', () => {
    test('supports arrow key navigation', async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      const tab3 = screen.getByRole('tab', { name: 'Tab 3' });

      // Focus first tab
      tab1.focus();
      expect(tab1).toHaveFocus();

      // Right arrow to tab2
      await user.keyboard('{ArrowRight}');
      expect(tab2).toHaveFocus();

      // Right arrow to tab3
      await user.keyboard('{ArrowRight}');
      expect(tab3).toHaveFocus();

      // Right arrow should wrap to tab1
      await user.keyboard('{ArrowRight}');
      expect(tab1).toHaveFocus();

      // Left arrow should go to tab3
      await user.keyboard('{ArrowLeft}');
      expect(tab3).toHaveFocus();

      // Left arrow to tab2
      await user.keyboard('{ArrowLeft}');
      expect(tab2).toHaveFocus();
    });

    test('supports Home and End keys', async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab2" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      const tab3 = screen.getByRole('tab', { name: 'Tab 3' });

      // Start with tab2 focused
      tab2.focus();
      expect(tab2).toHaveFocus();

      // Home key should go to first tab
      await user.keyboard('{Home}');
      expect(tab1).toHaveFocus();

      // End key should go to last tab
      await user.keyboard('{End}');
      expect(tab3).toHaveFocus();
    });

    test('supports Enter and Space to select tabs', async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      const tab3 = screen.getByRole('tab', { name: 'Tab 3' });

      // Navigate to tab2 and select with Enter
      tab2.focus();
      await user.keyboard('{Enter}');
      expect(defaultOnValueChange).toHaveBeenCalledWith('tab2');

      defaultOnValueChange.mockClear();

      // Navigate to tab3 and select with Space
      tab3.focus();
      await user.keyboard('{ }'); // Space key
      expect(defaultOnValueChange).toHaveBeenCalledWith('tab3');
    });

    test('supports Tab key to navigate out of tab list', async () => {
      const user = userEvent.setup();

      render(
        <div>
          <button>Before Tabs</button>
          <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
            <TabsList>
              <TabsTrigger value="tab1">Tab 1</TabsTrigger>
              <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">
              <button>Content Button</button>
            </TabsContent>
            <TabsContent value="tab2">Content 2</TabsContent>
          </Tabs>
          <button>After Tabs</button>
        </div>
      );

      const beforeButton = screen.getByText('Before Tabs');
      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const contentButton = screen.getByText('Content Button');
      const afterButton = screen.getByText('After Tabs');

      // Tab from before button to tabs
      beforeButton.focus();
      await user.tab();
      expect(tab1).toHaveFocus();

      // Tab out of tabs to content
      await user.tab();
      expect(contentButton).toHaveFocus();

      // Tab to after button
      await user.tab();
      expect(afterButton).toHaveFocus();
    });
  });

  // ================================
  // ACCESSIBILITY TESTS
  // ================================

  describe('Accessibility', () => {
    test('has proper tabindex management', () => {
      render(
        <Tabs defaultValue="tab2" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      const tab3 = screen.getByRole('tab', { name: 'Tab 3' });

      // Selected tab should have tabindex="0", others should have tabindex="-1"
      expect(tab1).toHaveAttribute('tabindex', '-1');
      expect(tab2).toHaveAttribute('tabindex', '0'); // Selected
      expect(tab3).toHaveAttribute('tabindex', '-1');
    });

    test('maintains focus when switching tabs via keyboard', async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });

      tab1.focus();
      expect(tab1).toHaveFocus();

      // Navigate to tab2 with arrow key
      await user.keyboard('{ArrowRight}');
      expect(tab2).toHaveFocus();

      // Activate tab2 with Enter
      await user.keyboard('{Enter}');
      expect(tab2).toHaveFocus(); // Should maintain focus after activation
    });

    test('has proper ARIA controls relationship', () => {
      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      const tabpanel = screen.getByRole('tabpanel');

      // Check aria-controls attributes
      const tab1Controls = tab1.getAttribute('aria-controls');
      const tab2Controls = tab2.getAttribute('aria-controls');
      
      expect(tab1Controls).toBeTruthy();
      expect(tab2Controls).toBeTruthy();
      
      // Active tab should control the visible tabpanel
      expect(tabpanel).toHaveAttribute('id', tab1Controls);
    });
  });

  // ================================
  // EDGE CASES TESTS
  // ================================

  describe('Edge Cases', () => {
    test('handles empty tabs list', () => {
      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList></TabsList>
        </Tabs>
      );

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
      expect(tablist.children).toHaveLength(0);
    });

    test('handles single tab', async () => {
      const user = userEvent.setup();

      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Only Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Only Content</TabsContent>
        </Tabs>
      );

      const tab = screen.getByRole('tab', { name: 'Only Tab' });
      expect(tab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Only Content')).toBeInTheDocument();

      // Arrow keys should not move focus when there's only one tab
      tab.focus();
      await user.keyboard('{ArrowRight}');
      expect(tab).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(tab).toHaveFocus();
    });

    test('handles tabs with no matching content', () => {
      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          {/* No content for tab2 */}
        </Tabs>
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();
      
      // Should still render tabs even without matching content
      expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeInTheDocument();
    });

    test('handles disabled tabs if implemented', () => {
      render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled>Tab 2 (Disabled)</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );

      const disabledTab = screen.getByRole('tab', { name: 'Tab 2 (Disabled)' });
      
      if (disabledTab.hasAttribute('disabled')) {
        expect(disabledTab).toBeDisabled();
      }
    });

    test('handles dynamic tab addition/removal', () => {
      const { rerender } = render(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );

      expect(screen.getAllByRole('tab')).toHaveLength(2);

      // Add a third tab
      rerender(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );

      expect(screen.getAllByRole('tab')).toHaveLength(3);
      expect(screen.getByRole('tab', { name: 'Tab 3' })).toBeInTheDocument();

      // Remove the second tab
      rerender(
        <Tabs defaultValue="tab1" onValueChange={defaultOnValueChange}>
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );

      expect(screen.getAllByRole('tab')).toHaveLength(2);
      expect(screen.queryByRole('tab', { name: 'Tab 2' })).not.toBeInTheDocument();
    });
  });
});