import { createHash } from "node:crypto";

/**
 * Minimal PayPal REST client (sandbox). Uses Orders v2 for contributions
 * and Payouts v1 for releasing the pot. Falls back to mock mode when
 * credentials are not configured so the demo runs without keys.
 */
const BASE = "https://api-m.sandbox.paypal.com";

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await accessToken()}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) headers["PayPal-Request-Id"] = idempotencyKey;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`PayPal ${method} ${path} failed: ${res.status} ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export interface PayPalOrder {
  id: string;
  status: string;
  links?: Array<{ rel: string; href: string }>;
  purchase_units?: Array<{
    custom_id?: string;
    payments?: { captures?: Array<{ id: string; status: string }> };
  }>;
}

export function createOrder(opts: { amount: string; customId: string; description: string; checkout?: { returnUrl: string; cancelUrl: string } }) {
  return call<PayPalOrder>("POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    ...(opts.checkout ? { payment_source: { paypal: { experience_context: {
      return_url: opts.checkout.returnUrl, cancel_url: opts.checkout.cancelUrl,
      shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW", brand_name: "Rotapot",
    } } } } : {}),
    purchase_units: [
      {
        reference_id: opts.customId,
        custom_id: opts.customId,
        description: opts.description,
        amount: { currency_code: "USD", value: opts.amount },
      },
    ],
  });
}

export function captureOrder(orderId: string) {
  return call<PayPalOrder>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, `capture-${orderId}`);
}

export function getOrder(orderId: string) {
  return call<PayPalOrder>("GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

export interface PayoutBatch {
  batch_header: { payout_batch_id: string; batch_status: string };
}

export function createPayout(opts: { senderBatchId: string; receiver: string; amount: string; note: string }) {
  return call<PayoutBatch>(
    "POST",
    "/v1/payments/payouts",
    {
      sender_batch_header: {
        sender_batch_id: opts.senderBatchId,
        email_subject: "Your mukando payout has arrived",
        email_message: opts.note,
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: opts.amount, currency: "USD" },
          receiver: opts.receiver,
          note: opts.note,
          // PayPal allows 256 characters for a batch ID but only 63 for an item ID.
          // Hash the full identity so long custom-circle UUIDs remain unique and retry-safe.
          sender_item_id: createHash("sha256").update(opts.senderBatchId).digest("hex").slice(0, 60),
        },
      ],
    },
    opts.senderBatchId,
  );
}

/** Ask PayPal whether a webhook delivery is authentic. */
export async function verifyWebhookSignature(opts: { headers: Headers; webhookId: string; event: unknown }): Promise<boolean> {
  const h = (name: string) => opts.headers.get(name) ?? "";
  const result = await call<{ verification_status?: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: h("paypal-auth-algo"),
    cert_url: h("paypal-cert-url"),
    transmission_id: h("paypal-transmission-id"),
    transmission_sig: h("paypal-transmission-sig"),
    transmission_time: h("paypal-transmission-time"),
    webhook_id: opts.webhookId,
    webhook_event: opts.event,
  });
  return result.verification_status === "SUCCESS";
}

export function getPayout(batchId: string) {
  return call<PayoutBatch>("GET", `/v1/payments/payouts/${encodeURIComponent(batchId)}`);
}
