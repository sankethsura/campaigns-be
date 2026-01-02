import { Response } from 'express';
import Coupon from '../models/Coupon';
import { AuthRequest } from '../middleware/auth.middleware';

// Validate a coupon code
export const validateCoupon = async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    console.log('🎫 Validating coupon:', code);

    // Find coupon (case-insensitive)
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      console.log('❌ Coupon not found:', code);
      return res.status(404).json({ error: 'Invalid coupon code' });
    }

    // Check if active
    if (!coupon.isActive) {
      console.log('❌ Coupon inactive:', code);
      return res.status(400).json({ error: 'This coupon is no longer active' });
    }

    // Check expiration
    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      console.log('❌ Coupon expired:', code);
      return res.status(400).json({ error: 'This coupon has expired' });
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      console.log('❌ Coupon usage limit reached:', code);
      return res.status(400).json({ error: 'This coupon has reached its usage limit' });
    }

    console.log('✅ Coupon valid:', code, 'Discount:', coupon.discountPercentage + '%');

    res.json({
      valid: true,
      code: coupon.code,
      discountPercentage: coupon.discountPercentage,
      message: `Coupon applied! ${coupon.discountPercentage}% discount`
    });
  } catch (error: any) {
    console.error('❌ Error validating coupon:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
};
