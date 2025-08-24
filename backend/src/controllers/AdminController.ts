// Admin Controller following Express.js documentation patterns
// Phase 4: Admin Portal - User Management controller as specified in plan.md
import { Request, Response } from 'express';
import { UserRepository } from '@/models/UserRepository';
import { ClientRepository } from '@/models/ClientRepository';
import { ActivityRepository } from '@/models/ActivityRepository';
import { OutcomeRepository } from '@/models/OutcomeRepository';
import { CustomFieldRepository } from '@/models/CustomFieldRepository';
import { FieldChoiceRepository } from '@/models/FieldChoiceRepository';
import { logger } from '@/utils/logger';
import { NotFoundError, ConflictError, ValidationError } from '@/utils/errors';
import bcrypt from 'bcryptjs';
import { UserId, ClientId, ActivityId, OutcomeId, CustomFieldId, FieldChoiceId } from '@/types/index';

export class AdminController {
  private userRepository: UserRepository;
  private clientRepository: ClientRepository;
  private activityRepository: ActivityRepository;
  private outcomeRepository: OutcomeRepository;
  private customFieldRepository: CustomFieldRepository;
  private fieldChoiceRepository: FieldChoiceRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.clientRepository = new ClientRepository();
    this.activityRepository = new ActivityRepository();
    this.outcomeRepository = new OutcomeRepository();
    this.customFieldRepository = new CustomFieldRepository();
    this.fieldChoiceRepository = new FieldChoiceRepository();
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
      const userId = req.user?.id as string;

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
      const userId = req.user?.id as string;

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
      const userId = req.user?.id as string;

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
      const userId = req.user?.id as string;

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
      const userId = req.user?.id as string;

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
      const userId = req.user?.id as string;

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
      const userId = req.user?.id as string;

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
      const userId = req.user?.id as string;

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
      const userId = req.user?.id as string;

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

