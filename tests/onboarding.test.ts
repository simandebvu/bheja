import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getAuth } from "../lib/auth";
import { accountContext } from "../lib/account-context";
import { loadDb, resetDb, updateClub } from "../lib/db";
import { monthlyDates } from "../lib/group-setup";
import { invitationLink, memberView, memberships, resolveInvitation } from "../lib/invitations";
import { mockContribution, proposePayout, approvePayout } from "../lib/club";
import { circleRecord } from "../lib/passport";
import { safeNext } from "../lib/auth-navigation";
import { POST as createRoute } from "../app/api/clubs/route";
import { POST as setupRoute } from "../app/api/clubs/[clubId]/setup/route";
import { GET as previewRoute, POST as acceptRoute } from "../app/api/join/[token]/route";
import { GET as memberRoute } from "../app/api/members/[id]/route";

const origin = "http://localhost:3000";
test("organizer signs up, creates a circle, invites a verified member, launches and completes a rotation", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "rotapot-onboarding-"));
  Object.assign(process.env, { BETTER_AUTH_SECRET: randomBytes(48).toString("hex"), BETTER_AUTH_URL: origin,
    AUTH_DB_PATH: path.join(directory, "auth.sqlite"), ACCOUNT_DATA_DIR: path.join(directory, "accounts"),
    RESEND_API_KEY: "test-key", RESEND_FROM: "Rotapot <accounts@example.com>", PAYPAL_CLIENT_ID: "", PAYPAL_CLIENT_SECRET: "" });
  const originalFetch = globalThis.fetch;
  const emails: { to: string[]; text: string; html: string }[] = [];
  let deliveryFails = false;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails", "tests must not call real services");
    if (deliveryFails) return Response.json({}, { status: 503 });
    emails.push(JSON.parse(String(init?.body)));
    return Response.json({ id: "test-email" });
  };
  try {
    const auth = await getAuth();
    const request = (route: string, cookie: string, body?: unknown) => new Request(`${origin}${route}`, {
      method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie }, ...(body ? { body: JSON.stringify(body) } : {}) });
    async function register(name: string, email: string) {
      const credentials = { name, email, password: "a sufficiently long test password" };
      const result = await auth.handler(request("/api/auth/sign-up/email", "", credentials));
      assert.equal(result.status, 200);
      const verify = emails.at(-1)!.text.match(/http[^\s]+/)![0];
      assert.equal((await auth.handler(new Request(verify))).status, 302);
      const signedIn = await auth.handler(request("/api/auth/sign-in/email", "", credentials));
      assert.equal(signedIn.status, 200);
      const cookie = signedIn.headers.getSetCookie().map((s) => s.split(";")[0]).join("; ");
      const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
      assert.ok(session);
      return { cookie, user: session.user };
    }
    const owner = await register("Tariro", "tariro@example.com");
    const guest = await register("Ayanda", "ayanda@example.com");
    assert.equal(accountContext.run(owner.user, () => loadDb().clubs.length), 0);
    const firstDue = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
    const input = { name: "Sunday Sisters", kind: "Stokvel", purpose: "School fees together", contributionAmount: "50.25", firstDue,
      customRule: "Please ask early if you need more time.", members: [
        { name: "Tariro", email: owner.user.email, city: "Harare", language: "Shona" },
        { name: "Ayanda", email: guest.user.email, city: "Durban", language: "isiZulu" },
      ] };
    assert.equal((await createRoute(request("/api/clubs", "", input), undefined)).status, 401);
    assert.equal((await createRoute(request("/api/clubs", owner.cookie, { ...input, members: [input.members[0], input.members[0]] }), undefined)).status, 400);
    assert.equal((await createRoute(request("/api/clubs", owner.cookie, { ...input, contributionAmount: "-20" }), undefined)).status, 400);
    assert.equal((await createRoute(request("/api/clubs", owner.cookie, { ...input, firstDue: "2000-01-01" }), undefined)).status, 400);
    const created = await createRoute(request("/api/clubs", owner.cookie, input), undefined);
    assert.equal(created.status, 201);
    const { club } = await created.json();
    assert.equal(club.status, "draft"); assert.equal(club.cycles.length, 0);
    assert.ok(club.members[0].joinedAt); assert.equal(club.members[1].joinedAt, undefined);
    const context = { params: Promise.resolve({ clubId: club.id }) };
    const setup = (cookie: string, action: string, extra = {}) => setupRoute(request(`/api/clubs/${club.id}/setup`, cookie, { action, ...extra }), context);
    assert.equal((await setup(owner.cookie, "launch")).status, 400);
    assert.equal((await setup(guest.cookie, "invite", { memberId: club.members[1].id })).status, 400, "another account cannot manage this circle");
    assert.throws(() => accountContext.run(owner.user, () => mockContribution(club.id, club.members[0].id)), /not launched/);
    deliveryFails = true;
    assert.equal((await setup(owner.cookie, "invite", { memberId: club.members[1].id })).status, 400);
    accountContext.run(owner.user, () => updateClub(club.id, (c) => { assert.equal(c.members[1].invite?.status, "failed"); c.members[1].invite!.lastAttempt = 0; }));
    deliveryFails = false;
    assert.equal((await setup(owner.cookie, "invite", { memberId: club.members[1].id })).status, 200);
    const email = emails.at(-1)!;
    assert.equal(email.to[0], guest.user.email); assert.match(email.html, /Meet my circle/);
    const url = email.text.match(/http[^\s]+/)![0];
    const token = new URL(url).pathname.split("/").pop()!;
    const inviteContext = { params: Promise.resolve({ token }) };
    const preview = await previewRoute(request(`/api/join/${token}`, ""), inviteContext);
    assert.equal(preview.status, 200);
    const previewBody = await preview.json();
    assert.equal(previewBody.pot, "100.50"); assert.equal(JSON.stringify(previewBody).includes(guest.user.email), false);
    assert.throws(() => resolveInvitation(token + "x"), /Invalid/);
    const accept = (cookie: string, acceptRules = true) => acceptRoute(request(`/api/join/${token}`, cookie, { acceptRules, paypalEmail: "sandbox-ayanda@example.com" }), inviteContext);
    assert.equal((await accept(owner.cookie)).status, 400, "invite requires the intended verified email");
    assert.equal((await accept(guest.cookie, false)).status, 400);
    const accepted = await accept(guest.cookie); assert.equal(accepted.status, 200);
    const { id } = await accepted.json();
    assert.equal((await (await accept(guest.cookie)).json()).id, id, "acceptance is idempotent");
    const view = accountContext.run(guest.user, () => memberView(id));
    assert.equal(view.payUrl, null); assert.equal(view.joined, 2);
    assert.equal((await memberRoute(request(`/api/members/${id}`, owner.cookie), { params: Promise.resolve({ id }) })).status, 404);
    assert.equal(accountContext.run(guest.user, () => memberships().length), 1);
    accountContext.run(owner.user, resetDb);
    assert.equal(accountContext.run(owner.user, () => loadDb().clubs.find((c) => c.id === club.id)?.name), input.name, "sample refresh preserves real circles");
    const launched = await setup(owner.cookie, "launch"); assert.equal(launched.status, 200);
    const launchedClub = (await launched.json()).club;
    assert.equal(launchedClub.cycles.length, 2); assert.equal(launchedClub.cycles[0].payout.amount, "100.50");
    assert.ok(accountContext.run(guest.user, () => memberView(id).payUrl));
    assert.equal((await setup(owner.cookie, "launch")).status, 400, "cannot double-launch");
    assert.equal((await setup(owner.cookie, "edit", { circle: input })).status, 400, "agreed rotation locks at launch");
    await accountContext.run(owner.user, async () => {
      for (let round = 1; round <= 2; round++) {
        for (const member of club.members) mockContribution(club.id, member.id);
        assert.equal(loadDb().clubs.find((c) => c.id === club.id)!.cycles[round - 1].payout.status, "awaiting_approval", "full pots become approvable without an AI call");
        assert.equal(proposePayout(club.id, "Every member has paid").ok, true);
        await approvePayout(club.id);
      }
      const completed = loadDb().clubs.find((c) => c.id === club.id)!;
      assert.equal(completed.cycles.filter((c) => c.payout.status === "sent").length, 2);
      assert.equal(circleRecord(completed, club.members[1].id)?.payments, 2, "new-member passport counts actual paid rounds");
    });
    const newDraft = (await (await createRoute(request("/api/clubs", owner.cookie, input), undefined)).json()).club;
    const oldLink = accountContext.run(owner.user, () => invitationLink(newDraft, newDraft.members[1])!);
    const oldToken = oldLink.split("/").pop()!;
    const revised = await setupRoute(request(`/api/clubs/${newDraft.id}/setup`, owner.cookie, { action: "edit", circle: { ...input, name: "New promise" } }), { params: Promise.resolve({ clubId: newDraft.id }) });
    assert.equal(revised.status, 200); assert.throws(() => resolveInvitation(oldToken), /Unknown member|replaced/);
    const expiryClub = accountContext.run(owner.user, () => updateClub(newDraft.id, (c) => { c.members[1].invite!.expiresAt = Date.now() - 1; return c; }));
    const expired = accountContext.run(owner.user, () => invitationLink(expiryClub, expiryClub.members[1])!);
    assert.throws(() => resolveInvitation(expired.split("/").pop()!), /expired/);
    assert.deepEqual(monthlyDates("2028-01-31", 3), ["2028-01-31", "2028-02-29", "2028-03-31"]);
    assert.equal(safeNext("//evil.example"), "/circles"); assert.equal(safeNext("/join/test"), "/join/test");
    assert.equal(safeNext("/circles/\\evil.example"), "/circles");
  } finally { globalThis.fetch = originalFetch; rmSync(directory, { recursive: true, force: true }); }
});
