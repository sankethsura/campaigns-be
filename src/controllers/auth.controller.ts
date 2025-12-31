import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { IUser } from '../models/User';

export const googleCallback = (req: Request, res: Response): void => {
  try {
    const user = req.user as IUser;

    if (!user) {
      res.redirect(`${process.env.FRONTEND_URL}/login?error=authentication_failed`);
      return;
    }

    const secret = process.env.JWT_SECRET || 'default-secret';

    const token = jwt.sign(
      { userId: user._id.toString() },
      secret,
      { expiresIn: '7d' }
    );

    console.log('✅ JWT token generated for user:', user.email);

    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('❌ Error in Google callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
  }
};

export const logout = (req: Request, res: Response): void => {
  res.json({ message: 'Logged out successfully' });
};
