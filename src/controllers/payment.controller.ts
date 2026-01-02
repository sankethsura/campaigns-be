import { Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import User from '../models/User';
import Plan from '../models/Plan';
import SubscriptionRequest from '../models/SubscriptionRequest';
import Coupon from '../models/Coupon';
import { AuthRequest } from '../middleware/auth.middleware';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});

// Create Razorpay order for a plan
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { planId, couponCode } = req.body;
    const userId = req.userId;

    console.log('💳 Create order request - userId:', userId, 'planId:', planId, 'couponCode:', couponCode);

    // Get plan details
    const plan = await Plan.findById(planId);
    if (!plan) {
      console.error('❌ Plan not found:', planId);
      return res.status(404).json({ error: 'Plan not found' });
    }

    console.log('📋 Plan found:', plan.name, 'Original Price:', plan.price);

    // Don't create order for free plan
    if (plan.name === 'free' || plan.price === 0) {
      return res.status(400).json({ error: 'Free plan does not require payment' });
    }

    // Apply coupon if provided
    let finalPrice = plan.price;
    let discountPercentage = 0;
    let appliedCouponCode = '';

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });

      if (coupon && coupon.isActive) {
        // Check expiration
        if (!coupon.expiresAt || new Date() <= coupon.expiresAt) {
          // Check usage limit
          if (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) {
            discountPercentage = coupon.discountPercentage;
            finalPrice = plan.price * (1 - discountPercentage / 100);
            appliedCouponCode = coupon.code;
            console.log('🎫 Coupon applied:', coupon.code, 'Discount:', discountPercentage + '%', 'Final Price:', finalPrice);
          } else {
            console.log('⚠️ Coupon usage limit reached:', couponCode);
          }
        } else {
          console.log('⚠️ Coupon expired:', couponCode);
        }
      } else {
        console.log('⚠️ Invalid or inactive coupon:', couponCode);
      }
    }

    // Round to avoid decimal issues
    finalPrice = Math.round(finalPrice);

    // Create Razorpay order
    // Receipt must be max 40 chars - use short format
    const shortReceipt = `ord_${Date.now()}_${userId?.toString().slice(-8)}`;
    console.log('📝 Receipt:', shortReceipt, 'Length:', shortReceipt.length);

    const options: any = {
      amount: finalPrice * 100, // Amount in paise (INR)
      currency: plan.currency,
      receipt: shortReceipt,
      notes: {
        userId,
        planId: plan._id.toString(),
        planName: plan.name,
        couponCode: appliedCouponCode || 'none',
        originalPrice: plan.price,
        discountPercentage: discountPercentage
      }
    };

    const order: any = await razorpay.orders.create(options);

    console.log('✅ Razorpay order created:', order.id);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      planName: plan.displayName,
      originalPrice: plan.price,
      finalPrice: finalPrice,
      discountPercentage: discountPercentage,
      couponApplied: appliedCouponCode,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error: any) {
    console.error('❌ Error creating Razorpay order:', error);
    res.status(500).json({ error: 'Failed to create order', details: error.message });
  }
};

// Verify payment and activate subscription
export const verifyPayment = async (req: AuthRequest, res: Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      couponCode
    } = req.body;

    const userId = req.userId;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Get plan details
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Calculate plan reset date (first day of next month)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Get user details first
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user subscription
    user.currentPlan = plan.name;
    user.emailsSentThisMonth = 0;
    user.planResetDate = nextMonth;
    user.subscriptionActive = true;
    user.subscriptionStartDate = new Date();
    user.lastPaymentId = razorpay_payment_id;
    await user.save();

    // Create subscription request record
    await SubscriptionRequest.create({
      userId,
      planId: plan._id,
      planName: plan.name,
      userName: user.name,
      userEmail: user.email,
      status: 'approved',
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      amount: plan.price,
      approvedAt: new Date()
    });

    // Increment coupon usage if coupon was used
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (coupon) {
        coupon.usedCount += 1;
        await coupon.save();
        console.log('✅ Coupon usage incremented:', couponCode, 'New count:', coupon.usedCount);
      }
    }

    res.json({
      success: true,
      message: `Successfully subscribed to ${plan.displayName} plan!`,
      subscription: {
        plan: plan.displayName,
        emailLimit: plan.emailLimit,
        resetDate: nextMonth
      }
    });
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

// Activate free plan directly
export const activateFreePlan = async (req: AuthRequest, res: Response) => {
  try {
    const { planId } = req.body;
    const userId = req.userId;

    // Get plan details
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Verify it's the free plan
    if (plan.name !== 'free' && plan.price !== 0) {
      return res.status(400).json({ error: 'This endpoint is only for free plan activation' });
    }

    // Calculate plan reset date (first day of next month)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Update user subscription
    await User.findByIdAndUpdate(
      userId,
      {
        currentPlan: 'free',
        emailsSentThisMonth: 0,
        planResetDate: nextMonth,
        subscriptionActive: true,
        subscriptionStartDate: new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Free plan activated successfully!',
      subscription: {
        plan: plan.displayName,
        emailLimit: plan.emailLimit,
        resetDate: nextMonth
      }
    });
  } catch (error: any) {
    console.error('Error activating free plan:', error);
    res.status(500).json({ error: 'Failed to activate free plan' });
  }
};
