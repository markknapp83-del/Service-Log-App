// Admin routes following Express.js documentation patterns
// Phase 4: Admin Portal - User Management routes as specified in plan.md
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '@/middleware/validation';
import { authMiddleware, requireRole } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { AdminController } from '@/controllers/AdminController';

const router = Router();
const adminController = new AdminController();

// Apply authentication middleware to all admin routes
router.use(authMiddleware);

// Apply admin role requirement to all admin routes
router.use(requireRole(['admin']));

// GET /api/admin/users - List users with pagination and filtering
router.get('/users',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isLength({ min: 2, max: 100 }).withMessage('Search term must be between 2 and 100 characters'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.getUsers(req, res);
  })
);

// GET /api/admin/users/:id - Get single user details
router.get('/users/:id',
  [
    param('id').isUUID().withMessage('Invalid user ID format'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.getUser(req, res);
  })
);

// POST /api/admin/users - Create new user
router.post('/users',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('firstName')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    body('role')
      .optional()
      .isIn(['admin', 'candidate'])
      .withMessage('Role must be either "admin" or "candidate"'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.createUser(req, res);
  })
);

// PUT /api/admin/users/:id - Update user
router.put('/users/:id',
  [
    param('id').isUUID().withMessage('Invalid user ID format'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    body('role')
      .optional()
      .isIn(['admin', 'candidate'])
      .withMessage('Role must be either "admin" or "candidate"'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    // Prevent password updates through this endpoint
    body('password').not().exists().withMessage('Use the password reset endpoint to update passwords'),
    body('passwordHash').not().exists().withMessage('Direct password hash updates are not allowed'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.updateUser(req, res);
  })
);

// DELETE /api/admin/users/:id - Soft delete user (deactivate)
router.delete('/users/:id',
  [
    param('id').isUUID().withMessage('Invalid user ID format'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.deleteUser(req, res);
  })
);

// POST /api/admin/users/:id/reset-password - Reset user password
router.post('/users/:id/reset-password',
  [
    param('id').isUUID().withMessage('Invalid user ID format'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.resetPassword(req, res);
  })
);

// ========================================
// PHASE 5: TEMPLATE MANAGEMENT ROUTES
// ========================================

// GET /api/admin/templates/clients - List clients with stats
router.get('/templates/clients',
  asyncHandler(async (req, res) => {
    await adminController.getClients(req, res);
  })
);

// POST /api/admin/templates/clients - Create new client
router.post('/templates/clients',
  [
    body('name')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Client name must be between 2 and 100 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.createClient(req, res);
  })
);

// PUT /api/admin/templates/clients/:id - Update client
router.put('/templates/clients/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid client ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Client name must be between 2 and 100 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.updateClient(req, res);
  })
);

// DELETE /api/admin/templates/clients/:id - Delete client
router.delete('/templates/clients/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid client ID'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.deleteClient(req, res);
  })
);

// GET /api/admin/templates/activities - List activities with stats
router.get('/templates/activities',
  asyncHandler(async (req, res) => {
    await adminController.getActivities(req, res);
  })
);

// POST /api/admin/templates/activities - Create new activity
router.post('/templates/activities',
  [
    body('name')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Activity name must be between 2 and 100 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.createActivity(req, res);
  })
);

// PUT /api/admin/templates/activities/:id - Update activity
router.put('/templates/activities/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid activity ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Activity name must be between 2 and 100 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.updateActivity(req, res);
  })
);

// DELETE /api/admin/templates/activities/:id - Delete activity
router.delete('/templates/activities/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid activity ID'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.deleteActivity(req, res);
  })
);

// GET /api/admin/templates/outcomes - List outcomes with stats
router.get('/templates/outcomes',
  asyncHandler(async (req, res) => {
    await adminController.getOutcomes(req, res);
  })
);

// POST /api/admin/templates/outcomes - Create new outcome
router.post('/templates/outcomes',
  [
    body('name')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Outcome name must be between 2 and 100 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.createOutcome(req, res);
  })
);

// PUT /api/admin/templates/outcomes/:id - Update outcome
router.put('/templates/outcomes/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid outcome ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Outcome name must be between 2 and 100 characters'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.updateOutcome(req, res);
  })
);

// DELETE /api/admin/templates/outcomes/:id - Delete outcome
router.delete('/templates/outcomes/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid outcome ID'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.deleteOutcome(req, res);
  })
);

// GET /api/admin/templates/custom-fields - List custom fields with choices and stats
router.get('/templates/custom-fields',
  asyncHandler(async (req, res) => {
    await adminController.getCustomFields(req, res);
  })
);

// POST /api/admin/templates/custom-fields - Create new custom field
router.post('/templates/custom-fields',
  [
    body('fieldLabel')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Field label must be between 2 and 100 characters'),
    body('fieldType')
      .isIn(['dropdown', 'text', 'number', 'checkbox'])
      .withMessage('Field type must be dropdown, text, number, or checkbox'),
    body('fieldOrder')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Field order must be a non-negative integer'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    body('choices')
      .optional()
      .isArray({ min: 1 })
      .withMessage('Choices must be a non-empty array for dropdown fields'),
    body('choices.*.choiceText')
      .if(body('choices').exists())
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Choice text must be between 1 and 100 characters'),
    body('choices.*.choiceOrder')
      .if(body('choices').exists())
      .isInt({ min: 0 })
      .withMessage('Choice order must be a non-negative integer'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.createCustomField(req, res);
  })
);

// PUT /api/admin/templates/custom-fields/:id - Update custom field
router.put('/templates/custom-fields/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid custom field ID'),
    body('fieldLabel')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Field label must be between 2 and 100 characters'),
    body('fieldType')
      .optional()
      .isIn(['dropdown', 'text', 'number', 'checkbox'])
      .withMessage('Field type must be dropdown, text, number, or checkbox'),
    body('fieldOrder')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Field order must be a non-negative integer'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.updateCustomField(req, res);
  })
);

