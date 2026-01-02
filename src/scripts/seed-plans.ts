import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/database';
import Plan from '../models/Plan';

const plans = [
  {
    name: 'free',
    displayName: 'Free Trial',
    description: 'Perfect for testing and small campaigns',
    price: 0,
    currency: 'INR',
    emailLimit: 5,
    features: [
      '5 emails per month',
      'Basic campaign management',
      'Real-time tracking',
      'Email scheduling',
      'Basic support'
    ],
    isActive: true,
    sortOrder: 1
  },
  {
    name: 'starter',
    displayName: 'Starter',
    description: 'Great for growing businesses',
    price: 599,
    currency: 'INR',
    emailLimit: 1000,
    features: [
      '1,000 emails per month',
      'Advanced campaign management',
      'Real-time tracking & analytics',
      'Precision email scheduling',
      'Bulk Excel import',
      'Priority support'
    ],
    isActive: true,
    sortOrder: 2
  },
  {
    name: 'pro',
    displayName: 'Pro',
    description: 'Unlimited power for professionals',
    price: 1299,
    currency: 'INR',
    emailLimit: -1, // Unlimited
    features: [
      'Unlimited emails',
      'Advanced campaign management',
      'Real-time tracking & analytics',
      'Precision email scheduling',
      'Bulk Excel import',
      'Auto-recovery & retry',
      '24/7 Premium support',
      'Custom integrations'
    ],
    isActive: true,
    sortOrder: 3
  }
];

async function seedPlans() {
  try {
    await connectDB();
    console.log('🌱 Seeding plans...');

    // Clear existing plans
    await Plan.deleteMany({});
    console.log('✅ Cleared existing plans');

    // Insert new plans
    const createdPlans = await Plan.insertMany(plans);
    console.log(`✅ Created ${createdPlans.length} plans:`);

    createdPlans.forEach(plan => {
      console.log(`   - ${plan.displayName}: ₹${plan.price}/month (${plan.emailLimit === -1 ? 'Unlimited' : plan.emailLimit} emails)`);
    });

    console.log('🎉 Plans seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding plans:', error);
    process.exit(1);
  }
}

seedPlans();
