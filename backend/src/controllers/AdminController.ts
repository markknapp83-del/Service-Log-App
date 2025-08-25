// Admin Controller following Express.js documentation patterns
// Phase 4: Admin Portal - User Management controller as specified in plan.md
import { Request, Response } from 'express';
import { UserRepository } from '@/models/UserRepository';
import { ClientRepository } from '@/models/ClientRepository';
import { ActivityRepository } from '@/models/ActivityRepository';
import { OutcomeRepository } from '@/models/OutcomeRepository';
import { logger } from '@/utils/logger';
import { NotFoundError, ConflictError, ValidationError } from '@/utils/errors';
import bcrypt from 'bcryptjs';
import { UserId, ClientId, ActivityId, OutcomeId } from '@/types/index';

export class AdminController {
  private userRepository: UserRepository;
  private clientRepository: ClientRepository;
  private activityRepository: ActivityRepository;
  private outcomeRepository: OutcomeRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.clientRepository = new ClientRepository();
    this.activityRepository = new ActivityRepository();
    this.outcomeRepository = new OutcomeRepository();
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
        lastLoginAt: '',
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

  // ========================================
  // PHASE 5: TEMPLATE MANAGEMENT METHODS
  // ========================================

  // GET /api/admin/templates/clients - List clients with stats
  async getClients(req: Request, res: Response): Promise<void> {
    try {
      const clients = this.clientRepository.findWithStats();

      logger.debug('Admin retrieved clients list', { 
        requestedBy: req.user?.id,
        clientCount: clients.length
      });

      res.json({
        success: true,
        data: clients,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error retrieving clients', { error, requestedBy: req.user?.id });
      throw error;
    }
  }

  // POST /api/admin/templates/clients - Create new client
  async createClient(req: Request, res: Response): Promise<void> {
    try {
      const { name, isActive = true } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Unauthorized: No user ID in request');
      }

      const client = this.clientRepository.createClient(
        { name, isActive },
        userId
      );

      logger.info('Admin created new client', { 
        createdBy: userId,
        clientId: client.id,
        clientName: client.name
      });

      res.status(201).json({
        success: true,
        data: client,
        message: 'Client created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating client', { error, createdBy: req.user?.id, clientData: req.body });
      throw error;
    }
  }

  // PUT /api/admin/templates/clients/:id - Update client
  async updateClient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const clientId = parseInt(id, 10) as ClientId;
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Unauthorized: No user ID in request');
      }

      if (isNaN(clientId) || clientId < 1) {
        throw new ValidationError('Invalid client ID');
      }

      const client = this.clientRepository.updateClient(clientId, req.body, userId);

      logger.info('Admin updated client', { 
        updatedBy: userId,
        clientId,
        updates: req.body
      });

      res.json({
        success: true,
        data: client,
        message: 'Client updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error updating client', { error, updatedBy: req.user?.id, clientId: req.params.id });
      throw error;
    }
  }