// DELETE /api/admin/templates/custom-fields/:id - Delete custom field
router.delete('/templates/custom-fields/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid custom field ID'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.deleteCustomField(req, res);
  })
);

// PUT /api/admin/templates/custom-fields/reorder - Update field orders
router.put('/templates/custom-fields/reorder',
  [
    body('fieldOrders')
      .isArray({ min: 1 })
      .withMessage('fieldOrders must be a non-empty array'),
    body('fieldOrders.*.id')
      .isInt({ min: 1 })
      .withMessage('Field ID must be a positive integer'),
    body('fieldOrders.*.order')
      .isInt({ min: 0 })
      .withMessage('Order must be a non-negative integer'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.reorderCustomFields(req, res);
  })
);

// GET /api/admin/templates/custom-fields/:id/choices - Get choices for a custom field
router.get('/templates/custom-fields/:id/choices',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid custom field ID'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.getFieldChoices(req, res);
  })
);

// POST /api/admin/templates/custom-fields/:id/choices - Create new choice for field
router.post('/templates/custom-fields/:id/choices',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid custom field ID'),
    body('choiceText')
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Choice text must be between 1 and 100 characters'),
    body('choiceOrder')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Choice order must be a non-negative integer'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.createFieldChoice(req, res);
  })
);

// PUT /api/admin/templates/custom-fields/:fieldId/choices/:choiceId - Update choice
router.put('/templates/custom-fields/:fieldId/choices/:choiceId',
  [
    param('fieldId').isInt({ min: 1 }).withMessage('Invalid custom field ID'),
    param('choiceId').isInt({ min: 1 }).withMessage('Invalid choice ID'),
    body('choiceText')
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Choice text must be between 1 and 100 characters'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.updateFieldChoice(req, res);
  })
);

// DELETE /api/admin/templates/custom-fields/:fieldId/choices/:choiceId - Delete choice
router.delete('/templates/custom-fields/:fieldId/choices/:choiceId',
  [
    param('fieldId').isInt({ min: 1 }).withMessage('Invalid custom field ID'),
    param('choiceId').isInt({ min: 1 }).withMessage('Invalid choice ID'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.deleteFieldChoice(req, res);
  })
);

// PUT /api/admin/templates/custom-fields/:id/choices/reorder - Update choice orders
router.put('/templates/custom-fields/:id/choices/reorder',
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid custom field ID'),
    body('choiceOrders')
      .isArray({ min: 1 })
      .withMessage('choiceOrders must be a non-empty array'),
    body('choiceOrders.*.id')
      .isInt({ min: 1 })
      .withMessage('Choice ID must be a positive integer'),
    body('choiceOrders.*.order')
      .isInt({ min: 0 })
      .withMessage('Order must be a non-negative integer'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.reorderFieldChoices(req, res);
  })
);

// ========================================
// PHASE 6.5: CLIENT-SPECIFIC CUSTOM FIELDS
// ========================================

// GET /api/admin/clients/:clientId/fields - Get custom fields for specific client
router.get('/clients/:clientId/fields',
  [
    param('clientId').isInt({ min: 1 }).withMessage('Invalid client ID'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.getClientFields(req, res);
  })
);

// POST /api/admin/clients/:clientId/fields - Create client-specific custom field
router.post('/clients/:clientId/fields',
  [
    param('clientId').isInt({ min: 1 }).withMessage('Invalid client ID'),
    body('fieldLabel')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Field label must be between 2 and 100 characters'),
    body('fieldType')
      .isIn(['dropdown', 'text', 'number', 'checkbox'])
      .withMessage('Field type must be dropdown, text, number, or checkbox'),
    body('fieldOrder')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Field order must be a non-negative integer'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    body('choices')
      .optional()
      .isArray({ min: 1 })
      .withMessage('Choices must be a non-empty array for dropdown fields'),
    body('choices.*.choiceText')
      .if(body('choices').exists())
      .notEmpty()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Choice text must be between 1 and 100 characters'),
    body('choices.*.choiceOrder')
      .if(body('choices').exists())
      .isInt({ min: 0 })
      .withMessage('Choice order must be a non-negative integer'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.createClientField(req, res);
  })
);

// PUT /api/admin/clients/:clientId/fields/:fieldId - Update client-specific custom field
router.put('/clients/:clientId/fields/:fieldId',
  [
    param('clientId').isInt({ min: 1 }).withMessage('Invalid client ID'),
    param('fieldId').isInt({ min: 1 }).withMessage('Invalid field ID'),
    body('fieldLabel')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Field label must be between 2 and 100 characters'),
    body('fieldType')
      .optional()
      .isIn(['dropdown', 'text', 'number', 'checkbox'])
      .withMessage('Field type must be dropdown, text, number, or checkbox'),
    body('fieldOrder')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Field order must be a non-negative integer'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean value'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.updateClientField(req, res);
  })
);

// DELETE /api/admin/clients/:clientId/fields/:fieldId - Delete client-specific custom field
router.delete('/clients/:clientId/fields/:fieldId',
  [
    param('clientId').isInt({ min: 1 }).withMessage('Invalid client ID'),
    param('fieldId').isInt({ min: 1 }).withMessage('Invalid field ID'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.deleteClientField(req, res);
  })
);

// GET /api/form-config/:clientId - Get form configuration for specific client (used by service log form)
router.get('/form-config/:clientId',
  [
    param('clientId').isInt({ min: 1 }).withMessage('Invalid client ID'),
    validate
  ],
  asyncHandler(async (req, res) => {
    await adminController.getFormConfig(req, res);
  })
);

export default router;