import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import User from '../models/User';

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackURL = process.env.GOOGLE_CALLBACK_URL;

if (!clientID || !clientSecret || clientID === 'your-google-client-id.apps.googleusercontent.com') {
  console.warn('⚠️  WARNING: Google OAuth credentials are not configured!');
  console.warn('⚠️  Please update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file');
  console.warn('⚠️  OAuth routes will not work until credentials are configured');
} else {
  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: callbackURL!,
        scope: [
          'profile',
          'email',
          'https://www.googleapis.com/auth/gmail.send'
        ]
      } as any,
      async (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
        try {
          console.log('🔐 OAuth Callback - Email:', profile.emails?.[0].value);
          console.log('🔐 Has accessToken:', !!accessToken);
          console.log('🔐 Has refreshToken:', !!refreshToken);

          if (!refreshToken) {
            console.warn('⚠️  WARNING: No refresh token received! User needs to revoke access and re-authenticate.');
            console.warn('⚠️  Go to: https://myaccount.google.com/permissions');
          }

          let user = await User.findOne({ googleId: profile.id });

          // Calculate token expiry (usually 1 hour from now)
          const tokenExpiry = new Date();
          tokenExpiry.setHours(tokenExpiry.getHours() + 1);

          if (!user) {
            user = await User.create({
              googleId: profile.id,
              email: profile.emails?.[0].value,
              name: profile.displayName,
              picture: profile.photos?.[0].value,
              accessToken,
              refreshToken: refreshToken || undefined,
              accessTokenExpiry: tokenExpiry,
              createdAt: new Date(),
              lastLogin: new Date()
            });
            console.log('✅ New user created:', user.email);
            if (refreshToken) {
              console.log('✅ Refresh token stored');
            }
          } else {
            user.lastLogin = new Date();
            user.accessToken = accessToken;
            user.accessTokenExpiry = tokenExpiry;

            // Only update refresh token if we received a new one
            if (refreshToken) {
              user.refreshToken = refreshToken;
              console.log('✅ Refresh token updated');
            } else {
              console.log('⚠️  No refresh token received, keeping old token');
            }

            await user.save();
            console.log('✅ User logged in:', user.email);
          }

          done(null, user);
        } catch (error) {
          console.error('❌ Passport authentication error:', error);
          done(error as Error, undefined);
        }
      }
    )
  );
  console.log('✅ Google OAuth strategy configured successfully');
}

export default passport;
