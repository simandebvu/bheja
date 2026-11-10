import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { accountContext, currentAccount } from "./account-context";
import { findClub, findMember, loadDb, logActivity, updateClub, updateDb } from "./db";
import { sendEmail } from "./email";
import { payLink } from "./pay-access";
import { cleanEmail } from "./group-setup";
import type { Club, Member } from "./types";

type Invite = { ownerId: string; clubId: string; memberId: string; nonce: string; expires: number };
function sign(payload: string) {
  if (!process.env.BETTER_AUTH_SECRET) throw new Error("Authentication is not configured.");
  return createHmac("sha256", process.env.BETTER_AUTH_SECRET).update(`rotapot-invite:${payload}`).digest("base64url");
}
export function invitationLink(club: Club, member: Member) {
  if (!member.invite) return null;
  const payload = Buffer.from(JSON.stringify({ ownerId: currentAccount().id, clubId: club.id, memberId: member.id,
    nonce: member.invite.nonce, expires: member.invite.expiresAt } satisfies Invite)).toString("base64url");
  return `/join/${payload}.${sign(payload)}`;
}
export function resolveInvitation(token: string) {
  if (token.length > 4096) throw new Error("Invalid invitation.");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid invitation.");
  const expected = Buffer.from(sign(payload)), actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("Invalid invitation.");
  const invite = JSON.parse(Buffer.from(payload, "base64url").toString()) as Invite;
  if (!Number.isFinite(invite.expires) || invite.expires <= Date.now()) throw new Error("This invitation has expired. Ask your treasurer for a fresh one.");
  return accountContext.run({ id: invite.ownerId, name: "Invitation" }, () => {
    const club = findClub(loadDb(), invite.clubId);
    const member = findMember(club, invite.memberId);
    if (member.invite?.nonce !== invite.nonce) throw new Error("This invitation has been replaced. Use the latest email.");
    return { invite, club, member };
  });
}
export function invitationPreview(token: string) {
  const { club, member } = resolveInvitation(token);
  const [local, domain] = member.email!.split("@");
  return { name: club.name, kind: club.kind, purpose: club.purpose, treasurer: club.treasurerName,
    amount: club.contributionAmount, firstDue: club.firstDue, rules: club.rules, pot: (Number(club.contributionAmount) * club.members.length).toFixed(2),
    memberName: member.name, emailHint: `${local.slice(0, 1)}•••@${domain}`, turn: member.turn, joined: Boolean(member.joinedAt),
    members: club.members.map((m) => ({ name: m.name.split(" ")[0], turn: m.turn })) };
}
export async function sendInvitation(clubId: string, memberId: string) {
  let link = "", email = "", name = "", circle = "", message = "", nonce = "";
  updateClub(clubId, (club) => {
    if (club.status !== "draft") throw new Error("Invitations are managed before the circle launches.");
    const member = findMember(club, memberId);
    if (member.joinedAt) throw new Error("This person has already joined.");
    if (member.invite?.lastAttempt && Date.now() - member.invite.lastAttempt < 60000) throw new Error("Wait one minute before sending another invitation to this person.");
    if (!member.invite || member.invite.expiresAt <= Date.now()) member.invite = { nonce: randomUUID(), expiresAt: Date.now() + 7 * 86400000, status: "not_sent" };
    member.invite.status = "sending";
    member.invite.lastAttempt = Date.now();
    delete member.invite.error;
    link = invitationLink(club, member)!;
    email = member.email!; name = member.name; circle = club.name; nonce = member.invite.nonce;
    message = `${name}, ${club.treasurerName} has saved you a chair in ${circle}.\n\nUS$${Number(club.contributionAmount)} each month · ${club.members.length} people · a US$${Number(club.contributionAmount) * club.members.length} pot.\nYour turn is ${member.turn}. First contributions are due ${club.firstDue}.\n\nRead the rules and accept using your verified account for ${email}. This invitation expires in seven days. Payments currently use PayPal sandbox; no real money moves.`;
  });
  try {
    await sendEmail(email, `A chair for you in ${circle}`, message, new URL(link, process.env.BETTER_AUTH_URL!).href, "Meet my circle", `invite-${nonce}-${Math.floor(Date.now() / 60000)}`);
    updateClub(clubId, (club) => { const member = findMember(club, memberId); if (member.invite?.nonce === nonce) member.invite.status = "sent"; logActivity(club, "system", `Invitation emailed to ${name}.`); });
    return { ok: true };
  } catch {
    updateClub(clubId, (club) => { const member = findMember(club, memberId); if (member.invite?.nonce === nonce) { member.invite.status = "failed"; member.invite.error = "Email wasn't sent. Retry in a minute or share the private link."; } });
    throw new Error("Email wasn't sent. Retry in a minute or share the private link.");
  }
}
export function acceptInvitation(token: string, paypalEmail: unknown) {
  const user = currentAccount();
  const { invite, member } = resolveInvitation(token);
  if (!user.email || user.email.toLowerCase() !== member.email?.toLowerCase()) throw new Error("Sign in with the email address this invitation was sent to.");
  const payoutEmail = cleanEmail(paypalEmail);
  accountContext.run({ id: invite.ownerId, name: "Invitation" }, () => updateClub(invite.clubId, (club) => {
    const target = findMember(club, invite.memberId);
    if (target.userId && target.userId !== user.id) throw new Error("This invitation has already been accepted.");
    if (!target.joinedAt) {
      if (club.status !== "draft") throw new Error("This circle is no longer accepting members.");
      target.userId = user.id; target.joinedAt = new Date().toISOString(); target.paypalEmail = payoutEmail;
      logActivity(club, "system", `${target.name} accepted their seat and the circle rules.`);
    }
  }));
  return updateDb((db) => {
    db.memberships ??= [];
    const existing = db.memberships.find((m) => m.ownerId === invite.ownerId && m.clubId === invite.clubId && m.memberId === invite.memberId);
    if (existing) return existing.id;
    const entry = { id: randomUUID(), ownerId: invite.ownerId, clubId: invite.clubId, memberId: invite.memberId };
    db.memberships.push(entry);
    return entry.id;
  });
}
export function memberView(id: string) {
  const user = currentAccount();
  const entry = loadDb().memberships?.find((m) => m.id === id);
  if (!entry) throw new Error("Membership not found.");
  return accountContext.run({ id: entry.ownerId, name: "Member" }, () => {
    const club = findClub(loadDb(), entry.clubId);
    const member = findMember(club, entry.memberId);
    if (member.userId !== user.id) throw new Error("Membership is no longer available.");
    const cycle = club.cycles.find((c) => c.number === club.currentCycle);
    return { id, name: club.name, purpose: club.purpose, treasurer: club.treasurerName, amount: club.contributionAmount,
      status: club.status ?? "active", firstDue: club.firstDue, rules: club.rules, memberName: member.name, turn: member.turn,
      count: club.members.length, joined: club.members.filter((m) => m.joinedAt).length,
      cycle: cycle ? { number: cycle.number, dueDate: cycle.dueDate, paid: cycle.contributions.find((c) => c.memberId === member.id)?.status === "paid", recipient: findMember(club, cycle.recipientId).name } : null,
      schedule: club.cycles.map((c) => ({ number: c.number, dueDate: c.dueDate, name: findMember(club, c.recipientId).name, mine: c.recipientId === member.id, paidOut: c.payout.status === "sent" })),
      payUrl: club.status === "draft" ? null : payLink(club.id, member.id) };
  });
}
export function memberships() {
  return (loadDb().memberships ?? []).flatMap((entry) => {
    try { const view = memberView(entry.id); return [{ id: entry.id, name: view.name, status: view.status, amount: view.amount }]; } catch { return []; }
  });
}
