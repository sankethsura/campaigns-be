import { Router, Request, Response } from 'express';
import passport from 'passport';
import { googleCallback, logout } from '../controllers/auth.controller';

const router = Router();

const isGoogleOAuthConfigured =
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET

if (isGoogleOAuthConfigured) {
  router.get(
    '/google',
    passport.authenticate('google', {
      scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/gmail.send'
      ],
      accessType: 'offline',
      prompt: 'consent'
    })
  );

  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    googleCallback
  );
} else {
  router.get('/google', (req: Request, res: Response) => {
    res.status(503).json({
      error: 'Google OAuth is not configured',
      message: 'Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file'
    });
  });

  router.get('/google/callback', (req: Request, res: Response) => {
    res.status(503).json({
      error: 'Google OAuth is not configured',
      message: 'Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file'
    });
  });
}

router.post('/logout', logout);

export default router;
