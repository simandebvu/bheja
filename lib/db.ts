import fs from "node:fs";
import path from "node:path";
import type { ActivityItem, Club, Cycle, Db, Member } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "db.json");

type Seat = Omit<Member, "turn" | "paypalEmail">;

function seatMembers(seats: Seat[], domain = "example.com"): Member[] {
  return seats.map((s, i) => ({ ...s, turn: i + 1, paypalEmail: `${s.id}@${domain}` }));
}

function cycles(members: Member[], amount: string, dueDates: string[], current: number, paidNow: string[]): Cycle[] {
  const pot = (members.length * Number(amount)).toFixed(2);
  return members.map((m, i) => {
    const number = i + 1;
    const past = number < current;
    const isCurrent = number === current;
    return {
      number,
      dueDate: dueDates[i],
      recipientId: m.id,
      contributions: members.map((x) =>
        past || (isCurrent && paidNow.includes(x.id))
          ? { memberId: x.id, status: "paid" as const, paidAt: dueDates[i], source: "seed" as const }
          : { memberId: x.id, status: "unpaid" as const },
      ),
      payout: past
        ? { status: "sent" as const, recipientId: m.id, amount: pot, sentAt: dueDates[i] }
        : { status: "none" as const, recipientId: m.id, amount: pot },
    };
  });
}

function monthly(firstDue: string, n: number): string[] {
  const [y, mo, d] = firstDue.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(Date.UTC(y, mo - 1 + i, d));
    return date.toISOString().slice(0, 10);
  });
}

function ubuntuCircle(): Club {
  const members = seatMembers([
    { id: "tendai", name: "Tendai Moyo", city: "Harare", language: "Shona" },
    { id: "sipho", name: "Sipho Dlamini", city: "Durban", language: "isiZulu" },
    { id: "rudo", name: "Rudo Chikwanha", city: "Johannesburg", language: "Shona" },
    { id: "thandiwe", name: "Thandiwe Ncube", city: "Bulawayo", language: "Ndebele" },
    { id: "lerato", name: "Lerato Mokoena", city: "Pretoria", language: "Sesotho" },
    { id: "nyasha", name: "Nyasha Mutasa", city: "London", language: "English" },
  ]);
  return {
    id: "ubuntu-circle",
    name: "Ubuntu Circle",
    kind: "Mukando",
    purpose: "Friends from varsity, now spread across three countries, taking turns with a US$300 pot.",
    currency: "USD",
    contributionAmount: "50.00",
    treasurerName: "Rudo",
    rules: [
      "Each member contributes US$50 by the 7th of every month.",
      "The full pot is paid out to one member per month, in rotation order.",
      "A payout is only released once every member has paid, and only after the treasurer approves it.",
      "Anyone who misses the due date gets a friendly reminder in their own language; after 7 days late, the treasurer is told.",
    ],
    members,
    currentCycle: 3,
    cycles: cycles(members, "50.00", monthly("2026-09-07", 6), 3, ["tendai", "rudo", "nyasha"]),
    outbox: [],
    activity: [
      { at: "2026-10-07T18:00:00Z", kind: "payout", text: "Cycle 2 payout of US$300 sent to Sipho Dlamini." },
      { at: "2026-11-05T09:12:00Z", kind: "payment", text: "Tendai Moyo paid US$50 for cycle 3." },
      { at: "2026-11-06T20:40:00Z", kind: "payment", text: "Nyasha Mutasa paid US$50 for cycle 3." },
      { at: "2026-11-07T07:03:00Z", kind: "payment", text: "Rudo Chikwanha paid US$50 for cycle 3." },
    ],
  };
}

function leicesterRound(): Club {
  const members = seatMembers([
    { id: "chipo", name: "Chipo Banda", city: "Dallas", language: "Shona" },
    { id: "farai", name: "Farai Chikore", city: "Leicester", language: "Shona" },
    { id: "tatenda", name: "Tatenda Mhlanga", city: "Dublin", language: "English" },
    { id: "rudo", name: "Rudo Chikwanha", city: "Johannesburg", language: "Shona" },
    { id: "nkosana", name: "Nkosana Sibanda", city: "Bulawayo", language: "Ndebele" },
  ]);
  return {
    id: "leicester-round",
    name: "Leicester Diaspora Round",
    kind: "Diaspora round",
    purpose: "Zimbabweans abroad pooling US$500 a month so each can finish building back home.",
    currency: "USD",
    contributionAmount: "100.00",
    treasurerName: "Rudo",
    rules: [
      "Each member contributes US$100 by the 5th of every month.",
      "The full pot goes to one member per month, in rotation order, to fund building at home.",
      "A payout is only released once every member has paid, and only after the treasurer approves it.",
      "Anyone who misses the due date gets a friendly reminder.",
    ],
    members,
    currentCycle: 2,
    cycles: cycles(members, "100.00", monthly("2026-10-05", 5), 2, members.map((m) => m.id)),
    outbox: [],
    activity: [
      { at: "2026-10-06T19:30:00Z", kind: "payout", text: "Cycle 1 payout of US$500 sent to Chipo Banda." },
      { at: "2026-11-01T08:15:00Z", kind: "payment", text: "Tatenda Mhlanga paid US$100 for cycle 2." },
      { at: "2026-11-03T21:02:00Z", kind: "payment", text: "Farai Chikore paid US$100 for cycle 2." },
      { at: "2026-11-04T06:44:00Z", kind: "payment", text: "Chipo Banda paid US$100 for cycle 2." },
      { at: "2026-11-04T12:10:00Z", kind: "payment", text: "Rudo Chikwanha paid US$100 for cycle 2." },
      { at: "2026-11-05T17:55:00Z", kind: "payment", text: "Nkosana Sibanda paid US$100 for cycle 2." },
    ],
  };
}

