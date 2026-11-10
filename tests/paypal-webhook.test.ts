import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { accountContext } from "../lib/account-context";
import { resetDb, loadDb, currentCycle } from "../lib/db";
import { startContribution } from "../lib/club";
import { POST as webhook } from "../app/api/paypal/webhook/route";

const siphoRow = () => {
  const club = loadDb().clubs.find((c) => c.name === "Ubuntu Circle")!;
  return currentCycle(club).contributions.find((c) => c.memberId === "sipho")!;
};

const event = (orderId: string, type = "PAYMENT.CAPTURE.COMPLETED") =>
  new Request("https://rotapot.test/api/paypal/webhook", {
    method: "POST",
    headers: { "paypal-transmission-id": "t1", "paypal-transmission-time": "now", "paypal-transmission-sig": "sig", "paypal-cert-url": "https://x", "paypal-auth-algo": "SHA256withRSA" },
    body: JSON.stringify({ event_type: type, resource: { id: "CAP-" + orderId, supplementary_data: { related_ids: { order_id: orderId } } } }),
  });

test("PayPal webhook books captures per account, idempotently", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rotapot-webhook-"));
  Object.assign(process.env, { ACCOUNT_DATA_DIR: dir, PAYPAL_CLIENT_ID: "test", PAYPAL_CLIENT_SECRET: "test" });
  delete process.env.PAYPAL_WEBHOOK_ID;
  const originalFetch = globalThis.fetch;
  let verdict = "SUCCESS";
  let verifyBody: Record<string, unknown> | undefined;
  let orderCount = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.endsWith("/oauth2/token")) return Response.json({ access_token: "test", expires_in: 3600 });
    if (u.endsWith("/v1/notifications/verify-webhook-signature")) {
      verifyBody = JSON.parse(String(init?.body));
      return Response.json({ verification_status: verdict });
    }
    if (u.endsWith("/v2/checkout/orders")) return Response.json({ id: `ORD-${++orderCount}`, status: "CREATED" });
    throw new Error("unexpected fetch " + u);
  };
  try {
    assert.equal((await webhook(event("ORD-1"))).status, 503, "unset webhook id");
    process.env.PAYPAL_WEBHOOK_ID = "WH-123";

    await accountContext.run({ id: "owner-a", name: "A" }, async () => { resetDb(); await startContribution(loadDb().clubs.find((c) => c.name === "Ubuntu Circle")!.id, "sipho"); });
    await accountContext.run({ id: "owner-b", name: "B" }, async () => { resetDb(); await startContribution(loadDb().clubs.find((c) => c.name === "Ubuntu Circle")!.id, "sipho"); });

    verdict = "FAILURE";
    assert.equal((await webhook(event("ORD-1"))).status, 400);
    await accountContext.run({ id: "owner-a", name: "A" }, async () => assert.notEqual(siphoRow().status, "paid"));

    verdict = "SUCCESS";
    const ok = await webhook(event("ORD-1"));
    assert.equal(ok.status, 200);
    assert.equal(verifyBody?.webhook_id, "WH-123");
    assert.equal(verifyBody?.transmission_id, "t1");
    await accountContext.run({ id: "owner-a", name: "A" }, async () => {
      assert.equal(siphoRow().status, "paid");
      assert.equal(siphoRow().paypalCaptureId, "CAP-ORD-1");
      const club = loadDb().clubs.find((c) => c.name === "Ubuntu Circle")!;
      assert.ok(club.activity.some((a) => a.text.startsWith("PayPal confirmed")));
    });
    await accountContext.run({ id: "owner-b", name: "B" }, async () => assert.notEqual(siphoRow().status, "paid"));

    const activityCount = () => accountContext.run({ id: "owner-a", name: "A" }, async () => loadDb().clubs.find((c) => c.name === "Ubuntu Circle")!.activity.length);
    const before = await activityCount();
    const replay = await webhook(event("ORD-1"));
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).booked, false);
    assert.equal(await activityCount(), before, "replay changes nothing");

    const unknown = await webhook(event("NOPE"));
    assert.equal(unknown.status, 200);
    assert.equal((await unknown.json()).ignored, true);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.PAYPAL_WEBHOOK_ID;
    rmSync(dir, { recursive: true, force: true });
  }
});
