import { Router } from 'express';
import { getProfile, checkEmailPermissions, getPlanUsage } from '../controllers/user.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/profile', verifyToken, getProfile);
router.get('/email-permissions', verifyToken, checkEmailPermissions);
router.get('/plan-usage', verifyToken, getPlanUsage);

export default router;
