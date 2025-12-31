import { Router } from 'express';
import { getProfile, checkEmailPermissions } from '../controllers/user.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/profile', verifyToken, getProfile);
router.get('/email-permissions', verifyToken, checkEmailPermissions);

export default router;
