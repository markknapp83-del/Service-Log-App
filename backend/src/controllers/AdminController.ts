// Admin Controller following Express.js documentation patterns
// Phase 4: Admin Portal - User Management controller as specified in plan.md
import { Request, Response } from 'express';
import { UserRepository } from '@/models/UserRepository';
import { logger } from '@/utils/logger';
import { NotFoundError, ConflictError, ValidationError } from '@/utils/errors';
import bcrypt from 'bcryptjs';
import { UserId } from '@/types/index';

export class AdminController {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  // GET /api/admin/users - List users with pagination and filtering
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, search } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      // Validate pagination parameters
      if (pageNum < 1) {
        throw new ValidationError('Page must be greater than 0');
      }
      if (limitNum < 1 || limitNum > 100) {
        throw new ValidationError('Limit must be between 1 and 100');
      }

      // Get all users first (we'll implement proper pagination later if needed)
      const allUsers = this.userRepository.findAll();
      
      // Filter users based on search
      let filteredUsers = allUsers;
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        filteredUsers = allUsers.filter(user => 
          user.email.toLowerCase().includes(searchTerm) ||
          user.firstName.toLowerCase().includes(searchTerm) ||
          user.lastName.toLowerCase().includes(searchTerm)
        );
      }

      // Calculate pagination
      const total = filteredUsers.length;
      const totalPages = Math.ceil(total / limitNum);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

      // Remove password hashes from response
      const sanitizedUsers = paginatedUsers.map(user => {
        const { passwordHash, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      logger.info('Admin users list retrieved', { 
        requestedBy: req.user?.id, 
        total: sanitizedUsers.length,
        page: pageNum,
        limit: limitNum 
      });

      res.json({
        success: true,
        data: {
          users: sanitizedUsers,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error retrieving users', { error, requestedBy: req.user?.id });
      throw error;
    }
  }

  // POST /api/admin/users - Create new user
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName, role = 'candidate' } = req.body;

      // Validate required fields
      if (!email || !password || !firstName || !lastName) {
        throw new ValidationError('Email, password, first name, and last name are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ValidationError('Please provide a valid email address');
      }

      // Validate password strength
      if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long');
      }

      // Validate role
      if (!['admin', 'candidate'].includes(role)) {
        throw new ValidationError('Role must be either "admin" or "candidate"');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const newUser = this.userRepository.create({
        email,
        username: email, // Use email as username for simplicity
        passwordHash,
        firstName,
        lastName,
        role,
        isActive: true,
        lastLoginAt: undefined,
        updatedAt: new Date().toISOString()
      });

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = newUser;

      logger.info('Admin created new user', { 
        createdBy: req.user?.id, 
        newUserId: newUser.id,
        email: newUser.email,
        role: newUser.role
      });

      res.status(201).json({
        success: true,
        data: userResponse,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating user', { error, createdBy: req.user?.id });
      throw error;
    }
  }

  // PUT /api/admin/users/:id - Update user
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new ValidationError('Invalid user ID format');
      }

      // Remove password from updates (use dedicated endpoint for password reset)
      const { password, passwordHash, ...allowedUpdates } = updates;

      // Validate role if provided
      if (allowedUpdates.role && !['admin', 'candidate'].includes(allowedUpdates.role)) {
        throw new ValidationError('Role must be either "admin" or "candidate"');
      }

      // Validate email format if provided
      if (allowedUpdates.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(allowedUpdates.email)) {
          throw new ValidationError('Please provide a valid email address');
        }
      }

      const updatedUser = this.userRepository.update(id as UserId, allowedUpdates);

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = updatedUser;

      logger.info('Admin updated user', { 
        updatedBy: req.user?.id, 
        userId: id,
        updates: Object.keys(allowedUpdates)
      });

      res.json({
        success: true,
        data: userResponse,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error updating user', { error, updatedBy: req.user?.id, userId: req.params.id });
      throw error;
    }
  }

  // DELETE /api/admin/users/:id - Soft delete user (deactivate)
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new ValidationError('Invalid user ID format');
      }

      // Check if user exists before deletion
      const user = this.userRepository.findById(id as UserId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Prevent deleting own account
      if (req.user?.id === id) {
        throw new ValidationError('Cannot delete your own account');
      }

      this.userRepository.delete(id as UserId);

      logger.info('Admin deactivated user', { 
        deactivatedBy: req.user?.id, 
        userId: id,
        userEmail: user.email
      });

      res.json({
        success: true,
        message: 'User has been deactivated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error deactivating user', { error, deactivatedBy: req.user?.id, userId: req.params.id });
      throw error;
    }
  }

  // POST /api/admin/users/:id/reset-password - Reset user password
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new ValidationError('Invalid user ID format');
      }

      // Validate new password
      if (!newPassword) {
        throw new ValidationError('New password is required');
      }
      if (newPassword.length < 8) {
        throw new ValidationError('Password must be at least 8 characters long');
      }

      // Check if user exists
      const user = this.userRepository.findById(id as UserId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update user password
      this.userRepository.update(id as UserId, { passwordHash });

      logger.info('Admin reset user password', { 
        resetBy: req.user?.id, 
        userId: id,
        userEmail: user.email
      });

      res.json({
        success: true,
        message: 'User password has been reset successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error resetting user password', { error, resetBy: req.user?.id, userId: req.params.id });
      throw error;
    }
  }

  // GET /api/admin/users/:id - Get single user details
  async getUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new ValidationError('Invalid user ID format');
      }

      const user = this.userRepository.findById(id as UserId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;

      logger.debug('Admin retrieved user details', { 
        requestedBy: req.user?.id, 
        userId: id
      });

      res.json({
        success: true,
        data: userResponse,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error retrieving user', { error, requestedBy: req.user?.id, userId: req.params.id });
      throw error;
    }
  }
}