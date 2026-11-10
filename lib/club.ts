/** Domain actions shared by the API routes and the agent's tools. */
import { currentCycle, findMember, loadClub, logActivity, updateClub } from "./db";
import * as paypal from "./paypal";
import type { Club, Language } from "./types";

const TODAY = () => new Date();

export function daysLate(dueDate: string, now = TODAY()): number {
  const ms = now.getTime() - new Date(`${dueDate}T23:59:59Z`).getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

export function statusSummary(club: Club = loadClub()) {
  const cycle = currentCycle(club);
  const recipient = findMember(club, cycle.recipientId);
  const rows = cycle.contributions.map((c) => {
    const m = findMember(club, c.memberId);
    return {
      member_id: m.id,
      name: m.name,
      city: m.city,
      language: m.language,
      status: c.status,
      days_late: c.status === "paid" ? 0 : daysLate(cycle.dueDate),
      paid_at: c.paidAt ?? null,
      verified_with_paypal: c.source === "paypal",
    };
  });
  const paid = rows.filter((r) => r.status === "paid").length;
  return {
    club: club.name,
    today: TODAY().toISOString().slice(0, 10),
    currency: club.currency,
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
    payout: cycle.payout,
    recent_nudges: club.outbox.slice(-10).map((n) => ({ member_id: n.memberId, at: n.createdAt, message: n.message })),
  };
}

/** Create a PayPal order for a member's contribution in the current cycle. */
export async function startContribution(memberId: string): Promise<{ orderId: string }> {
  const club = loadClub();
  const cycle = currentCycle(club);
  const member = findMember(club, memberId);
  const contribution = cycle.contributions.find((c) => c.memberId === memberId)!;
  if (contribution.status === "paid") throw new Error(`${member.name} has already paid for cycle ${cycle.number}.`);

  const order = await paypal.createOrder({
    amount: club.contributionAmount,
    customId: `${club.id}:${cycle.number}:${memberId}`,
    description: `${club.name} - cycle ${cycle.number} contribution (${member.name})`,
  });
  updateClub((c) => {
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
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  return updateClub((club) => {
    const cycle = currentCycle(club);
    const row = cycle.contributions.find((x) => x.paypalOrderId === orderId);
    if (!row) throw new Error(`No contribution matches order ${orderId}.`);
    row.status = "paid";
    row.paypalCaptureId = capture?.id;
    row.paidAt = new Date().toISOString();
    row.source = "paypal";
    const m = findMember(club, row.memberId);
    logActivity(club, "payment", `${m.name} paid US$${club.contributionAmount} via PayPal (capture ${capture?.id ?? "n/a"}).`);
    return { memberId: row.memberId, captureId: capture?.id };
  });
}

/** Mock-mode payment so the demo works without PayPal credentials. */
export function mockContribution(memberId: string) {
  return updateClub((club) => {
    const row = currentCycle(club).contributions.find((x) => x.memberId === memberId);
    if (!row) throw new Error(`Unknown member "${memberId}"`);
    row.status = "paid";
    row.paidAt = new Date().toISOString();
    row.source = "mock";
    logActivity(club, "payment", `${findMember(club, memberId).name} paid US$${club.contributionAmount} (mock mode).`);
  });
}

/** Ask PayPal for the truth about a member's contribution, and reconcile. */
export async function verifyContribution(memberId: string) {
  const club = loadClub();
  const row = currentCycle(club).contributions.find((x) => x.memberId === memberId);
  if (!row) throw new Error(`Unknown member "${memberId}"`);
  if (!row.paypalOrderId) {
    return { member_id: memberId, status: row.status, paypal: "no PayPal order on record", source: row.source ?? null };
  }
  if (!paypal.paypalConfigured()) return { member_id: memberId, status: row.status, paypal: "mock mode" };
  const order = await paypal.getOrder(row.paypalOrderId);
  if (order.status === "APPROVED" && row.status !== "paid") {
    // Buyer approved but we never captured (e.g. tab closed). Capture now.
    await completeContribution(row.paypalOrderId);
    return { member_id: memberId, status: "paid", paypal: "APPROVED -> captured now" };
  }
  return { member_id: memberId, status: row.status, paypal_order_id: order.id, paypal_status: order.status };
}

export function addNudge(memberId: string, message: string, language: Language) {
  return updateClub((club) => {
    const m = findMember(club, memberId);
    const nudge = {
      id: `n_${Date.now().toString(36)}`,
      memberId,
      language,
      message,
      channel: "whatsapp" as const,
      createdAt: new Date().toISOString(),
    };
    club.outbox.push(nudge);
    logActivity(club, "nudge", `Reminder queued for ${m.name} (${language}).`);
    return nudge;
  });
}

/** Agent may only PROPOSE a payout; a human must approve before money moves. */
export function proposePayout(reason: string) {
  return updateClub((club) => {
    const cycle = currentCycle(club);
    const unpaid = cycle.contributions.filter((c) => c.status !== "paid").map((c) => findMember(club, c.memberId).name);
    if (unpaid.length) {
      return { ok: false, error: `Cannot propose payout: still waiting on ${unpaid.join(", ")}.` };
    }
    if (cycle.payout.status === "sent") return { ok: false, error: "Payout for this cycle was already sent." };
    cycle.payout = {
      ...cycle.payout,
      status: "awaiting_approval",
      proposedReason: reason,
      proposedAt: new Date().toISOString(),
    };
    const r = findMember(club, cycle.recipientId);
    logActivity(club, "agent", `Agent proposed releasing US$${cycle.payout.amount} to ${r.name}. Waiting for treasurer approval.`);
    return { ok: true, awaiting_approval: true, recipient: r.name, amount: cycle.payout.amount };
  });
}

/** Called only from the treasurer's Approve button, never by the agent. */
export async function approvePayout() {
  const club = loadClub();
  const cycle = currentCycle(club);
  if (cycle.payout.status !== "awaiting_approval") throw new Error("No payout is awaiting approval.");
  const recipient = findMember(club, cycle.recipientId);
  const note = `${club.name}: your cycle ${cycle.number} payout of US$${cycle.payout.amount}. Siyabonga / Tatenda!`;
  const senderBatchId = `${club.id}-cycle-${cycle.number}`;

  let batchId = `MOCK-${senderBatchId}`;
  let batchStatus = "SUCCESS";
  if (paypal.paypalConfigured()) {
    const receiver = process.env.PAYPAL_PAYOUT_RECEIVER_OVERRIDE || recipient.paypalEmail;
    const batch = await paypal.createPayout({ senderBatchId, receiver, amount: cycle.payout.amount, note });
    batchId = batch.batch_header.payout_batch_id;
    batchStatus = batch.batch_header.batch_status;
  }

  return updateClub((c) => {
    const cy = currentCycle(c);
    cy.payout = { ...cy.payout, status: "sent", paypalBatchId: batchId, paypalBatchStatus: batchStatus, sentAt: new Date().toISOString() };
    logActivity(c, "payout", `Treasurer approved. US$${cy.payout.amount} sent to ${recipient.name} via PayPal Payouts (batch ${batchId}, ${batchStatus}).`);
    if (c.currentCycle < c.cycles.length) {
      c.currentCycle += 1;
      logActivity(c, "system", `Cycle ${c.currentCycle} started. Next payout goes to ${findMember(c, currentCycle(c).recipientId).name}.`);
    }
    return { batchId, batchStatus };
  });
}

export async function refreshPayoutStatus(cycleNumber?: number) {
  const club = loadClub();
  const cycle = club.cycles.find((c) => c.number === (cycleNumber ?? club.currentCycle));
  if (!cycle) throw new Error("Unknown cycle");
  const p = cycle.payout;
  if (!p.paypalBatchId || p.paypalBatchId.startsWith("MOCK") || !paypal.paypalConfigured()) {
    return { cycle: cycle.number, status: p.status, paypal_batch_status: p.paypalBatchStatus ?? null };
  }
  const batch = await paypal.getPayout(p.paypalBatchId);
  updateClub((c) => {
    const cy = c.cycles.find((x) => x.number === cycle.number)!;
    cy.payout.paypalBatchStatus = batch.batch_header.batch_status;
  });
  return { cycle: cycle.number, status: p.status, paypal_batch_id: p.paypalBatchId, paypal_batch_status: batch.batch_header.batch_status };
}