  // DELETE /api/admin/templates/clients/:id - Delete client
  async deleteClient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const clientId = parseInt(id, 10) as ClientId;
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Unauthorized: No user ID in request');
      }

      if (isNaN(clientId) || clientId < 1) {
        throw new ValidationError('Invalid client ID');
      }

      this.clientRepository.delete(clientId, userId);

      logger.info('Admin deleted client', { 
        deletedBy: userId,
        clientId
      });

      res.json({
        success: true,
        message: 'Client deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error deleting client', { error, deletedBy: req.user?.id, clientId: req.params.id });
      throw error;
    }
  }

  // GET /api/admin/templates/activities - List activities with stats
  async getActivities(req: Request, res: Response): Promise<void> {
    try {
      const activities = this.activityRepository.findWithStats();

      logger.debug('Admin retrieved activities list', { 
        requestedBy: req.user?.id,
        activityCount: activities.length
      });

      res.json({
        success: true,
        data: activities,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error retrieving activities', { error, requestedBy: req.user?.id });
      throw error;
    }
  }

  // POST /api/admin/templates/activities - Create new activity
  async createActivity(req: Request, res: Response): Promise<void> {
    try {
      const { name, isActive = true } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Unauthorized: No user ID in request');
      }

      const activity = this.activityRepository.createActivity(
        { name, isActive },
        userId
      );

      logger.info('Admin created new activity', { 
        createdBy: userId,
        activityId: activity.id,
        activityName: activity.name
      });

      res.status(201).json({
        success: true,
        data: activity,
        message: 'Activity created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating activity', { error, createdBy: req.user?.id, activityData: req.body });
      throw error;
    }
  }

  // PUT /api/admin/templates/activities/:id - Update activity
  async updateActivity(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const activityId = parseInt(id, 10) as ActivityId;
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Unauthorized: No user ID in request');
      }

      if (isNaN(activityId) || activityId < 1) {
        throw new ValidationError('Invalid activity ID');
      }

      const activity = this.activityRepository.updateActivity(activityId, req.body, userId);

      logger.info('Admin updated activity', { 
        updatedBy: userId,
        activityId,
        updates: req.body
      });

      res.json({
        success: true,
        data: activity,
        message: 'Activity updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error updating activity', { error, updatedBy: req.user?.id, activityId: req.params.id });
      throw error;
    }
  }

  // DELETE /api/admin/templates/activities/:id - Delete activity
  async deleteActivity(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const activityId = parseInt(id, 10) as ActivityId;
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Unauthorized: No user ID in request');
      }

      if (isNaN(activityId) || activityId < 1) {
        throw new ValidationError('Invalid activity ID');
      }

      this.activityRepository.delete(activityId, userId);

      logger.info('Admin deleted activity', { 
        deletedBy: userId,
        activityId
      });

      res.json({
        success: true,
        message: 'Activity deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error deleting activity', { error, deletedBy: req.user?.id, activityId: req.params.id });
      throw error;
    }
  }

  // GET /api/admin/templates/outcomes - List outcomes with stats
  async getOutcomes(req: Request, res: Response): Promise<void> {
    try {
      const outcomes = this.outcomeRepository.findWithStats();

      logger.debug('Admin retrieved outcomes list', { 
        requestedBy: req.user?.id,
        outcomeCount: outcomes.length
      });

      res.json({
        success: true,
        data: outcomes,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error retrieving outcomes', { error, requestedBy: req.user?.id });
      throw error;
    }
  }

  // POST /api/admin/templates/outcomes - Create new outcome
  async createOutcome(req: Request, res: Response): Promise<void> {
    try {
      const { name, isActive = true } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Unauthorized: No user ID in request');
      }

      const outcome = this.outcomeRepository.createOutcome(
        { name, isActive },
        userId
      );

      logger.info('Admin created new outcome', { 
        createdBy: userId,
        outcomeId: outcome.id,
        outcomeName: outcome.name
      });

      res.status(201).json({
        success: true,
        data: outcome,
        message: 'Outcome created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating outcome', { error, createdBy: req.user?.id, outcomeData: req.body });
      throw error;
    }
  }

  // PUT /api/admin/templates/outcomes/:id - Update outcome
  async updateOutcome(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const outcomeId = parseInt(id, 10) as OutcomeId;
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Unauthorized: No user ID in request');
      }

      if (isNaN(outcomeId) || outcomeId < 1) {
        throw new ValidationError('Invalid outcome ID');
      }

      const outcome = this.outcomeRepository.updateOutcome(outcomeId, req.body, userId);

      logger.info('Admin updated outcome', { 
        updatedBy: userId,
        outcomeId,
        updates: req.body
      });

      res.json({
        success: true,
        data: outcome,
        message: 'Outcome updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error updating outcome', { error, updatedBy: req.user?.id, outcomeId: req.params.id });
      throw error;
    }
  }

  // DELETE /api/admin/templates/outcomes/:id - Delete outcome
  async deleteOutcome(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const outcomeId = parseInt(id, 10) as OutcomeId;
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('Unauthorized: No user ID in request');
      }

      if (isNaN(outcomeId) || outcomeId < 1) {
        throw new ValidationError('Invalid outcome ID');
      }

      this.outcomeRepository.delete(outcomeId, userId);

      logger.info('Admin deleted outcome', { 
        deletedBy: userId,
        outcomeId
      });

      res.json({
        success: true,
        message: 'Outcome deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error deleting outcome', { error, deletedBy: req.user?.id, outcomeId: req.params.id });
      throw error;
    }
  }















}