import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  starter: {
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER,
    fallbackAmount: 0,
  },
  pro: {
    name: "Pro",
    priceId: process.env.STRIPE_PRICE_PRO,
    fallbackAmount: 7900,
  },
  firm: {
    name: "Firm",
    priceId: process.env.STRIPE_PRICE_FIRM,
    fallbackAmount: 29900,
  },
};

export async function POST(request) {
  try {
    const { planId, email, successUrl, cancelUrl } = await request.json();

    if (!planId || !PLANS[planId]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const plan = PLANS[planId];

    if (planId === "starter") {
      return NextResponse.json({ url: successUrl || "/dashboard" });
    }

    const origin = request.headers.get("origin") || "https://www.caseassist.ca";

    const sessionConfig = {
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${origin}/dashboard?billing=success&plan=${planId}`,
      cancel_url: cancelUrl || `${origin}/pricing?billing=cancelled`,
      customer_email: email,
      metadata: {
        planId,
        planName: plan.name,
      },
      subscription_data: {
        metadata: {
          planId,
          planName: plan.name,
        },
      },
      allow_promotion_codes: true,
    };

    // If no Stripe price IDs configured yet, use ad-hoc pricing
    if (!plan.priceId) {
      sessionConfig.line_items = [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `CaseAssist ${plan.name} Plan`,
              description: planId === "pro"
                ? "Unlimited cases, full AI tools, email integration"
                : "5 users, shared workspace, priority support",
            },
            unit_amount: plan.fallbackAmount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
