import * as cron from 'node-cron';
import EmailRecipient from '../models/EmailRecipient';
import Campaign from '../models/Campaign';
import { EmailService } from './email.service';

export class SchedulerService {
  private static cronJob: cron.ScheduledTask | null = null;

  /**
   * Start the email scheduler
   * Runs every minute to check for emails that need to be sent
   */
  static start(): void {
    if (this.cronJob) {
      console.log('⚠️  Scheduler is already running');
      return;
    }

    // Run every minute: '* * * * *'
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.checkAndSendEmails();
    });

    console.log('✅ Email scheduler started (runs every minute)');
  }

  /**
   * Stop the scheduler
   */
  static stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('⏹️  Email scheduler stopped');
    }
  }

  /**
   * Check for emails to send and process them
   */
  private static async checkAndSendEmails(): Promise<void> {
    try {
      const now = new Date();

      // Process max 50 emails per minute to avoid overwhelming the system
      for (let i = 0; i < 50; i++) {
        // Use atomic findOneAndUpdate to claim a recipient
        // This prevents race conditions when multiple scheduler instances run
        // Process ALL pending emails where the trigger time has passed (including past-due emails)
        const recipient = await EmailRecipient.findOneAndUpdate(
          {
            status: 'pending',
            triggerDate: {
              $lte: now // Trigger time must have passed (includes past-due emails)
            }
          },
          {
            $set: { status: 'processing' }
          },
          {
            new: false, // Return the document before update
            sort: { triggerDate: 1 } // Process oldest first
          }
        );

        // No more recipients to process
        if (!recipient) {
          if (i === 0) {
            // No emails found at all, exit silently
            return;
          } else {
            // Processed some emails, now done
            console.log(`📧 Processed ${i} emails`);
            break;
          }
        }

        if (i === 0) {
          console.log(`📧 Found emails to send...`);
        }

        // Send the email
        const result = await EmailService.sendEmail(recipient);

        if (result.success) {
          // Mark as sent
          await EmailRecipient.findByIdAndUpdate(
            recipient._id,
            {
              status: 'sent',
              sentAt: new Date()
            },
            { new: true }
          );
        } else {
          // Mark as failed
          await EmailRecipient.findByIdAndUpdate(
            recipient._id,
            {
              status: 'failed',
              error: result.error
            },
            { new: true }
          );
        }
      }

      // Update campaign statuses
      await this.updateCampaignStatuses();

    } catch (error) {
      console.error('❌ Error in scheduler:', error);
    }
  }

  /**
   * Update campaign statuses based on their recipients
   * Recalculates counts from actual recipient statuses to prevent duplicates
   */
  private static async updateCampaignStatuses(): Promise<void> {
    try {
      // Find campaigns that are scheduled or in_progress
      const campaigns = await Campaign.find({
        status: { $in: ['scheduled', 'in_progress', 'draft'] }
      });

      for (const campaign of campaigns) {
        // Recalculate counts from actual recipients to ensure accuracy
        const sentCount = await EmailRecipient.countDocuments({
          campaignId: campaign._id,
          status: 'sent'
        });

        const failedCount = await EmailRecipient.countDocuments({
          campaignId: campaign._id,
          status: 'failed'
        });

        const totalRecipients = await EmailRecipient.countDocuments({
          campaignId: campaign._id
        });

        // Update counts in campaign
        campaign.sentCount = sentCount;
        campaign.failedCount = failedCount;
        campaign.totalRecipients = totalRecipients;

        const processedCount = sentCount + failedCount;

        if (processedCount >= totalRecipients && totalRecipients > 0) {
          // All emails processed, mark as completed
          campaign.status = 'completed';
          console.log(`✅ Campaign "${campaign.name}" completed (${sentCount} sent, ${failedCount} failed)`);
        } else if (processedCount > 0 && processedCount < totalRecipients) {
          // Some emails sent, mark as in_progress
          if (campaign.status !== 'in_progress') {
            campaign.status = 'in_progress';
          }
        }

        await campaign.save();
      }
    } catch (error) {
      console.error('❌ Error updating campaign statuses:', error);
    }
  }

  /**
   * Manually trigger email check (useful for testing)
   */
  static async runManually(): Promise<void> {
    console.log('🔄 Running scheduler manually...');
    await this.checkAndSendEmails();
  }
}
