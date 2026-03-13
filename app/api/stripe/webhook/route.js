import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // Verify signature if secret is configured
  if (secret && sig) {
    try {
      const elements = sig.split(",").reduce((acc, part) => {
        const [key, val] = part.split("=");
        acc[key] = val;
        return acc;
      }, {});
      const timestamp = elements.t;
      const expected = crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
      if (expected !== elements.v1) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    } catch (err) {
      console.error("Webhook verification error:", err);
      return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
    }
  }

  try {
    const event = JSON.parse(body);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log(`Checkout completed: ${session.id}, email: ${session.customer_email}, plan: ${session.metadata?.planId}`);
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
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.log(`Payment failed: ${invoice.id}`);
        break;
      }
      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
