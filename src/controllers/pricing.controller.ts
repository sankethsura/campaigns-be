import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Plan from '../models/Plan';
import SubscriptionRequest from '../models/SubscriptionRequest';
import User from '../models/User';
import { EmailService } from '../services/email.service';

/**
 * Get all active plans
 */
export const getPlans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
};

/**
 * Submit subscription request
 */
export const submitSubscriptionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { planId } = req.body;

    if (!planId) {
      res.status(400).json({ error: 'Plan ID is required' });
      return;
    }

    // Get plan details
    const plan = await Plan.findById(planId);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    // Get user details
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if user already has a pending request for this plan
    const existingRequest = await SubscriptionRequest.findOne({
      userId: req.userId,
      planId,
      status: 'pending'
    });

    if (existingRequest) {
      res.status(400).json({
        error: 'You already have a pending request for this plan',
        request: existingRequest
      });
      return;
    }

    // Create subscription request
    const subscriptionRequest = await SubscriptionRequest.create({
      userId: req.userId,
      planId,
      planName: plan.name,
      userEmail: user.email,
      userName: user.name,
      status: 'pending'
    });

    // Send email notification to admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

    try {
      await EmailService.sendAdminNotification({
        to: adminEmail,
        subject: `New Subscription Request - ${plan.displayName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Subscription Request</h2>

            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">User Details</h3>
              <p><strong>Name:</strong> ${user.name}</p>
              <p><strong>Email:</strong> ${user.email}</p>
              <p><strong>User ID:</strong> ${user._id}</p>
            </div>

            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Plan Details</h3>
              <p><strong>Plan:</strong> ${plan.displayName}</p>
              <p><strong>Price:</strong> ₹${plan.price}/month</p>
              <p><strong>Email Limit:</strong> ${plan.emailLimit === -1 ? 'Unlimited' : plan.emailLimit} emails/month</p>
            </div>

            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Request Details</h3>
              <p><strong>Request ID:</strong> ${subscriptionRequest._id}</p>
              <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Status:</strong> Pending</p>
            </div>

            <p style="margin-top: 30px; color: #6b7280;">
              Please contact the user at <a href="mailto:${user.email}">${user.email}</a> to proceed with the subscription.
            </p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      message: 'Subscription request submitted successfully. We will contact you soon!',
      request: subscriptionRequest
    });

  } catch (error) {
    console.error('Error submitting subscription request:', error);
    res.status(500).json({ error: 'Failed to submit subscription request' });
  }
};

/**
 * Get user's subscription requests
 */
export const getMySubscriptionRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await SubscriptionRequest.find({ userId: req.userId })
      .populate('planId')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching subscription requests:', error);
    res.status(500).json({ error: 'Failed to fetch subscription requests' });
  }
};

/**
 * Get current user's plan info
 */
export const getMyPlanInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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

    res.json({
      plan: {
        name: plan.name,
        displayName: plan.displayName,
        emailLimit: plan.emailLimit,
        price: plan.price
      },
      usage: {
        emailsSentThisMonth: user.emailsSentThisMonth,
        resetDate: user.planResetDate
      }
    });
  } catch (error) {
    console.error('Error fetching plan info:', error);
    res.status(500).json({ error: 'Failed to fetch plan info' });
  }
};
