import type { Club } from "./types";

/**
 * The trust passport: a member's payment record across every circle they're in.
 * This is the data nobody else has: years of proof that someone with no credit
 * file pays, every month, on time.
 */

export type Dot = "on" | "late";

export interface CircleRecord {
  clubId: string;
  clubName: string;
  since: string;
  payments: number;
  onTime: number;
  late: number;
  streak: number;
  contributed: number;
  /** Most recent last. */
  dots: Dot[];
}

export interface Passport {
  name: string;
  since: string;
  payments: number;
  onTime: number;
  late: number;
  onTimeRate: number;
  streak: number;
  contributed: number;
  level: "Rock solid" | "Reliable" | "Mixed" | "Building";
  circles: CircleRecord[];
}

function sequence(onTime: number, late: number, seed: string): Dot[] {
  const n = onTime + late;
  const dots: Dot[] = Array(n).fill("on");
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  for (let k = 0; k < late; k++) {
    // spread late payments through the history, deterministically per member
    const slot = Math.floor(((k + 0.5) / late) * n);
    const jitter = ((h >> (k % 16)) % 5) - 2;
    let i = Math.min(n - 1, Math.max(0, slot + jitter));
    while (dots[i] === "late" && i < n - 1) i++;
    dots[i] = "late";
  }
  return dots;
}

function endStreak(dots: Dot[]) {
  let s = 0;
  for (let i = dots.length - 1; i >= 0 && dots[i] === "on"; i--) s++;
  return s;
}

function level(payments: number, rate: number): Passport["level"] {
  if (payments < 12) return "Building";
  if (rate >= 0.97) return "Rock solid";
  if (rate >= 0.9) return "Reliable";
  return "Mixed";
}

export function circleRecord(club: Club, memberId: string): CircleRecord | null {
  const m = club.members.find((x) => x.id === memberId);
  if (!m) return null;
  if (!m.history) {
    const paid = club.cycles.flatMap((cycle) => {
      const row = cycle.contributions.find((c) => c.memberId === memberId);
      return row?.status === "paid" ? [{ row, due: cycle.dueDate }] : [];
    });
    const dots: Dot[] = paid.map(({ row, due }) => row.paidAt && Date.parse(row.paidAt) > Date.parse(`${due}T23:59:59Z`) ? "late" : "on");
    const onTime = dots.filter((dot) => dot === "on").length;
    return { clubId: club.id, clubName: club.name, since: (m.joinedAt || club.createdAt || new Date().toISOString()).slice(0, 7), payments: dots.length, onTime, late: dots.length - onTime, streak: endStreak(dots), contributed: dots.length * Number(club.contributionAmount), dots };
  }
  const dots = sequence(m.history.onTime, m.history.late, `${club.id}:${m.id}`);
  const cycle = club.cycles.find((c) => c.number === club.currentCycle);
  const row = cycle?.contributions.find((c) => c.memberId === memberId);
  if (cycle && row?.status === "paid" && row.source !== "seed") {
    const due = new Date(`${cycle.dueDate}T23:59:59Z`).getTime();
    dots.push(row.paidAt && Date.parse(row.paidAt) > due ? "late" : "on");
  } else if (cycle && row?.status === "paid") {
    dots.push("on");
  }
  const onTime = dots.filter((d) => d === "on").length;
  return {
    clubId: club.id,
    clubName: club.name,
    since: m.history.since,
    payments: dots.length,
    onTime,
    late: dots.length - onTime,
    streak: endStreak(dots),
    contributed: dots.length * Number(club.contributionAmount),
    dots,
  };
}

export function passportFor(clubs: Club[], name: string): Passport {
  const circles = clubs
    .map((c) => {
      const m = c.members.find((x) => x.name === name);
      return m ? circleRecord(c, m.id) : null;
    })
    .filter((x): x is CircleRecord => Boolean(x));
  const payments = circles.reduce((s, c) => s + c.payments, 0);
  const onTime = circles.reduce((s, c) => s + c.onTime, 0);
  const rate = payments ? onTime / payments : 0;
  return {
    name,
    since: circles.map((c) => c.since).sort()[0] ?? "",
    payments,
    onTime,
    late: payments - onTime,
    onTimeRate: rate,
    streak: circles.length ? Math.min(...circles.map((c) => c.streak)) : 0,
    contributed: circles.reduce((s, c) => s + c.contributed, 0),
    level: level(payments, rate),
    circles,
  };
}

/** Totals across every member of every circle: the size of the record Rotapot holds. */
export function ledgerTotals(clubs: Club[]) {
  let payments = 0;
  let onTime = 0;
  let saved = 0;
  for (const club of clubs) {
    for (const m of club.members) {
      const r = circleRecord(club, m.id);
      if (!r) continue;
      payments += r.payments;
      onTime += r.onTime;
      saved += r.contributed;
    }
  }
  return { payments, onTime, saved, rate: payments ? onTime / payments : 0 };
}

export function sinceLabel(since: string) {
  return new Date(`${since}-01T12:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
