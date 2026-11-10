"use client";

import Link from "next/link";
import type { BriefingNote, Club } from "@/lib/types";
import { firstName } from "./ui";

type Urgency = BriefingNote["urgency"];
const LABEL: Record<Urgency, string> = { needs_you: "Needs you", handled: "Handled", nothing: "Nothing yet" };
const RANK: Record<Urgency, number> = { needs_you: 0, handled: 1, nothing: 2 };

const dayMonth = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function daysLate(due: string) {
  const ms = Date.now() - new Date(`${due}T23:59:59Z`).getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

/** What changed in this circle after the briefing was written, from payment and payout timestamps. */
export function changesSince(club: Club, since: string): string[] {
  const t = Date.parse(since);
  if (Number.isNaN(t)) return [];
  const name = (id: string) => firstName(club.members.find((m) => m.id === id)?.name ?? "Someone");
  const out: string[] = [];
  for (const cycle of club.cycles) {
    for (const c of cycle.contributions) {
      if (c.paidAt && Date.parse(c.paidAt) > t && c.source !== "seed") out.push(`${name(c.memberId)} paid`);
    }
    if (cycle.payout.sentAt && Date.parse(cycle.payout.sentAt) > t) out.push(`US$${Number(cycle.payout.amount)} sent to ${name(cycle.recipientId)}`);
  }
  return out;
}

/** Live facts for the card headline. Never taken from the agent's text, so it can't go stale. */
function liveState(club: Club) {
  const cycle = club.cycles.find((c) => c.number === club.currentCycle)!;
  const paid = cycle.contributions.filter((c) => c.status === "paid").length;
  const total = cycle.contributions.length;
  const recipient = firstName(club.members.find((m) => m.id === cycle.recipientId)?.name ?? "");
  const pendingPlans = cycle.contributions.filter((c) => c.plan?.status === "pending").length;
  const awaiting = cycle.payout.status === "awaiting_approval";
  const late = paid < total ? daysLate(cycle.dueDate) : 0;
  const facts = awaiting
    ? `US$${Number(cycle.payout.amount)} ready for ${recipient}`
    : `${paid} of ${total} paid · ${late > 0 ? `${late}d overdue` : paid === total ? "everyone's in" : `due ${dayMonth(cycle.dueDate)}`}`;
  const action = awaiting ? "Review & release" : pendingPlans ? `Answer ${pendingPlans} plan request${pendingPlans > 1 ? "s" : ""}` : null;
  return { facts, action, needsYouNow: awaiting || pendingPlans > 0, late: late > 0 };
}

/**
 * The briefing as one card per circle: live status on top, the agent's note underneath,
 * anything that has happened since called out, and the one thing to do as a button.
 */
export default function BriefingCards({ notes, clubs, at }: { notes: BriefingNote[]; clubs: Club[]; at: string }) {
  const byId = new Map(notes.map((n) => [n.clubId, n]));
  const cards = clubs
    .filter((c) => c.status !== "draft")
    .map((club) => {
      const note = byId.get(club.id);
      const live = liveState(club);
      // Live state wins: a payout waiting for approval needs the treasurer whatever the note said.
      const urgency: Urgency = live.needsYouNow ? "needs_you" : note?.urgency ?? "nothing";
      return { club, note, live, urgency, since: changesSince(club, at) };
    })
    .sort((a, b) => RANK[a.urgency] - RANK[b.urgency]);

  return (
    <ol className="brief-cards">
      {cards.map(({ club, note, live, urgency, since }) => (
        <li key={club.id} className={`brief-card ${urgency}`}>
          <div className="brief-card-head">
            <span className={`brief-badge ${urgency}`}>{LABEL[urgency]}</span>
            <Link href={`/circles/${club.id}`} className="brief-card-name">{club.name}</Link>
            <span className={`brief-facts ${live.late ? "late" : ""}`}>{live.facts}</span>
          </div>
          {note && (note.did || note.next) ? (
            <p className="brief-note">
              {note.did && <span>{note.did} </span>}
              {note.next && <span className="brief-next">{note.next}</span>}
            </p>
          ) : !note ? (
            <p className="brief-note muted">Not in this briefing. Run it again to include this circle.</p>
          ) : null}
          {since.length > 0 && <p className="brief-since">Since this briefing: {since.join(", ")}.</p>}
          <Link href={`/circles/${club.id}`} className={live.action ? "brief-action primary" : "brief-action"}>
            {live.action ?? "Open"} →
          </Link>
        </li>
      ))}
    </ol>
  );
}
