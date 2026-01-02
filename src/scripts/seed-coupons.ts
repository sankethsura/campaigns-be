import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../config/database';
import Coupon from '../models/Coupon';

const coupons = [
  {
    code: '99OFF',
    discountPercentage: 99,
    isActive: true,
    // No expiration - valid forever
    // No usage limit - unlimited uses
  }
];

async function seedCoupons() {
  try {
    await connectDB();
    console.log('🎫 Seeding coupons...');

    // Clear existing coupons
    await Coupon.deleteMany({});
    console.log('✅ Cleared existing coupons');

    // Insert new coupons
    const createdCoupons = await Coupon.insertMany(coupons);
    console.log(`✅ Created ${createdCoupons.length} coupons:`);

    createdCoupons.forEach(coupon => {
      console.log(`   - ${coupon.code}: ${coupon.discountPercentage}% discount`);
    });

    console.log('🎉 Coupons seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding coupons:', error);
    process.exit(1);
  }
}

seedCoupons();
