import { NextResponse } from "next/server";
import { accountContext } from "@/lib/account-context";
import { bookCapturedOrder, completeContribution } from "@/lib/club";
import { accountForOrder } from "@/lib/order-index";
import { paypalConfigured, verifyWebhookSignature } from "@/lib/paypal";

interface WebhookEvent {
  event_type?: string;
  resource?: {
    id?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
}

export async function POST(req: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId || !paypalConfigured()) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });

  let event: WebhookEvent;
  try {
    event = (await req.json()) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  let verified = false;
  try {
    verified = await verifyWebhookSignature({ headers: req.headers, webhookId, event });
  } catch (err) {
    console.error("PayPal webhook verification error", err);
  }
  if (!verified) return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });

  const type = event.event_type;
  const resource = event.resource;
  const orderId =
    type === "PAYMENT.CAPTURE.COMPLETED" ? resource?.supplementary_data?.related_ids?.order_id
    : type === "CHECKOUT.ORDER.APPROVED" ? resource?.id
    : undefined;
  if (!orderId) return NextResponse.json({ ignored: true });

  const accountId = accountForOrder(orderId);
  if (!accountId) return NextResponse.json({ ignored: true, reason: "unknown order" });

  try {
    const result = await accountContext.run({ id: accountId, name: "PayPal webhook" }, async () => {
      if (type === "PAYMENT.CAPTURE.COMPLETED") return bookCapturedOrder(orderId, resource?.id);
      // Approved but possibly never captured (tab closed): capture via the existing path. Idempotent.
      await completeContribution(orderId);
      return { found: true, booked: true };
    });
    return NextResponse.json(result.found ? { ok: true, booked: result.booked } : { ignored: true, reason: "unknown order" });
  } catch (err) {
    console.error("PayPal webhook error", err);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
