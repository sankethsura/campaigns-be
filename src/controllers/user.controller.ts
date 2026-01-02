import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User';
import Campaign from '../models/Campaign';
import EmailRecipient from '../models/EmailRecipient';
import Plan from '../models/Plan';

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

export const getPlanUsage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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

    const emailLimit = plan.emailLimit;
    const isUnlimited = emailLimit === -1;
    const remaining = isUnlimited ? -1 : Math.max(0, emailLimit - recipientsThisMonth);
    const percentageUsed = isUnlimited ? 0 : Math.min(100, (recipientsThisMonth / emailLimit) * 100);

    res.json({
      planName: plan.name,
      planDisplayName: plan.displayName,
      emailLimit: emailLimit,
      isUnlimited: isUnlimited,
      used: recipientsThisMonth,
      remaining: remaining,
      percentageUsed: Math.round(percentageUsed),
      resetDate: user.planResetDate
    });
  } catch (error) {
    console.error('Error fetching plan usage:', error);
    res.status(500).json({ error: 'Failed to fetch plan usage' });
  }
};
