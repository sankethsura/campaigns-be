import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { validateCoupon } from '../controllers/coupon.controller';

const router = Router();

// Validate coupon (requires authentication)
router.post('/validate', verifyToken, validateCoupon);

export default router;
