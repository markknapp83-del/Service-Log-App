// User Management Page following React 18 documentation patterns
// Phase 4: Admin Portal - User Management dashboard as specified in plan.md
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { UsersTable } from '../components/UsersTable';
import { CreateUserModal } from '../components/CreateUserModal';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';
import { User } from '../types/index';

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface EditUserData {
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

export function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    limit: 20
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const { showToast } = useToast();
  const { user: currentUser } = useAuth();

  // Fetch users with debouncing for search
  const fetchUsers = useCallback(async (page: number = 1, search: string = '') => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = { page, limit: pagination.limit };
      if (search) {
        params.search = search;
      }

      const response = await apiService.get<UsersResponse>('/admin/users');
      
      if (response.success) {
        setUsers(response.data.users);
        setPagination({
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages,
          limit: response.data.pagination.limit
        });
      } else {
        setError(response.error.message);
        showToast({
          type: 'error',
          message: 'Failed to load users',
          description: response.error.message
        });
      }
    } catch (err: any) {
      const errorMessage = 'Failed to load users';
      setError(errorMessage);
      showToast({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  // Initial load and search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchUsers(1, searchTerm);
      setCurrentPage(1);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchUsers]);

  // Page change effect
  useEffect(() => {
    if (currentPage > 1) {
      fetchUsers(currentPage, searchTerm);
    }
  }, [currentPage, fetchUsers, searchTerm]);

  const handleCreateSuccess = useCallback(() => {
    fetchUsers(currentPage, searchTerm);
  }, [fetchUsers, currentPage, searchTerm]);

  const handleEditUser = useCallback((user: User) => {
    setEditingUser(user);
  }, []);

  const handleUpdateUser = useCallback(async (userId: string, updates: EditUserData) => {
    try {
      const response = await apiService.put<EditUserData, User>(`/admin/users/${userId}`, updates);
      
      if (response.success) {
        showToast({
          type: 'success',
          message: 'User updated successfully'
        });
        setEditingUser(null);
        fetchUsers(currentPage, searchTerm);
      } else {
        showToast({
          type: 'error',
          message: 'Failed to update user',
          description: response.error.message
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        message: 'Failed to update user'
      });
    }
  }, [fetchUsers, currentPage, searchTerm]);

  const handleDeleteUser = useCallback(async (user: User) => {
    if (!confirm(`Are you sure you want to deactivate ${user.email}?`)) {
      return;
    }

    try {
      const response = await apiService.delete(`/admin/users/${user.id}`);
      
      if (response.success) {
        showToast({
          type: 'success',
          message: 'User deactivated successfully'
        });
        fetchUsers(currentPage, searchTerm);
      } else {
        showToast({
          type: 'error',
          message: 'Failed to deactivate user',
          description: response.error.message
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        message: 'Failed to deactivate user'
      });
    }
  }, [fetchUsers, currentPage, searchTerm]);

  const handleResetPassword = useCallback((user: User) => {
    setResetPasswordUser(user);
    setNewPassword('');
  }, []);

  const handleConfirmPasswordReset = useCallback(async () => {
    if (!resetPasswordUser || !newPassword) {
      return;
    }

    try {
      const response = await apiService.post<{ newPassword: string }, { message: string }>(`/admin/users/${resetPasswordUser.id}/reset-password`, {
        newPassword
      });
      
      if (response.success) {
        showToast({
          type: 'success',
          message: 'Password reset successfully'
        });
        setResetPasswordUser(null);
        setNewPassword('');
      } else {
        showToast({
          type: 'error',
          message: 'Failed to reset password',
          description: response.error.message
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        message: 'Failed to reset password'
      });
    }
  }, [resetPasswordUser, newPassword]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Check if current user is admin
  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage system users and their permissions
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 max-w-lg">
          <Input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full"
          />
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="sm:w-auto"
        >
          Create User
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading users...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">Failed to load users</p>
          <Button onClick={() => fetchUsers(currentPage, searchTerm)}>
            Try Again
          </Button>
        </div>
      )}

      {/* Users Table */}
      {!loading && !error && (
        <>
          <UsersTable
            users={users}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
            onResetPassword={handleResetPassword}
          />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Showing {Math.min((currentPage - 1) * pagination.limit + 1, pagination.total)} to{' '}
                {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} users
              </p>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 py-1 text-sm text-gray-700">
                  Page {currentPage} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdate={handleUpdateUser}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          newPassword={newPassword}
          onPasswordChange={setNewPassword}
          onConfirm={handleConfirmPasswordReset}
          onClose={() => {
            setResetPasswordUser(null);
            setNewPassword('');
          }}
        />
      )}
    </div>
  );
}

// Edit User Modal Component
interface EditUserModalProps {
  user: User;
  onClose: () => void;
  onUpdate: (userId: string, updates: EditUserData) => void;
}

function EditUserModal({ user, onClose, onUpdate }: EditUserModalProps) {
  const [formData, setFormData] = useState<EditUserData>({
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(user.id, formData);
  };

  const handleChange = (field: keyof EditUserData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = e.target.type === 'checkbox' 
      ? (e.target as HTMLInputElement).checked 
      : e.target.value;
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Edit User: {user.email}
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="editFirstName" className="block text-sm font-medium text-gray-700">
                      First Name
                    </label>
                    <Input
                      id="editFirstName"
                      type="text"
                      value={formData.firstName}
                      onChange={handleChange('firstName')}
                    />
                  </div>
                  <div>
                    <label htmlFor="editLastName" className="block text-sm font-medium text-gray-700">
                      Last Name
                    </label>
                    <Input
                      id="editLastName"
                      type="text"
                      value={formData.lastName}
                      onChange={handleChange('lastName')}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="editRole" className="block text-sm font-medium text-gray-700">
                    Role
                  </label>
                  <select
                    id="editRole"
                    value={formData.role}
                    onChange={handleChange('role')}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                  >
                    <option value="candidate">Candidate</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={handleChange('isActive')}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <Button type="submit" className="w-full sm:w-auto sm:ml-3">
                Update User
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="mt-3 w-full sm:mt-0 sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Reset Password Modal Component
interface ResetPasswordModalProps {
  user: User;
  newPassword: string;
  onPasswordChange: (password: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function ResetPasswordModal({ 
  user, 
  newPassword, 
  onPasswordChange, 
  onConfirm, 
  onClose 
}: ResetPasswordModalProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm();
  };

  const isValidPassword = newPassword.length >= 8 && 
    /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Reset Password: {user.email}
              </h3>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                  New Password
                </label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder="Enter new password"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Password must be at least 8 characters with uppercase, lowercase, and number
                </p>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <Button 
                type="submit" 
                className="w-full sm:w-auto sm:ml-3"
                disabled={!isValidPassword}
              >
                Reset Password
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="mt-3 w-full sm:mt-0 sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}