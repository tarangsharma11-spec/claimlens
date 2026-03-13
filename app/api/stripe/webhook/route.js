import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      console.log(`Checkout completed: ${session.id}, email: ${session.customer_email}, plan: ${session.metadata?.planId}`);
      // TODO: Update user plan in database
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      console.log(`Subscription updated: ${sub.id}, status: ${sub.status}`);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      console.log(`Subscription cancelled: ${sub.id}`);
      // TODO: Downgrade user to starter
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      console.log(`Payment failed: ${invoice.id}, customer: ${invoice.customer}`);
      break;
    }
    default:
      console.log(`Unhandled event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
