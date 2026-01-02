import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import {
  getPlans,
  submitSubscriptionRequest,
  getMySubscriptionRequests,
  getMyPlanInfo
} from '../controllers/pricing.controller';

const router = Router();

// Public route to get all plans
router.get('/plans', getPlans);

// Protected routes (require authentication)
router.post('/subscribe', verifyToken, submitSubscriptionRequest);
router.get('/my-requests', verifyToken, getMySubscriptionRequests);
router.get('/my-plan', verifyToken, getMyPlanInfo);

export default router;
