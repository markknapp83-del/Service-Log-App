// Service Log Routes following Express.js documentation patterns
import { Router } from 'express';
import { ServiceLogController } from '../controllers/ServiceLogController';
import { authMiddleware } from '../middleware/auth';
import { validateRequest, validateQuery } from '../middleware/validation';
import { z } from 'zod';

const router = Router();
const serviceLogController = new ServiceLogController();

// Validation schemas following Zod documentation patterns - Phase 3.5 appointment-based structure
const patientEntrySchema = z.object({
  appointmentType: z.enum(['new', 'followup', 'dna']),
  outcomeId: z.union([z.string(), z.number()]).transform(String), // Accept both string and number, convert to string
});

const createServiceLogSchema = z.object({
  clientId: z.union([z.string(), z.number()]).transform(String), // Accept both string and number, convert to string
  activityId: z.union([z.string(), z.number()]).transform(String), // Accept both string and number, convert to string
  serviceDate: z.string().min(1, 'Service date is required'),
  patientCount: z.number().int().min(1).max(100),
  patientEntries: z.array(patientEntrySchema).min(1),
  isDraft: z.boolean().optional().default(false),
}).refine((data) => {
  // Validate patient entries match patient count (each entry = 1 appointment)
  return data.patientEntries.length === data.patientCount;
}, {
  message: 'Patient entries must match total patient count',
  path: ['patientEntries'],
});

const updateServiceLogSchema = createServiceLogSchema.partial();

const queryParamsSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  isDraft: z.enum(['true', 'false']).optional(),
  clientId: z.string().optional(),
  activityId: z.string().optional(),
  dateFrom: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  dateTo: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  userId: z.string().optional(), // Admin-only filter
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid service log ID'),
});

// Apply authentication to all routes
router.use(authMiddleware);

// GET /api/service-logs/options - Get form dropdown options
router.get(
  '/options',
  serviceLogController.getFormOptions
);

// GET /api/service-logs - List service logs with filtering
router.get(
  '/',
  validateQuery(queryParamsSchema),
  serviceLogController.getServiceLogs
);

// GET /api/service-logs/:id - Get single service log
router.get(
  '/:id',
  validateRequest(idParamSchema, 'params'),
  serviceLogController.getServiceLog
);

// POST /api/service-logs - Create new service log
router.post(
  '/',
  validateRequest(createServiceLogSchema),
  serviceLogController.createServiceLog
);

// PUT /api/service-logs/:id - Update service log
router.put(
  '/:id',
  validateRequest(idParamSchema, 'params'),
  validateRequest(updateServiceLogSchema),
  serviceLogController.updateServiceLog
);

// DELETE /api/service-logs/:id - Delete service log
router.delete(
  '/:id',
  validateRequest(idParamSchema, 'params'),
  serviceLogController.deleteServiceLog
);

export default router;