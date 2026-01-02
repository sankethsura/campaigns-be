import dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/database';
import passportConfig from './config/passport';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import campaignRoutes from './routes/campaign.routes';
import pricingRoutes from './routes/pricing.routes';
import { EmailService } from './services/email.service';
import { SchedulerService } from './services/scheduler.service';

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database
connectDB();

// Initialize email service
EmailService.initialize();

// Start email scheduler (async)
(async () => {
  await SchedulerService.start();
})();

app.use(cors({
  origin: true, // Allow all origins
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(passportConfig.initialize());

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Backend server is running!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/pricing', pricingRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
