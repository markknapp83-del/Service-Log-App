// Admin User Management Component Tests - Following React Testing Library documentation patterns
// Phase 4: Admin Portal - User Management component tests as specified in plan.md
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { UserManagementPage } from '../pages/UserManagementPage';
import { CreateUserModal } from '../components/CreateUserModal';
import { UsersTable } from '../components/UsersTable';

// Mock API service
const mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../services/apiService', () => ({
  apiService: mockApiService,
}));

// Mock toast hook
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock('../hooks/useToast', () => ({
  useToast: () => mockToast,
}));

// Mock user data
const mockUsers = [
  {
    id: 'user-1',
    email: 'admin@test.com',
    firstName: 'Test',
    lastName: 'Admin',
    role: 'admin',
    isActive: true,
    createdAt: '2023-01-01T00:00:00.000Z',
  },
  {
    id: 'user-2',
    email: 'candidate@test.com',
    firstName: 'Test',
    lastName: 'Candidate',
    role: 'candidate',
    isActive: true,
    createdAt: '2023-01-02T00:00:00.000Z',
  },
  {
    id: 'user-3',
    email: 'inactive@test.com',
    firstName: 'Inactive',
    lastName: 'User',
    role: 'candidate',
    isActive: false,
    createdAt: '2023-01-03T00:00:00.000Z',
  },
];

describe('UserManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiService.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          users: mockUsers,
          pagination: {
            page: 1,
            limit: 20,
            total: 3,
            totalPages: 1,
          },
        },
      },
    });
  });

  test('renders user management page with users table', async () => {
    render(<UserManagementPage />);

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Manage system users and their permissions')).toBeInTheDocument();

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('admin@test.com')).toBeInTheDocument();
      expect(screen.getByText('candidate@test.com')).toBeInTheDocument();
    });

    expect(mockApiService.get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 1, limit: 20 },
    });
  });

  test('shows create user button for admin users', async () => {
    render(<UserManagementPage />);

    const createButton = screen.getByRole('button', { name: /create user/i });
    expect(createButton).toBeInTheDocument();
  });

  test('displays loading state while fetching users', () => {
    mockApiService.get.mockReturnValue(new Promise(() => {})); // Never resolves

    render(<UserManagementPage />);

    expect(screen.getByText('Loading users...')).toBeInTheDocument();
  });

  test('displays error message when fetching fails', async () => {
    mockApiService.get.mockRejectedValue(new Error('Network error'));

    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load users')).toBeInTheDocument();
    });
  });

  test('handles pagination correctly', async () => {
    const user = userEvent.setup();
    
    mockApiService.get
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            users: mockUsers.slice(0, 2),
            pagination: { page: 1, limit: 2, total: 3, totalPages: 2 },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            users: mockUsers.slice(2),
            pagination: { page: 2, limit: 2, total: 3, totalPages: 2 },
          },
        },
      });

    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    });

    // Click next page
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    expect(mockApiService.get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 2, limit: 2 },
    });
  });

  test('handles search functionality', async () => {
    const user = userEvent.setup();
    
    render(<UserManagementPage />);

    await waitFor(() => {
      expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users...');
    await user.type(searchInput, 'admin');

    await waitFor(() => {
      expect(mockApiService.get).toHaveBeenCalledWith('/admin/users', {
        params: { page: 1, limit: 20, search: 'admin' },
      });
    });
  });
});

