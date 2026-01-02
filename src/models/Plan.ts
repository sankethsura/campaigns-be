import mongoose, { Document, Schema } from 'mongoose';

export interface IPlan extends Document {
  name: string;
  displayName: string;
  description: string;
  price: number;
  currency: string;
  emailLimit: number; // -1 for unlimited
  features: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['free', 'starter', 'pro']
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  emailLimit: {
    type: Number,
    required: true,
    default: 20 // -1 means unlimited
  },
  features: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model<IPlan>('Plan', planSchema);
