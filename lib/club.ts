/** Domain actions shared by the API routes and the agent's tools. */
import { randomUUID } from "node:crypto";
import { currentCycle, findClub, findMember, loadClub, loadDb, logActivity, updateClub, updateDb } from "./db";
import { payoutMessage, receiptMessage } from "./messages";
import * as paypal from "./paypal";
import type { Club, Language, MessageKind } from "./types";

const REMINDER_COOLDOWN_MS = 12 * 60 * 60 * 1000;

export function daysLate(dueDate: string, now = new Date()): number {
  const ms = now.getTime() - new Date(`${dueDate}T23:59:59Z`).getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

const first = (name: string) => name.split(" ")[0];

function pushMessage(club: Club, memberId: string, language: Language, message: string, kind: MessageKind) {
  const nudge = {
    id: randomUUID(),
    memberId,
    language,
    message,
    kind,
    channel: "whatsapp" as const,
    createdAt: new Date().toISOString(),
  };
  club.outbox.push(nudge);
  return nudge;
}

/** One-line state of every circle, for the briefing and the home page. */
export function overview() {
  return loadDb().clubs.map((club) => {
    const cycle = currentCycle(club);
    const unpaid = cycle.contributions.filter((c) => c.status !== "paid");
    const late = daysLate(cycle.dueDate);
    return {
      club_id: club.id,
      name: club.name,
      kind: club.kind,
      cycle: `${cycle.number} of ${club.cycles.length}`,
      due_date: cycle.dueDate,
      days_late: unpaid.length ? late : 0,
      members_paid: `${club.members.length - unpaid.length}/${club.members.length}`,
      still_to_pay: unpaid.map((c) => findMember(club, c.memberId).name),
      payout_recipient: findMember(club, cycle.recipientId).name,
      pot: cycle.payout.amount,
      payout_status: cycle.payout.status,
    };
  });
}

export function statusSummary(clubId: string) {
  const club = loadClub(clubId);
  const cycle = currentCycle(club);
  const recipient = findMember(club, cycle.recipientId);
  const now = Date.now();
  const rows = cycle.contributions.map((c) => {
    const m = findMember(club, c.memberId);
    const lastReminder = [...club.outbox].reverse().find((n) => n.memberId === m.id && n.kind === "reminder");
    return {
      member_id: m.id,
      name: m.name,
      city: m.city,
      language: m.language,
      status: c.status,
      days_late: c.status === "paid" ? 0 : daysLate(cycle.dueDate),
      reminded_recently: Boolean(lastReminder && now - Date.parse(lastReminder.createdAt) < REMINDER_COOLDOWN_MS),
      verified_with_paypal: c.source === "paypal",
    };
  });
  const paid = rows.filter((r) => r.status === "paid").length;
  return {
    club_id: club.id,
    club: club.name,
    kind: club.kind,
    today: new Date().toISOString().slice(0, 10),
    contribution_amount: club.contributionAmount,
    rules: club.rules,
    cycle: cycle.number,
    total_cycles: club.cycles.length,
    due_date: cycle.dueDate,
    payout_recipient: { member_id: recipient.id, name: recipient.name },
    pot_collected: (paid * Number(club.contributionAmount)).toFixed(2),
    pot_target: cycle.payout.amount,
    members_paid: `${paid}/${rows.length}`,
    contributions: rows,
    payout_status: cycle.payout.status,
  };
}

function markPaid(club: Club, memberId: string, source: "paypal" | "mock", captureId?: string) {
  const cycle = currentCycle(club);
  const row = cycle.contributions.find((x) => x.memberId === memberId);
  if (!row) throw new Error(`Unknown member "${memberId}"`);
  row.status = "paid";
  row.paidAt = new Date().toISOString();
  row.source = source;
  if (captureId) row.paypalCaptureId = captureId;
  const m = findMember(club, memberId);
  logActivity(club, "payment", `${m.name} paid US$${club.contributionAmount}${source === "paypal" ? ` via PayPal (capture ${captureId ?? "n/a"})` : " (mock mode)"}.`);
  pushMessage(club, m.id, m.language, receiptMessage(m.language, first(m.name), club.contributionAmount), "receipt");
}

/** Create a PayPal order for a member's contribution in the current cycle. */
export async function startContribution(clubId: string, memberId: string): Promise<{ orderId: string }> {
  const club = loadClub(clubId);
  const cycle = currentCycle(club);
  const member = findMember(club, memberId);
  const contribution = cycle.contributions.find((c) => c.memberId === memberId)!;
  if (contribution.status === "paid") throw new Error(`${member.name} has already paid for cycle ${cycle.number}.`);

  const order = await paypal.createOrder({
    amount: club.contributionAmount,
    customId: `${club.id}:${cycle.number}:${memberId}`,
    description: `${club.name} - cycle ${cycle.number} contribution (${member.name})`,
  });
  updateClub(clubId, (c) => {
    const row = currentCycle(c).contributions.find((x) => x.memberId === memberId)!;
    row.status = "pending";
    row.paypalOrderId = order.id;
  });
  return { orderId: order.id };
}

/** Capture an approved PayPal order and mark the contribution as paid. */
export async function completeContribution(orderId: string) {
  const order = await paypal.captureOrder(orderId);
  if (order.status !== "COMPLETED") throw new Error(`Order ${orderId} not completed (status ${order.status}).`);
  const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  return updateDb((db) => {
    for (const club of db.clubs) {
      const row = currentCycle(club).contributions.find((x) => x.paypalOrderId === orderId);
      if (row) {
        if (row.status !== "paid") markPaid(club, row.memberId, "paypal", captureId);
        return { clubId: club.id, memberId: row.memberId, captureId };
      }
    }
    throw new Error(`No contribution matches order ${orderId}.`);
  });
}

/** Mock-mode payment so the demo works without PayPal credentials. */
export function mockContribution(clubId: string, memberId: string) {
  updateClub(clubId, (club) => {
    const row = currentCycle(club).contributions.find((x) => x.memberId === memberId);
    if (!row) throw new Error(`Unknown member "${memberId}"`);
    if (row.status !== "paid") markPaid(club, memberId, "mock");
  });
}

/** Ask PayPal for the truth about a member's contribution, and reconcile. */
export async function verifyContribution(clubId: string, memberId: string) {
  const club = loadClub(clubId);
  const row = currentCycle(club).contributions.find((x) => x.memberId === memberId);
  if (!row) throw new Error(`Unknown member "${memberId}"`);
  if (!row.paypalOrderId) {
    return { member_id: memberId, status: row.status, paypal: "No PayPal checkout on record for this cycle." };
  }
  if (!paypal.paypalConfigured()) return { member_id: memberId, status: row.status, paypal: "mock mode" };
  const order = await paypal.getOrder(row.paypalOrderId);
  if (order.status === "APPROVED" && row.status !== "paid") {
    // Buyer approved but we never captured (e.g. they closed the tab). Capture now.
    await completeContribution(row.paypalOrderId);
    return { member_id: memberId, status: "paid", paypal: "Checkout was approved but not captured; captured it now." };
  }
  return { member_id: memberId, status: row.status, paypal_status: order.status };
}

export function addReminder(clubId: string, memberId: string, message: string, language: Language) {
  return updateClub(clubId, (club) => {
    const m = findMember(club, memberId);
    const row = currentCycle(club).contributions.find((c) => c.memberId === memberId);
    if (row?.status === "paid") throw new Error(`${m.name} has already paid this cycle; no reminder needed.`);
    const last = [...club.outbox].reverse().find((n) => n.memberId === memberId && n.kind === "reminder");
    if (last && Date.now() - Date.parse(last.createdAt) < REMINDER_COOLDOWN_MS) {
      throw new Error(`${m.name} was already reminded within the last 12 hours; not sending a duplicate.`);
    }
    const nudge = pushMessage(club, memberId, language, message, "reminder");
    logActivity(club, "nudge", `Reminder sent to ${m.name} (${language}).`);
    return nudge;
  });
}

/** Agent may only PROPOSE a payout; a human must approve before money moves. */
export function proposePayout(clubId: string, reason: string) {
  return updateClub(clubId, (club) => {
    const cycle = currentCycle(club);
    const unpaid = cycle.contributions.filter((c) => c.status !== "paid").map((c) => findMember(club, c.memberId).name);
    if (unpaid.length) return { ok: false, error: `Not ready: still waiting on ${unpaid.join(", ")}.` };
    if (cycle.payout.status === "sent") return { ok: false, error: "This cycle's payout was already sent." };
    if (cycle.payout.status === "awaiting_approval") return { ok: true, already_waiting: true };
    cycle.payout = { ...cycle.payout, status: "awaiting_approval", proposedReason: reason, proposedAt: new Date().toISOString() };
    const r = findMember(club, cycle.recipientId);
    logActivity(club, "agent", `Agent proposed releasing US$${cycle.payout.amount} to ${r.name}. Waiting for treasurer approval.`);
    return { ok: true, awaiting_approval: true, recipient: r.name, amount: cycle.payout.amount };
  });
}

/** Called only from the treasurer's Release button, never by the agent. */
export async function approvePayout(clubId: string) {
  const club = loadClub(clubId);
  const cycle = currentCycle(club);
  if (cycle.payout.status !== "awaiting_approval") throw new Error("No payout is waiting for approval.");
  const recipient = findMember(club, cycle.recipientId);
  const note = `${club.name}: your cycle ${cycle.number} payout of US$${cycle.payout.amount}.`;
  const senderBatchId = `${club.id}-cycle-${cycle.number}`;

  let batchId = `MOCK-${senderBatchId}`;
  let batchStatus = "SUCCESS";
  if (paypal.paypalConfigured()) {
    const receiver = process.env.PAYPAL_PAYOUT_RECEIVER_OVERRIDE || recipient.paypalEmail;
    const batch = await paypal.createPayout({ senderBatchId, receiver, amount: cycle.payout.amount, note });
    batchId = batch.batch_header.payout_batch_id;
    batchStatus = batch.batch_header.batch_status;
  }

  return updateClub(clubId, (c) => {
    const cy = currentCycle(c);
    cy.payout = { ...cy.payout, status: "sent", paypalBatchId: batchId, paypalBatchStatus: batchStatus, sentAt: new Date().toISOString() };
    logActivity(c, "payout", `Treasurer released US$${cy.payout.amount} to ${recipient.name} via PayPal Payouts (batch ${batchId}).`);
    pushMessage(c, recipient.id, recipient.language, payoutMessage(recipient.language, first(recipient.name), cy.payout.amount), "payout");
    let next: string | null = null;
    if (c.currentCycle < c.cycles.length) {
      c.currentCycle += 1;
      next = findMember(c, currentCycle(c).recipientId).name;
      logActivity(c, "system", `Cycle ${c.currentCycle} started. Next payout goes to ${next}.`);
    }
    return { batchId, batchStatus, recipient: recipient.name, amount: cy.payout.amount, next };
  });
}

export async function refreshPayoutStatus(clubId: string, cycleNumber?: number) {
  const club = loadClub(clubId);
  const cycle = club.cycles.find((c) => c.number === (cycleNumber ?? club.currentCycle));
  if (!cycle) throw new Error("Unknown cycle");
  const p = cycle.payout;
  if (!p.paypalBatchId || p.paypalBatchId.startsWith("MOCK") || !paypal.paypalConfigured()) {
    return { cycle: cycle.number, status: p.status, paypal_batch_status: p.paypalBatchStatus ?? null };
  }
  const batch = await paypal.getPayout(p.paypalBatchId);
  updateClub(clubId, (c) => {
    c.cycles.find((x) => x.number === cycle.number)!.payout.paypalBatchStatus = batch.batch_header.batch_status;
  });
  return { cycle: cycle.number, status: p.status, paypal_batch_status: batch.batch_header.batch_status };
}

export { findClub };
