import fs from "node:fs";
import path from "node:path";
import type { ActivityItem, Club, Cycle, Member } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

const members: Member[] = [
  { id: "tendai", name: "Tendai Moyo", city: "Harare", language: "Shona", paypalEmail: "tendai@example.com", turn: 1 },
  { id: "sipho", name: "Sipho Dlamini", city: "Durban", language: "isiZulu", paypalEmail: "sipho@example.com", turn: 2 },
  { id: "rudo", name: "Rudo Chikwanha", city: "Johannesburg", language: "Shona", paypalEmail: "rudo@example.com", turn: 3 },
  { id: "thandiwe", name: "Thandiwe Ncube", city: "Bulawayo", language: "Ndebele", paypalEmail: "thandiwe@example.com", turn: 4 },
  { id: "lerato", name: "Lerato Mokoena", city: "Pretoria", language: "Sesotho", paypalEmail: "lerato@example.com", turn: 5 },
  { id: "nyasha", name: "Nyasha Mutasa", city: "London", language: "English", paypalEmail: "nyasha@example.com", turn: 6 },
];

function makeCycle(number: number, dueDate: string, recipientId: string, paidIds: string[], sent: boolean): Cycle {
  return {
    number,
    dueDate,
    recipientId,
    contributions: members.map((m) =>
      paidIds.includes(m.id)
        ? { memberId: m.id, status: "paid", paidAt: dueDate, source: "seed" }
        : { memberId: m.id, status: "unpaid" },
    ),
    payout: sent
      ? { status: "sent", recipientId, amount: "300.00", sentAt: dueDate }
      : { status: "none", recipientId, amount: "300.00" },
  };
}

export function seedClub(): Club {
  const all = members.map((m) => m.id);
  return {
    id: "ubuntu-circle",
    name: "Ubuntu Circle Mukando",
    currency: "USD",
    contributionAmount: "50.00",
    treasurerName: "Rudo",
    rules: [
      "Each member contributes US$50 by the 7th of every month.",
      "The full pot (US$300) is paid out to one member per month, in rotation order.",
      "A payout is only released once every member has paid, and only after the treasurer approves it.",
      "Contributions more than 3 days late get a friendly reminder; more than 7 days late, the treasurer is told.",
    ],
    members,
    currentCycle: 3,
    cycles: [
      makeCycle(1, "2026-09-07", "tendai", all, true),
      makeCycle(2, "2026-10-07", "sipho", all, true),
      makeCycle(3, "2026-11-07", "rudo", ["tendai", "rudo", "nyasha"], false),
      makeCycle(4, "2026-12-07", "thandiwe", [], false),
      makeCycle(5, "2027-01-07", "lerato", [], false),
      makeCycle(6, "2027-02-07", "nyasha", [], false),
    ],
    outbox: [],
    activity: [
      { at: "2026-10-07T18:00:00Z", kind: "payout", text: "Cycle 2 payout of US$300 sent to Sipho Dlamini." },
      { at: "2026-11-05T09:12:00Z", kind: "payment", text: "Tendai Moyo paid US$50 for cycle 3." },
      { at: "2026-11-06T20:40:00Z", kind: "payment", text: "Nyasha Mutasa paid US$50 for cycle 3." },
      { at: "2026-11-07T07:03:00Z", kind: "payment", text: "Rudo Chikwanha paid US$50 for cycle 3." },
    ],
  };
}

export function loadClub(): Club {
  if (!fs.existsSync(DB_PATH)) {
    const club = seedClub();
    saveClub(club);
    return club;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Club;
}

export function saveClub(club: Club): void {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(club, null, 2));
}

export function resetClub(): Club {
  const club = seedClub();
  saveClub(club);
  return club;
}

/** Load, mutate, save. Single-process demo store; fine for a hackathon. */
export function updateClub<T>(fn: (club: Club) => T): T {
  const club = loadClub();
  const result = fn(club);
  saveClub(club);
  return result;
}

export function currentCycle(club: Club): Cycle {
  const cycle = club.cycles.find((c) => c.number === club.currentCycle);
  if (!cycle) throw new Error(`Cycle ${club.currentCycle} not found`);
  return cycle;
}

export function findMember(club: Club, memberId: string): Member {
  const m = club.members.find((x) => x.id === memberId);
  if (!m) throw new Error(`Unknown member "${memberId}"`);
  return m;
}

export function logActivity(club: Club, kind: ActivityItem["kind"], text: string): void {
  club.activity.push({ at: new Date().toISOString(), kind, text });
}
