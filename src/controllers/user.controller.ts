import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User';

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('-__v -refreshToken -accessToken -accessTokenExpiry');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

export const checkEmailPermissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const hasEmailPermission = !!user.refreshToken;

    res.json({
      hasEmailPermission,
      message: hasEmailPermission
        ? 'Email permissions are configured'
        : 'You need to re-authenticate to grant email sending permissions'
    });
  } catch (error) {
    console.error('Error checking email permissions:', error);
    res.status(500).json({ error: 'Failed to check email permissions' });
  }
};
