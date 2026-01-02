import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpiry?: Date;
  currentPlan: string;
  emailsSentThisMonth: number;
  planResetDate: Date;
  createdAt: Date;
  lastLogin: Date;
}

const userSchema = new Schema<IUser>({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  picture: {
    type: String
  },
  refreshToken: {
    type: String
  },
  accessToken: {
    type: String
  },
  accessTokenExpiry: {
    type: Date
  },
  currentPlan: {
    type: String,
    default: 'free',
    enum: ['free', 'starter', 'pro']
  },
  emailsSentThisMonth: {
    type: Number,
    default: 0
  },
  planResetDate: {
    type: Date,
    default: () => {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date;
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<IUser>('User', userSchema);