function sowetoStokvel(): Club {
  const members = seatMembers([
    { id: "nomsa", name: "Nomsa Khumalo", city: "Soweto", language: "isiZulu" },
    { id: "palesa", name: "Palesa Molefe", city: "Soweto", language: "Sesotho" },
    { id: "kgomotso", name: "Kgomotso Seleka", city: "Mahikeng", language: "Setswana" },
    { id: "thandeka", name: "Thandeka Zulu", city: "Durban", language: "isiZulu" },
    { id: "rudo", name: "Rudo Chikwanha", city: "Johannesburg", language: "Shona" },
    { id: "busi", name: "Busi Nkosi", city: "Soweto", language: "isiZulu" },
    { id: "zanele", name: "Zanele Dube", city: "London", language: "English" },
    { id: "mpho", name: "Mpho Tau", city: "Pretoria", language: "Setswana" },
  ]);
  return {
    id: "soweto-stokvel",
    name: "Soweto Mothers' Stokvel",
    kind: "Stokvel",
    purpose: "Eight mothers, one pot a month: school fees, a fridge, a deposit. Running since 2019.",
    currency: "USD",
    contributionAmount: "30.00",
    treasurerName: "Rudo",
    rules: [
      "Each member contributes US$30 by the 25th of every month.",
      "The pot goes to one member per month, in rotation order.",
      "A payout is only released once every member has paid, and only after the treasurer approves it.",
      "No reminders before the due date; anyone late gets a friendly reminder in their own language.",
    ],
    members,
    currentCycle: 5,
    cycles: cycles(members, "30.00", monthly("2026-07-25", 8), 5, ["nomsa", "zanele"]),
    outbox: [],
    activity: [
      { at: "2026-10-25T18:20:00Z", kind: "payout", text: "Cycle 4 payout of US$240 sent to Thandeka Zulu." },
      { at: "2026-11-02T10:05:00Z", kind: "payment", text: "Nomsa Khumalo paid US$30 for cycle 5." },
      { at: "2026-11-08T22:31:00Z", kind: "payment", text: "Zanele Dube paid US$30 for cycle 5." },
    ],
  };
}

export function seedDb(): Db {
  return { version: 2, clubs: [ubuntuCircle(), leicesterRound(), sowetoStokvel()] };
}

export function loadDb(): Db {
  if (fs.existsSync(DB_PATH)) {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    if (raw?.version === 2) return raw as Db;
  }
  const db = seedDb();
  saveDb(db);
  return db;
}

export function saveDb(db: Db): void {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

export function resetDb(): Db {
  const db = seedDb();
  saveDb(db);
  return db;
}

export function updateDb<T>(fn: (db: Db) => T): T {
  const db = loadDb();
  const result = fn(db);
  saveDb(db);
  return result;
}

export function findClub(db: Db, clubId: string): Club {
  const club = db.clubs.find((c) => c.id === clubId);
  if (!club) throw new Error(`Unknown circle "${clubId}"`);
  return club;
}

export function loadClub(clubId: string): Club {
  return findClub(loadDb(), clubId);
}

/** Load, mutate one club, save. Single-process demo store; fine for a hackathon. */
export function updateClub<T>(clubId: string, fn: (club: Club) => T): T {
  return updateDb((db) => fn(findClub(db, clubId)));
}

export function currentCycle(club: Club): Cycle {
  const cycle = club.cycles.find((c) => c.number === club.currentCycle);
  if (!cycle) throw new Error(`Cycle ${club.currentCycle} not found`);
  return cycle;
}

export function findMember(club: Club, memberId: string): Member {
  const m = club.members.find((x) => x.id === memberId);
  if (!m) throw new Error(`Unknown member "${memberId}" in ${club.name}`);
  return m;
}

export function logActivity(club: Club, kind: ActivityItem["kind"], text: string): void {
  club.activity.push({ at: new Date().toISOString(), kind, text });
}
