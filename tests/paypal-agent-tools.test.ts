import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPayPalTools, unwrapToolText } from "../lib/paypal-agent-tools";

const ALLOWED = ["create_invoice", "generate_invoice_qr_code", "get_invoice", "get_order", "list_transactions", "send_invoice"];

test("paypal agent tools are off unless flagged and configured", async () => {
  Object.assign(process.env, { PAYPAL_CLIENT_ID: "x", PAYPAL_CLIENT_SECRET: "y" });
  delete process.env.PAYPAL_AGENT_TOOLKIT;
  assert.equal(await loadPayPalTools(), null);
  process.env.PAYPAL_AGENT_TOOLKIT = "1";
  delete process.env.PAYPAL_CLIENT_ID;
  assert.equal(await loadPayPalTools(), null);
});

test("paypal agent tools are exactly the allowlist and errors map to isError", async () => {
  Object.assign(process.env, { PAYPAL_AGENT_TOOLKIT: "1", PAYPAL_CLIENT_ID: "x", PAYPAL_CLIENT_SECRET: "y" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(String(url).includes("sandbox.paypal.com"), `non-sandbox call ${url}`);
    if (String(url).endsWith("/oauth2/token")) return Response.json({ access_token: "t", expires_in: 3600 });
    return Response.json({ name: "RESOURCE_NOT_FOUND", message: "nope" }, { status: 404 });
  };
  try {
    const pp = await loadPayPalTools();
    assert.ok(pp);
    assert.deepEqual([...pp.names].sort(), ALLOWED);
    for (const t of pp.tools) {
      assert.ok(!("$schema" in t.input_schema), t.name);
      assert.equal(t.input_schema.type, "object");
    }
    const r = await pp.run("get_order", { id: "NOPE" });
    assert.equal(r.isError, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("double-encoded toolkit errors are unwrapped", () => {
  const inner = JSON.stringify({ error: "boom" });
  assert.deepEqual(unwrapToolText(JSON.stringify(inner)), { result: { error: "boom" }, isError: true });
  assert.equal(unwrapToolText(JSON.stringify({ id: "1" })).isError, false);
  assert.equal(unwrapToolText(JSON.stringify({ ok: false, status: 403, code: "PAYPAL_API_HTTP_ERROR" })).isError, true);
});
