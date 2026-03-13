import { NextResponse } from "next/server";

const PLANS = {
  starter: { name: "Starter", amount: 0 },
  pro: { name: "Pro", amount: 7900, priceEnv: "STRIPE_PRICE_PRO" },
  firm: { name: "Firm", amount: 29900, priceEnv: "STRIPE_PRICE_FIRM" },
};

export async function POST(request) {
  try {
    const { planId, email, successUrl, cancelUrl } = await request.json();
    if (!planId || !PLANS[planId]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    if (planId === "starter") {
      return NextResponse.json({ url: successUrl || "/dashboard" });
    }

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return NextResponse.json({ error: "Stripe not configured. Add STRIPE_SECRET_KEY to environment variables." }, { status: 500 });
    }

    const plan = PLANS[planId];
    const origin = request.headers.get("origin") || "https://www.caseassist.ca";

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("payment_method_types[0]", "card");
    params.append("success_url", successUrl || `${origin}/dashboard?billing=success&plan=${planId}`);
    params.append("cancel_url", cancelUrl || `${origin}/pricing?billing=cancelled`);
    params.append("allow_promotion_codes", "true");
    params.append("metadata[planId]", planId);
    params.append("metadata[planName]", plan.name);
    if (email) params.append("customer_email", email);

    const priceId = process.env[plan.priceEnv];
    if (priceId) {
      params.append("line_items[0][price]", priceId);
      params.append("line_items[0][quantity]", "1");
    } else {
      params.append("line_items[0][price_data][currency]", "cad");
      params.append("line_items[0][price_data][product_data][name]", `CaseAssist ${plan.name} Plan`);
      params.append("line_items[0][price_data][unit_amount]", String(plan.amount));
      params.append("line_items[0][price_data][recurring][interval]", "month");
      params.append("line_items[0][quantity]", "1");
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await res.json();
    if (session.error) {
      return NextResponse.json({ error: session.error.message }, { status: 400 });
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
