// Simple service log routes for demonstration
import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/service-logs/options - Get form dropdown options
router.get('/options', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      clients: [
        { id: '1', name: 'Downtown Clinic', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '2', name: 'Community Health Center', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '3', name: 'Regional Hospital', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ],
      activities: [
        { id: '1', name: 'General Consultation', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '2', name: 'Physiotherapy', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '3', name: 'Mental Health Counseling', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ],
      outcomes: [
        { id: '1', name: 'Treatment Completed', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '2', name: 'Referred to Specialist', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '3', name: 'Follow-up Required', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// POST /api/service-logs - Create new service log
router.post('/', (req: Request, res: Response) => {
  console.log('Service log submission:', JSON.stringify(req.body, null, 2));
  res.json({
    success: true,
    data: {
      id: 'service-log-' + Math.random().toString(36).substr(2, 9),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
});

export default router;