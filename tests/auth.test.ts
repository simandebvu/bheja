import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { payLink, readPayAccess, withPaymentAccount } from "../lib/pay-access";
import { getAuth } from "../lib/auth";
import { withAccount } from "../lib/authorize";
import { accountContext } from "../lib/account-context";
import { loadDb, resetDb, seedDb, updateDb } from "../lib/db";

const origin = "http://localhost:3000";

test("verified accounts, sessions, reset tokens, access control and account isolation", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "rotapot-auth-"));
  process.env.BETTER_AUTH_SECRET = randomBytes(48).toString("hex");
  process.env.BETTER_AUTH_URL = origin;
  process.env.AUTH_DB_PATH = path.join(directory, "auth.sqlite");
  process.env.ACCOUNT_DATA_DIR = path.join(directory, "accounts");
  process.env.RESEND_API_KEY = "test-key";
  process.env.RESEND_FROM = "Rotapot <accounts@example.com>";
  const originalFetch = globalThis.fetch;
  const emails: { to: string[]; text: string }[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    emails.push(JSON.parse(String(init?.body)));
    return Response.json({ id: "test-email" });
  };
  try {
    const auth = await getAuth();
    const call = (route: string, body?: unknown, cookie = "") => auth.handler(new Request(`${origin}/api/auth${route}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));
    const credentials = { email: "alice@example.com", password: "correct horse battery staple" };
    let response = await call("/sign-up/email", { ...credentials, name: "Alice", callbackURL: "/?verified=1" });
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(emails.length, 1);
    assert.equal(emails[0].to[0], credentials.email);
    assert.equal((await call("/sign-in/email", credentials)).status, 403, "unverified users cannot sign in");
    const verificationURL = emails[0].text.match(/http[^\s]+/)![0];
    assert.equal((await auth.handler(new Request(verificationURL))).status, 302);
    assert.equal((await call("/sign-in/email", { ...credentials, password: "wrong password" })).status, 401);
    response = await call("/sign-in/email", credentials);
    assert.equal(response.status, 200);
    const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    assert.match(response.headers.get("set-cookie") || "", /HttpOnly/i);
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    assert.equal(session?.user.email, credentials.email);
    const protectedRoute = withAccount(async () => Response.json({ clubs: loadDb().clubs }));
    assert.equal((await protectedRoute(new Request(origin), undefined)).status, 401);
    assert.equal((await protectedRoute(new Request(origin, { headers: { cookie: "rotapot_session=rudo" } }), undefined)).status, 401);
    assert.equal((await protectedRoute(new Request(origin, { headers: { cookie } }), undefined)).status, 200);
    assert.equal((await protectedRoute(new Request(origin, { method: "POST", headers: { cookie, Origin: "https://evil.example" } }), undefined)).status, 403);
    assert.throws(() => loadDb(), /authenticated account/);
    const alice = session!.user;
    accountContext.run(alice, () => { assert.equal(loadDb().clubs.length, 0, "new users start empty"); updateDb((db) => { db.clubs = seedDb().clubs; }); });
    const bob = { id: "bob", name: "Bob" };
    accountContext.run(alice, () => updateDb((db) => { db.clubs[0].name = "Alice only"; }));
    accountContext.run(bob, () => { assert.equal(loadDb().clubs.length, 0); resetDb(); });
    accountContext.run(alice, () => assert.equal(loadDb().clubs[0].name, "Alice only"));
    const link = accountContext.run(alice, () => payLink("ubuntu-circle", "tendai"));
    const payToken = new URL(link, origin).searchParams.get("access")!;
    assert.equal(readPayAccess(payToken)?.accountId, alice.id);
    assert.equal(readPayAccess(payToken + "tampered"), null);
    const payRoute = withPaymentAccount(async () => Response.json({ ok: true }));
    const payRequest = (memberId: string) => new Request(`${origin}/api/paypal/orders`, { method: "POST", headers: { origin, "x-rotapot-pay-access": payToken, "Content-Type": "application/json" }, body: JSON.stringify({ clubId: "ubuntu-circle", memberId }) });
    assert.equal((await payRoute(payRequest("tendai"), undefined)).status, 200);
    assert.equal((await payRoute(payRequest("rudo"), undefined)).status, 403);
    assert.equal((await protectedRoute(payRequest("tendai"), undefined)).status, 401, "member tokens cannot authorize treasurer actions");
    assert.equal((await payRoute(new Request(`${origin}/api/paypal/orders/another-order/capture`, { method: "POST", headers: { origin, "x-rotapot-pay-access": payToken } }), undefined)).status, 403);
    accountContext.run(alice, resetDb);
    assert.equal(readPayAccess(payToken), null, "demo resets revoke old payment links");
    const routes = [
      await import("../app/api/agent/route"), await import("../app/api/briefing/route"),
      await import("../app/api/clubs/route"), await import("../app/api/clubs/[clubId]/route"),
      await import("../app/api/clubs/[clubId]/inbox/route"), await import("../app/api/clubs/[clubId]/plans/route"),
      await import("../app/api/payout/route"), await import("../app/api/mock-pay/route"),
      await import("../app/api/paypal/orders/route"), await import("../app/api/paypal/orders/[orderId]/capture/route"),
    ];
    for (const route of routes) {
      for (const method of ["GET", "POST"] as const) {
        const handler = (route as Record<string, unknown>)[method] as ((req: Request, context: unknown) => Promise<Response>) | undefined;
        if (handler) assert.equal((await handler(new Request(origin, { method, headers: { cookie: "rotapot_session=rudo" } }), {})).status, 401);
      }
    }
    const absent = await call("/request-password-reset", { email: "absent@example.com", redirectTo: "/reset-password" });
    const known = await call("/request-password-reset", { email: credentials.email, redirectTo: "/reset-password" });
    assert.deepEqual(await absent.json(), await known.json(), "reset responses do not reveal account existence");
    assert.equal(emails.length, 2);
    const resetURL = emails[1].text.match(/http[^\s]+/)![0];
    const token = new URL(resetURL).pathname.split("/").pop()!;
    const newPassword = "a different secure password";
    assert.equal((await call("/reset-password", { token: "invalid", newPassword })).status, 400);
    assert.equal((await call("/reset-password", { token, newPassword })).status, 200);
    assert.equal((await call("/reset-password", { token, newPassword })).status, 400, "reset tokens are single use");
    assert.equal(await auth.api.getSession({ headers: new Headers({ cookie }) }), null, "reset revokes existing sessions");
    assert.equal((await call("/sign-in/email", credentials)).status, 401);
    response = await call("/sign-in/email", { email: credentials.email, password: newPassword });
    assert.equal(response.status, 200);
    const newCookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    assert.equal((await call("/sign-out", {}, newCookie)).status, 200);
    assert.equal(await auth.api.getSession({ headers: new Headers({ cookie: newCookie }) }), null);
    await call("/request-password-reset", { email: credentials.email, redirectTo: "/reset-password" });
    const expiredToken = new URL(emails[2].text.match(/http[^\s]+/)![0]).pathname.split("/").pop()!;
    const db = new Database(process.env.AUTH_DB_PATH);
    db.prepare('UPDATE verification SET expiresAt = ?').run(Date.now() - 3600000);
    db.close();
    assert.equal((await call("/reset-password", { token: expiredToken, newPassword })).status, 400, "expired tokens are rejected");
    const limited = await call("/request-password-reset", { email: credentials.email });
    assert.equal(limited.status, 429, "reset requests are rate limited");
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(directory, { recursive: true, force: true });
  }
});