describe('CreateUserModal', () => {
  const mockOnSuccess = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders create user form', () => {
    render(
      <CreateUserModal 
        isOpen={true} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Create New User')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Role')).toBeInTheDocument();
  });

  test('validates required fields', async () => {
    const user = userEvent.setup();
    
    render(
      <CreateUserModal 
        isOpen={true} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const submitButton = screen.getByRole('button', { name: /create user/i });
    await user.click(submitButton);

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Last name is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  test('validates email format', async () => {
    const user = userEvent.setup();
    
    render(
      <CreateUserModal 
        isOpen={true} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const emailInput = screen.getByLabelText('Email');
    await user.type(emailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /create user/i });
    await user.click(submitButton);

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
  });

  test('validates password strength', async () => {
    const user = userEvent.setup();
    
    render(
      <CreateUserModal 
        isOpen={true} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const passwordInput = screen.getByLabelText('Password');
    await user.type(passwordInput, '123');

    const submitButton = screen.getByRole('button', { name: /create user/i });
    await user.click(submitButton);

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    
    mockApiService.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'new-user-id',
          email: 'newuser@test.com',
          firstName: 'New',
          lastName: 'User',
          role: 'candidate',
          isActive: true,
        },
      },
    });

    render(
      <CreateUserModal 
        isOpen={true} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill form
    await user.type(screen.getByLabelText('Email'), 'newuser@test.com');
    await user.type(screen.getByLabelText('First Name'), 'New');
    await user.type(screen.getByLabelText('Last Name'), 'User');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.selectOptions(screen.getByLabelText('Role'), 'candidate');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create user/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockApiService.post).toHaveBeenCalledWith('/admin/users', {
        email: 'newuser@test.com',
        firstName: 'New',
        lastName: 'User',
        password: 'password123',
        role: 'candidate',
      });
    });

    expect(mockToast.success).toHaveBeenCalledWith('User created successfully');
    expect(mockOnSuccess).toHaveBeenCalled();
  });

  test('handles API errors gracefully', async () => {
    const user = userEvent.setup();
    
    mockApiService.post.mockRejectedValue({
      response: {
        data: {
          success: false,
          error: {
            code: 'CONFLICT_ERROR',
            message: 'User with this email already exists',
          },
        },
      },
    });

    render(
      <CreateUserModal 
        isOpen={true} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill and submit form
    await user.type(screen.getByLabelText('Email'), 'existing@test.com');
    await user.type(screen.getByLabelText('First Name'), 'Test');
    await user.type(screen.getByLabelText('Last Name'), 'User');
    await user.type(screen.getByLabelText('Password'), 'password123');
    
    const submitButton = screen.getByRole('button', { name: /create user/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to create user',
        'User with this email already exists'
      );
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  test('shows loading state during submission', async () => {
    const user = userEvent.setup();
    
    mockApiService.post.mockReturnValue(new Promise(() => {})); // Never resolves

    render(
      <CreateUserModal 
        isOpen={true} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Fill and submit form
    await user.type(screen.getByLabelText('Email'), 'test@test.com');
    await user.type(screen.getByLabelText('First Name'), 'Test');
    await user.type(screen.getByLabelText('Last Name'), 'User');
    await user.type(screen.getByLabelText('Password'), 'password123');
    
    const submitButton = screen.getByRole('button', { name: /create user/i });
    await user.click(submitButton);

    expect(screen.getByText('Creating...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  test('closes modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <CreateUserModal 
        isOpen={true} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});

describe('UsersTable', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnResetPassword = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders users table with correct data', () => {
    render(
      <UsersTable
        users={mockUsers}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onResetPassword={mockOnResetPassword}
      />
    );

    // Check headers
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Check user data
    expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    expect(screen.getByText('Test Admin')).toBeInTheDocument();
    expect(screen.getByText('candidate@test.com')).toBeInTheDocument();
    expect(screen.getByText('Test Candidate')).toBeInTheDocument();
  });

  test('displays correct status badges', () => {
    render(
      <UsersTable
        users={mockUsers}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onResetPassword={mockOnResetPassword}
      />
    );

    // Active users should show "Active" badge
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges).toHaveLength(2);

    // Inactive user should show "Inactive" badge
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  test('renders action buttons for each user', () => {
    render(
      <UsersTable
        users={mockUsers}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onResetPassword={mockOnResetPassword}
      />
    );

    // Should have edit buttons for each user
    const editButtons = screen.getAllByLabelText(/edit user/i);
    expect(editButtons).toHaveLength(mockUsers.length);

    // Should have delete buttons for each user
    const deleteButtons = screen.getAllByLabelText(/delete user/i);
    expect(deleteButtons).toHaveLength(mockUsers.length);

    // Should have reset password buttons for each user
    const resetButtons = screen.getAllByLabelText(/reset password/i);
    expect(resetButtons).toHaveLength(mockUsers.length);
  });

  test('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <UsersTable
        users={mockUsers}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onResetPassword={mockOnResetPassword}
      />
    );

    const editButtons = screen.getAllByLabelText(/edit user/i);
    await user.click(editButtons[0]);

    expect(mockOnEdit).toHaveBeenCalledWith(mockUsers[0]);
  });

  test('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <UsersTable
        users={mockUsers}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onResetPassword={mockOnResetPassword}
      />
    );

    const deleteButtons = screen.getAllByLabelText(/delete user/i);
    await user.click(deleteButtons[0]);

    expect(mockOnDelete).toHaveBeenCalledWith(mockUsers[0]);
  });

  test('calls onResetPassword when reset password button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <UsersTable
        users={mockUsers}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onResetPassword={mockOnResetPassword}
      />
    );

    const resetButtons = screen.getAllByLabelText(/reset password/i);
    await user.click(resetButtons[0]);

    expect(mockOnResetPassword).toHaveBeenCalledWith(mockUsers[0]);
  });

  test('displays empty state when no users provided', () => {
    render(
      <UsersTable
        users={[]}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onResetPassword={mockOnResetPassword}
      />
    );

    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  test('renders role badges with correct styling', () => {
    render(
      <UsersTable
        users={mockUsers}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onResetPassword={mockOnResetPassword}
      />
    );

    const adminBadge = screen.getByText('admin');
    expect(adminBadge).toHaveClass('bg-blue-100', 'text-blue-800');

    const candidateBadges = screen.getAllByText('candidate');
    candidateBadges.forEach(badge => {
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
    });
  });
});