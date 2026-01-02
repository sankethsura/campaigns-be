import { google } from 'googleapis';
import { IEmailRecipient } from '../models/EmailRecipient';
import User from '../models/User';

export class EmailService {
  /**
   * Initialize the email service (no longer needed with Gmail API)
   */
  static initialize(): void {
    console.log('✅ Email service initialized (using Gmail API with OAuth)');
  }

  /**
   * Get a fresh access token using the refresh token
   */
  private static async getAccessToken(userId: string): Promise<string> {
    const user = await User.findById(userId);
    if (!user || !user.refreshToken) {
      throw new Error('User not found or no refresh token available');
    }

    // Check if current access token is still valid
    if (user.accessToken && user.accessTokenExpiry && user.accessTokenExpiry > new Date()) {
      return user.accessToken;
    }

    // Refresh the access token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );

    oauth2Client.setCredentials({
      refresh_token: user.refreshToken
    });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update user with new access token
      user.accessToken = credentials.access_token || undefined;
      user.accessTokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : undefined;
      await user.save();

      return credentials.access_token!;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Send email to a single recipient using Gmail API
   */
  static async sendEmail(recipient: IEmailRecipient): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the campaign to find the user who created it
      const Campaign = (await import('../models/Campaign')).default;
      const campaign = await Campaign.findById(recipient.campaignId);

      if (!campaign) {
        return {
          success: false,
          error: 'Campaign not found'
        };
      }

      // Get fresh access token for the user
      const accessToken = await this.getAccessToken(campaign.userId.toString());

      // Set up OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALLBACK_URL
      );

      oauth2Client.setCredentials({
        access_token: accessToken
      });

      // Get user email
      const user = await User.findById(campaign.userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Create email message
      const subject = 'Your Scheduled Email';
      const message = [
        `From: ${user.name} <${user.email}>`,
        `To: ${recipient.email}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        `<div style="font-family: Arial, sans-serif; padding: 20px;">`,
        `  <p>${recipient.message.replace(/\n/g, '<br>')}</p>`,
        `  <br>`,
        `  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">`,
        `  <p style="color: #666; font-size: 12px;">`,
        `    This email was sent via Email Sender Platform`,
        `  </p>`,
        `</div>`
      ].join('\n');

      // Encode message in base64url
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send email
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      console.log(`✅ Email sent successfully to ${recipient.email} from ${user.email}`);

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to send email to ${recipient.email}:`, errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Send admin notification email
   */
  static async sendAdminNotification(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // For now, just log the notification
      // In production, you would send an actual email to admin
      console.log('📧 Admin Notification:');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log('---');

      // You can implement actual email sending here using nodemailer or another service
      // For demo purposes, we'll just log it

      return {
        success: true
      };
    } catch (error) {
      console.error('Failed to send admin notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test email configuration (no longer needed with OAuth)
   */
  static async testConnection(): Promise<boolean> {
    console.log('✅ Email service uses Gmail API with OAuth (no connection test needed)');
    return true;
  }
}
