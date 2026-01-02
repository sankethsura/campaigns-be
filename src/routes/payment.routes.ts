import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import {
  createOrder,
  verifyPayment,
  activateFreePlan
} from '../controllers/payment.controller';

const router = Router();

// All routes require authentication
router.post('/create-order', verifyToken, createOrder);
router.post('/verify', verifyToken, verifyPayment);
router.post('/activate-free', verifyToken, activateFreePlan);

export default router;
