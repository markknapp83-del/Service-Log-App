// Reports routes for data export following Express.js documentation patterns
import { Router } from 'express';
import { ReportsController } from '../controllers/ReportsController';
import { authMiddleware } from '../middleware/auth';
import { validateQuery } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const reportsController = new ReportsController();

// Validation schemas following Zod documentation patterns
const exportQuerySchema = z.object({
  format: z.enum(['csv', 'excel']).default('csv'),
  dateFrom: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  dateTo: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(), 
  clientId: z.string().optional(),
  activityId: z.string().optional(),
  userId: z.string().optional(), // Admin-only filter
  isDraft: z.enum(['true', 'false']).optional(),
});

const summaryQuerySchema = z.object({
  dateFrom: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  dateTo: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  clientId: z.string().optional(),
  activityId: z.string().optional(),
  userId: z.string().optional(), // Admin-only filter
});

// Apply authentication to all routes
router.use(authMiddleware);

// GET /api/reports/export - Export service logs with enhanced data
router.get(
  '/export',
  validateQuery(exportQuerySchema),
  reportsController.exportServiceLogs
);

// GET /api/reports/summary - Get summary statistics and analytics
router.get(
  '/summary',
  validateQuery(summaryQuerySchema),
  reportsController.getSummaryReport
);

export default router;