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

export default router;