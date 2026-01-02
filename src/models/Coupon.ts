import mongoose, { Document, Schema } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  discountPercentage: number;
  isActive: boolean;
  expiresAt?: Date;
  usageLimit?: number;
  usedCount: number;
  createdAt: Date;
}

const couponSchema = new Schema<ICoupon>({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date
  },
  usageLimit: {
    type: Number
  },
  usedCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<ICoupon>('Coupon', couponSchema);
