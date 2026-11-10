import { randomUUID } from "node:crypto";
import { currentAccount } from "./account-context";
import { loadDb, logActivity, updateClub, updateDb } from "./db";
import { LANGUAGES, type Club, type Member } from "./types";

export function cleanText(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`${label} is required (up to ${max} characters).`);
  return value.trim();
}
export function cleanEmail(value: unknown) {
  const email = cleanText(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address for each person.");
  return email;
}
export function validateDue(value: unknown) {
  const date = cleanText(value, "First contribution date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error("Choose a valid first contribution date.");
  const today = new Date().toISOString().slice(0, 10);
  if (date < today || Date.parse(date) > Date.now() + 366 * 86400000) throw new Error("Choose a first contribution date between today and one year from now.");
  return date;
}
/** Calendar months retain the chosen day, clamped for shorter months. */
export function monthlyDates(first: string, count: number) {
  const [year, month, day] = first.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const last = new Date(Date.UTC(year, month + i, 0)).getUTCDate();
    return new Date(Date.UTC(year, month - 1 + i, Math.min(day, last))).toISOString().slice(0, 10);
  });
}
function buildCircle(input: unknown): Club {
  if (!input || typeof input !== "object") throw new Error("Tell us about your circle.");
  const data = input as Record<string, unknown>;
  const name = cleanText(data.name, "Circle name", 80);
  const kind = cleanText(data.kind, "Circle type", 40);
  if (!["Stokvel", "Mukando", "Diaspora round", "Savings circle"].includes(kind)) throw new Error("Choose a circle type.");
  const purpose = cleanText(data.purpose, "Your shared goal", 300);
  const amount = String(data.contributionAmount ?? "");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(amount) || Number(amount) < 1 || Number(amount) > 10000) throw new Error("Choose a monthly contribution from US$1 to US$10,000, with at most two decimals.");
  const firstDue = validateDue(data.firstDue);
  if (!Array.isArray(data.members) || data.members.length < 2 || data.members.length > 20) throw new Error("A circle needs 2–20 people, including you.");
  const owner = currentAccount();
  const emails = new Set<string>();
  const members: Member[] = data.members.map((raw, i) => {
    if (!raw || typeof raw !== "object") throw new Error("Check each member's details.");
    const email = cleanEmail(raw.email);
    if (emails.has(email)) throw new Error("Each chair needs a different email address.");
    emails.add(email);
    if (!LANGUAGES.includes(raw.language)) throw new Error("Choose a supported language for each member.");
    const isOwner = email === owner.email?.toLowerCase();
    return { id: randomUUID(), name: cleanText(raw.name, "Member name", 80), email, paypalEmail: isOwner && raw.paypalEmail ? cleanEmail(raw.paypalEmail) : email,
      city: cleanText(raw.city, "City", 80), language: raw.language, turn: i + 1,
      ...(isOwner ? { userId: owner.id, joinedAt: new Date().toISOString() } : {}),
      invite: { nonce: randomUUID(), expiresAt: Date.now() + 7 * 86400000, status: "not_sent" },
    };
  });
  if (!owner.email || !emails.has(owner.email.toLowerCase())) throw new Error("Include yourself using your account email address.");
  const customRule = typeof data.customRule === "string" ? data.customRule.trim() : "";
  if (customRule.length > 600) throw new Error("Keep your extra rule under 600 characters.");
  const club: Club = { id: randomUUID(), name, kind, purpose, currency: "USD", contributionAmount: Number(amount).toFixed(2),
    status: "draft", sample: false, firstDue, createdAt: new Date().toISOString(), treasurerName: owner.name,
    rules: [`Everyone contributes US$${Number(amount)} each month, starting ${firstDue}.`,
      "The full pot goes to one person each month, in the agreed rotation order.",
      "The treasurer can release a pot only after every contribution is paid.",
      "Late contributors receive a friendly reminder in their preferred language.", ...(customRule ? [customRule] : [])],
    members, currentCycle: 1, cycles: [], outbox: [], activity: [],
  };
  logActivity(club, "system", `${owner.name} created the circle. Waiting for everyone to join.`);
  return club;
}
export function createCircle(input: unknown) {
  const club = buildCircle(input);
  updateDb((db) => { if (db.clubs.filter((c) => !c.sample).length >= 20) throw new Error("You can manage up to 20 circles."); db.clubs.push(club); });
  return club;
}
export function reviseCircle(clubId: string, input: unknown) {
  const revised = buildCircle(input);
  return updateDb((db) => {
    const index = db.clubs.findIndex((c) => c.id === clubId);
    if (index < 0 || db.clubs[index].status !== "draft") throw new Error("You can only edit a circle before it launches.");
    revised.id = clubId;
    db.clubs[index] = revised;
    return revised;
  });
}
export function launchCircle(clubId: string, firstDue?: unknown) {
  return updateClub(clubId, (club) => {
    if (club.status !== "draft") throw new Error("This circle has already launched.");
    if (club.members.some((m) => !m.joinedAt)) throw new Error("Everyone needs to accept their invitation before you launch.");
    // The agreed date cannot silently change after members have accepted.
    const due = validateDue(firstDue ?? club.firstDue);
    if (due !== club.firstDue) throw new Error("The launch date must match the date your members agreed to.");
    const dates = monthlyDates(due, club.members.length);
    const pot = (Math.round(Number(club.contributionAmount) * 100) * club.members.length / 100).toFixed(2);
    club.cycles = club.members.map((member, i) => ({ number: i + 1, dueDate: dates[i], recipientId: member.id,
      contributions: club.members.map((m) => ({ memberId: m.id, status: "unpaid" })),
      payout: { status: "none", recipientId: member.id, amount: pot } }));
    club.status = "active";
    logActivity(club, "system", `The circle is complete. Round one starts with ${club.members[0].name}.`);
    return club;
  });
}
export function deleteDraft(clubId: string) {
  updateDb((db) => {
    const club = db.clubs.find((c) => c.id === clubId);
    if (!club || club.status !== "draft") throw new Error("Only a circle that hasn't launched can be cancelled.");
    db.clubs = db.clubs.filter((c) => c.id !== clubId);
  });
}
