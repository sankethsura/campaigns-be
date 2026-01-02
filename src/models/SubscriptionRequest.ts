import mongoose, { Document, Schema } from 'mongoose';

export interface ISubscriptionRequest extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planName: string;
  userEmail: string;
  userName: string;
  status: 'pending' | 'contacted' | 'approved' | 'rejected';
  paymentId?: string;
  orderId?: string;
  amount?: number;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionRequestSchema = new Schema<ISubscriptionRequest>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'approved', 'rejected'],
    default: 'pending'
  },
  paymentId: {
    type: String
  },
  orderId: {
    type: String
  },
  amount: {
    type: Number
  },
  approvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

export default mongoose.model<ISubscriptionRequest>('SubscriptionRequest', subscriptionRequestSchema);
