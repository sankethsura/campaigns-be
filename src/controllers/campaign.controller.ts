import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Campaign from '../models/Campaign';
import EmailRecipient from '../models/EmailRecipient';
import { ExcelService } from '../services/excel.service';
import fs from 'fs';

/**
 * Recalculate campaign counts from actual recipient statuses
 * This ensures counts always match the actual EmailRecipient collection
 */
export async function recalculateCampaignCounts(campaignId: string): Promise<void> {
  const sentCount = await EmailRecipient.countDocuments({
    campaignId,
    status: 'sent',
    isDeleted: false
  });

  const failedCount = await EmailRecipient.countDocuments({
    campaignId,
    status: 'failed',
    isDeleted: false
  });

  const totalRecipients = await EmailRecipient.countDocuments({
    campaignId,
    isDeleted: false
  });

  await Campaign.findByIdAndUpdate(campaignId, {
    sentCount,
    failedCount,
    totalRecipients
  });

  console.log(`📊 Recalculated counts for campaign ${campaignId}: ${sentCount} sent, ${failedCount} failed, ${totalRecipients} total`);
}

export const createCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Campaign name is required' });
      return;
    }

    const campaign = await Campaign.create({
      userId: req.userId,
      name,
      description: description || ''
    });

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
};

export const uploadExcel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: campaignId } = req.params;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Verify campaign belongs to user
    const campaign = await Campaign.findOne({ _id: campaignId, userId: req.userId, isDeleted: false });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Parse Excel file
    const parsed = ExcelService.parseExcelFile(req.file.path);

    // Delete uploaded file after parsing
    fs.unlinkSync(req.file.path);

    // Check plan limits before importing
    const User = (await import('../models/User')).default;
    const Plan = (await import('../models/Plan')).default;

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const plan = await Plan.findOne({ name: user.currentPlan });
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    // Check if plan has email limit (-1 means unlimited for pro plan)
    if (plan.emailLimit !== -1) {
      // Count all recipients created by user this month (across all campaigns)
      const userCampaigns = await Campaign.find({ userId: req.userId, isDeleted: false });
      const campaignIds = userCampaigns.map(c => c._id);

      // Get start of current billing period
      const currentPeriodStart = user.planResetDate
        ? new Date(user.planResetDate.getFullYear(), user.planResetDate.getMonth() - 1, 1)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const recipientsThisMonth = await EmailRecipient.countDocuments({
        campaignId: { $in: campaignIds },
        isDeleted: false,
        createdAt: { $gte: currentPeriodStart }
      });

      const newRecipientsCount = parsed.data.length;
      const totalAfterImport = recipientsThisMonth + newRecipientsCount;

      if (totalAfterImport > plan.emailLimit) {
        res.status(403).json({
          error: `Plan limit would be exceeded. Your ${plan.displayName} plan allows ${plan.emailLimit} emails per month. You have ${recipientsThisMonth} scheduled. Importing ${newRecipientsCount} more would exceed your limit by ${totalAfterImport - plan.emailLimit}. Please upgrade your plan.`,
          planLimit: plan.emailLimit,
          currentCount: recipientsThisMonth,
          attemptedImport: newRecipientsCount,
          remaining: plan.emailLimit - recipientsThisMonth
        });
        return;
      }
    }

    // Save valid recipients to database
    const recipients = parsed.data.map(row => ({
      campaignId: campaign._id,
      email: row.email,
      message: row.message,
      triggerDate: new Date(row.triggerDate),
      status: 'pending' as const
    }));

    if (recipients.length > 0) {
      await EmailRecipient.insertMany(recipients);

      // Recalculate campaign counts
      await recalculateCampaignCounts(campaign._id.toString());

      // Update campaign status
      if (campaign.status === 'draft') {
        campaign.status = 'scheduled';
        await campaign.save();
      }
    }

    res.json({
      success: true,
      message: `Successfully imported ${recipients.length} recipients`,
      data: {
        validRecipients: parsed.data,
        errors: parsed.errors
      }
    });

  } catch (error) {
    console.error('Error uploading Excel:', error);

    // Clean up file if error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: 'Failed to upload and process Excel file' });
  }
};

export const getCampaigns = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const campaigns = await Campaign.find({ userId: req.userId, isDeleted: false }).sort({ createdAt: -1 });
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};

export const getCampaignById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findOne({ _id: id, userId: req.userId, isDeleted: false });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
};

export const getCampaignRecipients = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { campaignId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Verify campaign belongs to user
    const campaign = await Campaign.findOne({ _id: campaignId, userId: req.userId, isDeleted: false });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalRecipients = await EmailRecipient.countDocuments({ campaignId, isDeleted: false });

    // Get paginated recipients (sorted newest first, older emails below)
    const recipients = await EmailRecipient.find({ campaignId, isDeleted: false })
      .sort({ triggerDate: -1 })
      .skip(skip)
      .limit(limit);

    // Calculate total pages
    const totalPages = Math.ceil(totalRecipients / limit);

    res.json({
      recipients,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecipients,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    });
  } catch (error) {
    console.error('Error fetching recipients:', error);
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
};

export const updateRecipient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { campaignId, recipientId } = req.params;
    const { email, message, triggerDate } = req.body;

    // Verify campaign belongs to user
    const campaign = await Campaign.findOne({ _id: campaignId, userId: req.userId, isDeleted: false });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const recipient = await EmailRecipient.findOne({ _id: recipientId, campaignId, isDeleted: false });
    if (!recipient) {
      res.status(404).json({ error: 'Recipient not found' });
      return;
    }

    // Update fields
    if (email) recipient.email = email;
    if (message) recipient.message = message;
    if (triggerDate) recipient.triggerDate = new Date(triggerDate);

    await recipient.save();
    res.json(recipient);

  } catch (error) {
    console.error('Error updating recipient:', error);
    res.status(500).json({ error: 'Failed to update recipient' });
  }
};