  // GET /api/admin/templates/custom-fields - List custom fields with choices and stats
  async getCustomFields(req: Request, res: Response): Promise<void> {
    try {
      const fields = this.customFieldRepository.findWithStats();
      
      // Get choices for each field
      const fieldsWithChoices = await Promise.all(
        fields.map(async (field) => {
          if (field.fieldType === 'dropdown') {
            const choices = await this.fieldChoiceRepository.findByFieldId(field.id);
            return { ...field, choices };
          }
          return { ...field, choices: [] };
        })
      );

      logger.debug('Admin retrieved custom fields list', { 
        requestedBy: req.user?.id,
        fieldCount: fields.length
      });

      res.json({
        success: true,
        data: fieldsWithChoices,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error retrieving custom fields', { error, requestedBy: req.user?.id });
      throw error;
    }
  }

  // POST /api/admin/templates/custom-fields - Create new custom field
  async createCustomField(req: Request, res: Response): Promise<void> {
    try {
      const { fieldLabel, fieldType, fieldOrder, isActive = true, choices } = req.body;
      const userId = req.user?.id as string;

      // Validate that dropdown fields have choices
      if (fieldType === 'dropdown' && (!choices || choices.length === 0)) {
        throw new ValidationError('Dropdown fields must have at least one choice');
      }

      const field = this.customFieldRepository.createField(
        { fieldLabel, fieldType, fieldOrder, isActive },
        userId
      );

      // Create choices if provided
      let fieldChoices: any[] = [];
      if (fieldType === 'dropdown' && choices) {
        fieldChoices = await this.fieldChoiceRepository.bulkCreateChoices(
          field.id,
          choices.map((choice: any, index: number) => ({
            text: choice.choiceText,
            order: choice.choiceOrder || index
          }))
        );
      }

      logger.info('Admin created new custom field', { 
        createdBy: userId,
        fieldId: field.id,
        fieldLabel: field.fieldLabel,
        fieldType: field.fieldType,
        choicesCount: fieldChoices.length
      });

      res.status(201).json({
        success: true,
        data: { ...field, choices: fieldChoices },
        message: 'Custom field created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating custom field', { error, createdBy: req.user?.id, fieldData: req.body });
      throw error;
    }
  }

  // PUT /api/admin/templates/custom-fields/:id - Update custom field
  async updateCustomField(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const fieldId = parseInt(id, 10) as CustomFieldId;
      const userId = req.user?.id as string;

      if (isNaN(fieldId) || fieldId < 1) {
        throw new ValidationError('Invalid custom field ID');
      }

      const field = await this.customFieldRepository.updateField(fieldId, req.body, userId);

      logger.info('Admin updated custom field', { 
        updatedBy: userId,
        fieldId,
        updates: req.body
      });

      res.json({
        success: true,
        data: field,
        message: 'Custom field updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error updating custom field', { error, updatedBy: req.user?.id, fieldId: req.params.id });
      throw error;
    }
  }

  // DELETE /api/admin/templates/custom-fields/:id - Delete custom field
  async deleteCustomField(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const fieldId = parseInt(id, 10) as CustomFieldId;
      const userId = req.user?.id as string;

      if (isNaN(fieldId) || fieldId < 1) {
        throw new ValidationError('Invalid custom field ID');
      }

      // Delete related choices first
      await this.fieldChoiceRepository.deleteByFieldId(fieldId);
      
      // Delete the field
      await this.customFieldRepository.delete(fieldId, userId);

      logger.info('Admin deleted custom field', { 
        deletedBy: userId,
        fieldId
      });

      res.json({
        success: true,
        message: 'Custom field deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error deleting custom field', { error, deletedBy: req.user?.id, fieldId: req.params.id });
      throw error;
    }
  }

  // PUT /api/admin/templates/custom-fields/reorder - Update field orders
  async reorderCustomFields(req: Request, res: Response): Promise<void> {
    try {
      const { fieldOrders } = req.body;
      const userId = req.user?.id as string;

      await this.customFieldRepository.updateFieldOrders(fieldOrders, userId);

      logger.info('Admin reordered custom fields', { 
        updatedBy: userId,
        fieldCount: fieldOrders.length
      });

      res.json({
        success: true,
        message: 'Custom fields reordered successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error reordering custom fields', { error, updatedBy: req.user?.id });
      throw error;
    }
  }

  // GET /api/admin/templates/custom-fields/:id/choices - Get choices for a custom field
  async getFieldChoices(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const fieldId = parseInt(id, 10) as CustomFieldId;

      if (isNaN(fieldId) || fieldId < 1) {
        throw new ValidationError('Invalid custom field ID');
      }

      const choices = await this.fieldChoiceRepository.findWithStats(fieldId);

      logger.debug('Admin retrieved field choices', { 
        requestedBy: req.user?.id,
        fieldId,
        choiceCount: choices.length
      });

      res.json({
        success: true,
        data: choices,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error retrieving field choices', { error, requestedBy: req.user?.id, fieldId: req.params.id });
      throw error;
    }
  }

  // POST /api/admin/templates/custom-fields/:id/choices - Create new choice for field
  async createFieldChoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const fieldId = parseInt(id, 10) as CustomFieldId;
      const { choiceText, choiceOrder } = req.body;

      if (isNaN(fieldId) || fieldId < 1) {
        throw new ValidationError('Invalid custom field ID');
      }

      const choice = await this.fieldChoiceRepository.createChoice(fieldId, choiceText, choiceOrder);

      logger.info('Admin created new field choice', { 
        createdBy: req.user?.id,
        fieldId,
        choiceId: choice.id,
        choiceText: choice.choiceText
      });

      res.status(201).json({
        success: true,
        data: choice,
        message: 'Field choice created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating field choice', { error, createdBy: req.user?.id, fieldId: req.params.id });
      throw error;
    }
  }

  // PUT /api/admin/templates/custom-fields/:fieldId/choices/:choiceId - Update choice
  async updateFieldChoice(req: Request, res: Response): Promise<void> {
    try {
      const { fieldId, choiceId } = req.params;
      const choiceIdNum = parseInt(choiceId, 10) as FieldChoiceId;
      const { choiceText } = req.body;

      if (isNaN(choiceIdNum) || choiceIdNum < 1) {
        throw new ValidationError('Invalid choice ID');
      }

      const choice = await this.fieldChoiceRepository.updateChoice(choiceIdNum, choiceText);

      logger.info('Admin updated field choice', { 
        updatedBy: req.user?.id,
        fieldId,
        choiceId: choiceIdNum,
        newText: choiceText
      });

      res.json({
        success: true,
        data: choice,
        message: 'Field choice updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error updating field choice', { error, updatedBy: req.user?.id, choiceId: req.params.choiceId });
      throw error;
    }
  }

  // DELETE /api/admin/templates/custom-fields/:fieldId/choices/:choiceId - Delete choice
  async deleteFieldChoice(req: Request, res: Response): Promise<void> {
    try {
      const { fieldId, choiceId } = req.params;
      const choiceIdNum = parseInt(choiceId, 10) as FieldChoiceId;

      if (isNaN(choiceIdNum) || choiceIdNum < 1) {
        throw new ValidationError('Invalid choice ID');
      }

      await this.fieldChoiceRepository.delete(choiceIdNum);

      logger.info('Admin deleted field choice', { 
        deletedBy: req.user?.id,
        fieldId,
        choiceId: choiceIdNum
      });

      res.json({
        success: true,
        message: 'Field choice deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error deleting field choice', { error, deletedBy: req.user?.id, choiceId: req.params.choiceId });
      throw error;
    }
  }

  // PUT /api/admin/templates/custom-fields/:id/choices/reorder - Update choice orders
  async reorderFieldChoices(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const fieldId = parseInt(id, 10) as CustomFieldId;
      const { choiceOrders } = req.body;

      if (isNaN(fieldId) || fieldId < 1) {
        throw new ValidationError('Invalid custom field ID');
      }

      await this.fieldChoiceRepository.updateChoiceOrders(fieldId, choiceOrders);

      logger.info('Admin reordered field choices', { 
        updatedBy: req.user?.id,
        fieldId,
        choiceCount: choiceOrders.length
      });

      res.json({
        success: true,
        message: 'Field choices reordered successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error reordering field choices', { error, updatedBy: req.user?.id, fieldId: req.params.id });
      throw error;
    }
  }

  // ========================================
  // PHASE 6.5: CLIENT-SPECIFIC CUSTOM FIELDS
  // ========================================

  // GET /api/admin/clients/:clientId/fields - Get custom fields for specific client
  async getClientFields(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const clientIdNum = parseInt(clientId, 10) as ClientId;

      if (isNaN(clientIdNum) || clientIdNum < 1) {
        throw new ValidationError('Invalid client ID');
      }

      // First verify client exists
      const client = await this.clientRepository.findById(clientIdNum);
      if (!client) {
        throw new NotFoundError(`Client not found: ${clientIdNum}`);
      }

      // Get client-specific fields (excluding global fields)
      const fields = await this.customFieldRepository.findClientSpecificFields(clientIdNum);

      // Get choices for dropdown fields
      const fieldsWithChoices = await Promise.all(
        fields.map(async (field) => {
          if (field.fieldType === 'dropdown') {
            const choices = await this.fieldChoiceRepository.findByFieldId(field.id);
            return { ...field, choices };
          }
          return { ...field, choices: [] };
        })
      );

      res.json({
        success: true,
        data: {
          client,
          fields: fieldsWithChoices
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching client fields', { error, clientId: req.params.clientId });
      throw error;
    }
  }

  // POST /api/admin/clients/:clientId/fields - Create client-specific custom field
  async createClientField(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const clientIdNum = parseInt(clientId, 10) as ClientId;
      const { fieldLabel, fieldType, fieldOrder, isActive = true, choices } = req.body;

      if (isNaN(clientIdNum) || clientIdNum < 1) {
        throw new ValidationError('Invalid client ID');
      }

      // Verify client exists
      const client = await this.clientRepository.findById(clientIdNum);
      if (!client) {
        throw new NotFoundError(`Client not found: ${clientIdNum}`);
      }

      // Create field data with client association
      const fieldData = {
        clientId: clientIdNum,
        fieldLabel,
        fieldType,
        fieldOrder,
        isActive,
        choices: choices || []
      };

      const field = this.customFieldRepository.createClientField(fieldData, req.user!.id);

      // Create choices if provided and field type is dropdown
      if (fieldType === 'dropdown' && choices && choices.length > 0) {
        for (const choice of choices) {
          await this.fieldChoiceRepository.create({
            fieldId: field.id,
            choiceText: choice.choiceText,
            choiceOrder: choice.choiceOrder
          }, req.user!.id);
        }
      }

      // Fetch the field with choices for response
      const fieldWithChoices = fieldType === 'dropdown'
        ? {
            ...field,
            choices: await this.fieldChoiceRepository.findByFieldId(field.id)
          }
        : { ...field, choices: [] };

      logger.info('Admin created client-specific custom field', { 
        createdBy: req.user?.id,
        clientId: clientIdNum,
        fieldId: field.id,
        fieldLabel
      });

      res.status(201).json({
        success: true,
        data: fieldWithChoices,
        message: 'Client-specific custom field created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error creating client field', { error, createdBy: req.user?.id, clientId: req.params.clientId });
      throw error;
    }
  }

  // PUT /api/admin/clients/:clientId/fields/:fieldId - Update client-specific custom field
  async updateClientField(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, fieldId } = req.params;
      const clientIdNum = parseInt(clientId, 10) as ClientId;
      const fieldIdNum = parseInt(fieldId, 10) as CustomFieldId;
      const updateData = req.body;

      if (isNaN(clientIdNum) || clientIdNum < 1) {
        throw new ValidationError('Invalid client ID');
      }
      if (isNaN(fieldIdNum) || fieldIdNum < 1) {
        throw new ValidationError('Invalid field ID');
      }

      // Verify client exists
      const client = await this.clientRepository.findById(clientIdNum);
      if (!client) {
        throw new NotFoundError(`Client not found: ${clientIdNum}`);
      }

      // Verify field exists and belongs to client
      const existingField = await this.customFieldRepository.findById(fieldIdNum);
      if (!existingField) {
        throw new NotFoundError(`Custom field not found: ${fieldIdNum}`);
      }
      if (existingField.clientId !== clientIdNum) {
        throw new ValidationError(`Field ${fieldIdNum} does not belong to client ${clientIdNum}`);
      }

      const field = await this.customFieldRepository.updateField(fieldIdNum, updateData, req.user!.id);

      logger.info('Admin updated client-specific custom field', { 
        updatedBy: req.user?.id,
        clientId: clientIdNum,
        fieldId: fieldIdNum
      });

      res.json({
        success: true,
        data: field,
        message: 'Client-specific custom field updated successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error updating client field', { error, updatedBy: req.user?.id, clientId: req.params.clientId, fieldId: req.params.fieldId });
      throw error;
    }
  }

  // DELETE /api/admin/clients/:clientId/fields/:fieldId - Delete client-specific custom field
  async deleteClientField(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, fieldId } = req.params;
      const clientIdNum = parseInt(clientId, 10) as ClientId;
      const fieldIdNum = parseInt(fieldId, 10) as CustomFieldId;

      if (isNaN(clientIdNum) || clientIdNum < 1) {
        throw new ValidationError('Invalid client ID');
      }
      if (isNaN(fieldIdNum) || fieldIdNum < 1) {
        throw new ValidationError('Invalid field ID');
      }

      // Verify field exists and belongs to client
      const existingField = await this.customFieldRepository.findById(fieldIdNum);
      if (!existingField) {
        throw new NotFoundError(`Custom field not found: ${fieldIdNum}`);
      }
      if (existingField.clientId !== clientIdNum) {
        throw new ValidationError(`Field ${fieldIdNum} does not belong to client ${clientIdNum}`);
      }

      await this.customFieldRepository.delete(fieldIdNum);

      logger.info('Admin deleted client-specific custom field', { 
        deletedBy: req.user?.id,
        clientId: clientIdNum,
        fieldId: fieldIdNum,
        fieldLabel: existingField.fieldLabel
      });

      res.json({
        success: true,
        message: 'Client-specific custom field deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error deleting client field', { error, deletedBy: req.user?.id, clientId: req.params.clientId, fieldId: req.params.fieldId });
      throw error;
    }
  }

  // GET /api/form-config/:clientId - Get form configuration for specific client (used by service log form)
  async getFormConfig(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const clientIdNum = parseInt(clientId, 10) as ClientId;

      if (isNaN(clientIdNum) || clientIdNum < 1) {
        throw new ValidationError('Invalid client ID');
      }

      // Get all fields for this client (client-specific + global)
      const fields = await this.customFieldRepository.findByClientId(clientIdNum);

      // Get choices for dropdown fields
      const fieldsWithChoices = await Promise.all(
        fields.map(async (field) => {
          if (field.fieldType === 'dropdown') {
            const choices = await this.fieldChoiceRepository.findByFieldId(field.id);
            return { ...field, choices };
          }
          return { ...field, choices: [] };
        })
      );

      res.json({
        success: true,
        data: {
          clientId: clientIdNum,
          fields: fieldsWithChoices
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error fetching form config for client', { error, clientId: req.params.clientId });
      throw error;
    }
  }
}