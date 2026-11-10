import { createHmac, timingSafeEqual } from "node:crypto";
import { accountContext, currentAccount } from "./account-context";
import { loadDb } from "./db";
import { withAccount } from "./authorize";

type PayAccess = { accountId: string; clubId: string; memberId: string; runId: string; expires: number };
function signature(payload: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Authentication is not configured.");
  return createHmac("sha256", secret).update(`rotapot-pay:${payload}`).digest("base64url");
}
export function payLink(clubId: string, memberId: string) {
  const payload = Buffer.from(JSON.stringify({ accountId: currentAccount().id, clubId, memberId, runId: loadDb().runId!,
    expires: Date.now() + 30 * 24 * 60 * 60 * 1000 } satisfies PayAccess)).toString("base64url");
  return `/pay/${encodeURIComponent(clubId)}/${encodeURIComponent(memberId)}?access=${payload}.${signature(payload)}`;
}
export function readPayAccess(token: string): PayAccess | null {
  try {
    if (token.length > 4096) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const expected = Buffer.from(signature(parts[0]));
    const actual = Buffer.from(parts[1]);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const access = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as PayAccess;
    if (![access.accountId, access.clubId, access.memberId, access.runId].every((value) => typeof value === "string" && value.length > 0) || !Number.isFinite(access.expires) || access.expires <= Date.now()) return null;
    return accountContext.run({ id: access.accountId, name: "Member checkout" }, () => {
      const db = loadDb();
      return db.runId === access.runId && db.clubs.some((club) => club.id === access.clubId && club.status !== "draft" && club.members.some((m) => m.id === access.memberId)) ? access : null;
    });
  } catch { return null; }
}

/** A pay link grants access to one contribution only, never treasurer actions. */
export function withPaymentAccount<C>(handler: (req: Request, context: C) => Promise<Response>) {
  const authenticated = withAccount(handler);
  return async (req: Request, context: C): Promise<Response> => {
    const token = req.headers.get("x-rotapot-pay-access");
    if (!token) return authenticated(req, context);
    const access = readPayAccess(token);
    if (!access) return Response.json({ error: "This pay link is invalid or expired." }, { status: 403 });
    if (req.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL!).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    return accountContext.run({ id: access.accountId, name: "Member checkout" }, async () => {
      const capture = new URL(req.url).pathname.match(/^\/api\/paypal\/orders\/([^/]+)\/capture$/);
      if (capture) {
        const club = loadDb().clubs.find((c) => c.id === access.clubId)!;
        const orderId = decodeURIComponent(capture[1]);
        if (!club.cycles.some((c) => c.contributions.some((payment) => payment.memberId === access.memberId && payment.paypalOrderId === orderId))) {
          return Response.json({ error: "Unknown payment." }, { status: 403 });
        }
      } else {
        let body;
        try { body = await req.clone().json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
        if (body.clubId !== access.clubId || body.memberId !== access.memberId) return Response.json({ error: "This link cannot access that contribution." }, { status: 403 });
      }
      return handler(req, context);
    });
  };
}