export const deleteRecipient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { campaignId, recipientId } = req.params;

    // Verify campaign belongs to user
    const campaign = await Campaign.findOne({ _id: campaignId, userId: req.userId, isDeleted: false });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const recipient = await EmailRecipient.findOne({ _id: recipientId, campaignId, isDeleted: false });
    if (!recipient) {
      res.status(404).json({ error: 'Recipient not found' });
      return;
    }

    // Soft delete recipient
    recipient.isDeleted = true;
    recipient.deletedAt = new Date();
    await recipient.save();

    // Recalculate campaign counts
    await recalculateCampaignCounts(campaignId);

    res.json({ message: 'Recipient deleted successfully' });

  } catch (error) {
    console.error('Error deleting recipient:', error);
    res.status(500).json({ error: 'Failed to delete recipient' });
  }
};

export const addRecipient = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { campaignId } = req.params;
    const { email, message, triggerDate } = req.body;

    if (!email || !message || !triggerDate) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    // Verify campaign belongs to user
    const campaign = await Campaign.findOne({ _id: campaignId, userId: req.userId, isDeleted: false });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Check plan limits
    const User = (await import('../models/User')).default;
    const Plan = (await import('../models/Plan')).default;

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get plan details
    const plan = await Plan.findOne({ name: user.currentPlan });
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    // Check if plan has email limit (-1 means unlimited for pro plan)
    if (plan.emailLimit !== -1) {
      // Count all recipients created by user this month (across all campaigns)
      const userCampaigns = await Campaign.find({ userId: req.userId, isDeleted: false });
      const campaignIds = userCampaigns.map(c => c._id);

      // Get start of current billing period
      const currentPeriodStart = user.planResetDate
        ? new Date(user.planResetDate.getFullYear(), user.planResetDate.getMonth() - 1, 1)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const recipientsThisMonth = await EmailRecipient.countDocuments({
        campaignId: { $in: campaignIds },
        isDeleted: false,
        createdAt: { $gte: currentPeriodStart }
      });

      if (recipientsThisMonth >= plan.emailLimit) {
        res.status(403).json({
          error: `Plan limit reached. Your ${plan.displayName} plan allows ${plan.emailLimit} emails per month. You have ${recipientsThisMonth} scheduled. Please upgrade your plan to add more recipients.`,
          planLimit: plan.emailLimit,
          currentCount: recipientsThisMonth
        });
        return;
      }
    }

    const recipient = await EmailRecipient.create({
      campaignId,
      email,
      message,
      triggerDate: new Date(triggerDate),
      status: 'pending'
    });

    // Recalculate campaign counts
    await recalculateCampaignCounts(campaignId);

    res.status(201).json(recipient);

  } catch (error) {
    console.error('Error adding recipient:', error);
    res.status(500).json({ error: 'Failed to add recipient' });
  }
};

export const deleteCampaign = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findOne({ _id: id, userId: req.userId, isDeleted: false });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Soft delete all recipients
    await EmailRecipient.updateMany(
      { campaignId: id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() }
    );

    // Soft delete campaign
    campaign.isDeleted = true;
    campaign.deletedAt = new Date();
    await campaign.save();

    res.json({ message: 'Campaign deleted successfully' });

  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
};

export const triggerEmailNow = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { campaignId, recipientId } = req.params;

    // Verify campaign belongs to user
    const campaign = await Campaign.findOne({ _id: campaignId, userId: req.userId, isDeleted: false });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const recipient = await EmailRecipient.findOne({ _id: recipientId, campaignId, isDeleted: false });
    if (!recipient) {
      res.status(404).json({ error: 'Recipient not found' });
      return;
    }

    // Check if already sent
    if (recipient.status === 'sent') {
      res.status(400).json({ error: 'Email already sent' });
      return;
    }

    // Check if currently processing
    if (recipient.status === 'processing') {
      res.status(400).json({ error: 'Email is currently being sent' });
      return;
    }

    // Mark as processing
    recipient.status = 'processing';
    await recipient.save();

    // Import EmailService dynamically to avoid circular dependency
    const { EmailService } = await import('../services/email.service');

    // Send the email
    const result = await EmailService.sendEmail(recipient);

    if (result.success) {
      recipient.status = 'sent';
      recipient.sentAt = new Date();
    } else {
      recipient.status = 'failed';
      recipient.error = result.error;
    }

    await recipient.save();

    // Recalculate campaign counts
    await recalculateCampaignCounts(campaignId);

    res.json({
      success: result.success,
      message: result.success ? 'Email sent successfully' : 'Failed to send email',
      error: result.error,
      recipient
    });

  } catch (error) {
    console.error('Error triggering email:', error);
    res.status(500).json({ error: 'Failed to trigger email' });
  }
};

/**
 * Manually recalculate campaign counts from EmailRecipient collection
 * Useful for fixing count mismatches
 */
export const recalculateCounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify campaign belongs to user
    const campaign = await Campaign.findOne({ _id: id, userId: req.userId });
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Recalculate counts by querying EmailRecipient collection
    await recalculateCampaignCounts(id);

    // Fetch updated campaign
    const updatedCampaign = await Campaign.findById(id);

    res.json({
      message: 'Campaign counts recalculated successfully',
      campaign: updatedCampaign
    });

  } catch (error) {
    console.error('Error recalculating counts:', error);
    res.status(500).json({ error: 'Failed to recalculate counts' });
  }
};
