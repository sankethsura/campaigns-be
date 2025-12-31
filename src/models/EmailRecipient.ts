import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailRecipient extends Document {
  campaignId: mongoose.Types.ObjectId;
  email: string;
  message: string;
  triggerDate: Date;
  status: 'pending' | 'sent' | 'failed' | 'scheduled' | 'processing';
  sentAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const emailRecipientSchema = new Schema<IEmailRecipient>({
  campaignId: {
    type: Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  triggerDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'scheduled', 'processing'],
    default: 'pending'
  },
  sentAt: {
    type: Date
  },
  error: {
    type: String
  }
}, {
  timestamps: true
});

// Index for finding emails to send
emailRecipientSchema.index({ status: 1, triggerDate: 1 });

export default mongoose.model<IEmailRecipient>('EmailRecipient', emailRecipientSchema);
