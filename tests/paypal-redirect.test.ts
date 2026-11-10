import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { accountContext } from "../lib/account-context";
import { resetDb, loadDb, currentCycle } from "../lib/db";
import { payLink } from "../lib/pay-access";
import { POST as create } from "../app/api/paypal/orders/route";
import { POST as capture } from "../app/api/paypal/orders/[orderId]/capture/route";
import { createPayout } from "../lib/paypal";

test("redirect checkout preserves member scope and records captured funds", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rotapot-paypal-"));
  const origin = "https://rotapot.test";
  Object.assign(process.env, { ACCOUNT_DATA_DIR: dir, BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: "redirect-checkout-test-secret-long-enough", PAYPAL_CLIENT_ID: "test", PAYPAL_CLIENT_SECRET: "test" });
  const originalFetch = globalThis.fetch;
  let creates = 0;
  const payoutItems: string[] = [];
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).startsWith("https://api-m.sandbox.paypal.com/"));
    if (String(url).endsWith("/oauth2/token")) return Response.json({ access_token: "test", expires_in: 3600 });
    if (String(url).endsWith("/v1/payments/payouts")) {
      const body = JSON.parse(String(init?.body));
      assert.ok(body.sender_batch_header.sender_batch_id.length > 63);
      assert.ok(body.items[0].sender_item_id.length <= 63);
      payoutItems.push(body.items[0].sender_item_id);
      return Response.json({ batch_header: { payout_batch_id: "TESTBATCH", batch_status: "PENDING" } });
    }
    if (String(url).endsWith("/v2/checkout/orders")) {
      creates++;
      const body = JSON.parse(String(init?.body));
      const context = body.payment_source.paypal.experience_context;
      assert.equal(new URL(context.return_url).origin, origin);
      assert.equal(new URL(context.return_url).searchParams.get("paypalReturn"), "1");
      assert.ok(new URL(context.return_url).searchParams.get("access"));
      assert.equal(new URL(context.cancel_url).searchParams.get("cancelled"), "1");
      assert.equal(body.purchase_units[0].amount.value, "50.00");
      return Response.json({ id: "TESTORDER", status: "PAYER_ACTION_REQUIRED", links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=TESTORDER" }] });
    }
    assert.ok(String(url).endsWith("/TESTORDER/capture"));
    return Response.json({ id: "TESTORDER", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "TESTCAPTURE", status: "COMPLETED" }] } }] });
  };
  try {
    await accountContext.run({ id: "test-owner", name: "Tester" }, async () => {
      resetDb();
      const club = loadDb().clubs.find(c => c.name === "Ubuntu Circle")!;
      const access = new URL(payLink(club.id, "sipho"), origin).searchParams.get("access")!;
      const request = (route: string, body?: unknown) => new Request(origin + route, { method: "POST", headers: { origin, "content-type": "application/json", "x-rotapot-pay-access": access }, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.equal((await create(request("/api/paypal/orders", { clubId: club.id, memberId: "lerato", redirect: true }), undefined)).status, 403);
      assert.equal(creates, 0);
      const response = await create(request("/api/paypal/orders", { clubId: club.id, memberId: "sipho", redirect: true, returnUrl: "https://evil.test" }), undefined);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).approvalUrl, "https://www.sandbox.paypal.com/checkoutnow?token=TESTORDER");
      assert.equal((await capture(request("/api/paypal/orders/OTHER/capture"), { params: Promise.resolve({ orderId: "OTHER" }) })).status, 403);
      assert.equal((await capture(request("/api/paypal/orders/TESTORDER/capture"), { params: Promise.resolve({ orderId: "TESTORDER" }) })).status, 200);
      const row = currentCycle(loadDb().clubs.find(c => c.id === club.id)!).contributions.find(c => c.memberId === "sipho")!;
      assert.equal(row.status, "paid");
      assert.equal(row.source, "paypal");
      const payout = { senderBatchId: `${club.id}-cycle-1-12345678-1234-1234-1234-123456789012`, receiver: "buyer@example.com", amount: "10.00", note: "Test pot" };
      await createPayout(payout);
      await createPayout(payout);
      await createPayout({ ...payout, senderBatchId: payout.senderBatchId + "-next" });
      assert.equal(payoutItems[0], payoutItems[1], "retries retain the same payout item identity");
      assert.notEqual(payoutItems[0], payoutItems[2], "different cycles retain distinct identities");
    });
  } finally { globalThis.fetch = originalFetch; rmSync(dir, { recursive: true, force: true }); }
});
