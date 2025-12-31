/**
 * Create Razorpay Order API Route
 * POST /api/payments/create-order
 */

<<<<<<< Updated upstream
import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { RAZORPAY_CONFIG, PRICING_PLANS } from '@/config/premium';
=======
import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { RAZORPAY_CONFIG, PRICING_PLANS } from "@/config/premium";
import { rateLimit, addRateLimitHeaders } from "@/lib/rate-limit";

// Strict rate limiting for payment creation (prevent spam/abuse)
const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many payment requests. Please try again later.",
});
>>>>>>> Stashed changes

// Lazy-initialize Razorpay to prevent build errors
let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    if (!RAZORPAY_CONFIG.keyId || !RAZORPAY_CONFIG.keySecret) {
      throw new Error(
        "Razorpay configuration is missing. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables."
      );
    }
    razorpayInstance = new Razorpay({
      key_id: RAZORPAY_CONFIG.keyId,
      key_secret: RAZORPAY_CONFIG.keySecret,
    });
  }
  return razorpayInstance;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, billingCycle, userId, userEmail, userName } = body;

    // Validate inputs
    if (!planId || !billingCycle || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const plan = PRICING_PLANS[planId];
    if (!plan || planId === "free") {
      return NextResponse.json(
        { success: false, error: "Invalid plan" },
        { status: 400 }
      );
    }

<<<<<<< Updated upstream
    const amount = billingCycle === 'monthly' ? plan.price.monthly : plan.price.yearly;
=======
    const amount =
      billingCycle === "halfYearly" ? plan.price.halfYearly : plan.price.yearly;

    // Get Razorpay instance (lazy initialization)
    const razorpay = getRazorpay();
>>>>>>> Stashed changes

    // Create Razorpay order
    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: RAZORPAY_CONFIG.currency,
      receipt: `order_${Date.now()}`,
      notes: {
        plan_id: planId,
        billing_cycle: billingCycle,
        user_id: userId,
      },
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: RAZORPAY_CONFIG.keyId,
        planName: plan.displayName,
        userEmail,
        userName,
      },
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create order",
      },
      { status: 500 }
    );
  }
}
