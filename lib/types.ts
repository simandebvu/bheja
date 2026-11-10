export type Language = "English" | "Shona" | "Ndebele" | "isiZulu" | "Sesotho" | "Setswana";
export const LANGUAGES: Language[] = ["English", "Shona", "Ndebele", "isiZulu", "Sesotho", "Setswana"];

export interface Member {
  id: string;
  name: string;
  city: string;
  language: Language;
  paypalEmail: string;
  /** Position in the payout rotation (1-based). */
  turn: number;
  /** Payment record in this circle before the current cycle (seeded for the demo). */
  history?: { since: string; onTime: number; late: number; lateAt?: number[] };
}

export interface Instalment {
  amount: string;
  due: string;
  paid?: boolean;
}

export interface PaymentPlan {
  status: "pending" | "approved" | "declined";
  instalments: Instalment[];
  reason: string;
  requestedAt: string;
}

export type ContributionStatus = "unpaid" | "pending" | "paid";

export interface Contribution {
  memberId: string;
  status: ContributionStatus;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paidAt?: string;
  /** Seeded rows from before the app existed have no PayPal record. */
  source?: "paypal" | "mock" | "seed";
  /** Money received so far this cycle (for instalment plans). */
  paidAmount?: number;
  /** Amount of the checkout currently open with PayPal. */
  pendingAmount?: string;
  plan?: PaymentPlan;
}

export type PayoutStatus = "none" | "awaiting_approval" | "sent" | "failed";

export interface Payout {
  status: PayoutStatus;
  recipientId: string;
  amount: string;
  proposedReason?: string;
  proposedAt?: string;
  paypalBatchId?: string;
  paypalBatchStatus?: string;
  sentAt?: string;
  error?: string;
}

export interface Cycle {
  number: number;
  dueDate: string; // ISO date
  recipientId: string;
  contributions: Contribution[];
  payout: Payout;
}

export type MessageKind = "reminder" | "receipt" | "payout" | "agent" | "member" | "plan";

export interface Nudge {
  id: string;
  memberId: string;
  language: Language;
  message: string;
  kind: MessageKind;
  /** "in" = the member wrote to the circle; default "out". */
  direction?: "in" | "out";
  channel: "whatsapp";
  createdAt: string;
}

export interface ActivityItem {
  at: string;
  kind: "payment" | "nudge" | "payout" | "agent" | "system";
  text: string;
}

export interface Club {
  id: string;
  name: string;
  /** What kind of circle this is, in the members' own words. */
  kind: string;
  purpose: string;
  currency: "USD";
  contributionAmount: string; // e.g. "50.00"
  rules: string[];
  treasurerName: string;
  members: Member[];
  currentCycle: number;
  cycles: Cycle[];
  outbox: Nudge[];
  activity: ActivityItem[];
}

export interface BriefingStep {
  tool: string;
  input: Record<string, unknown>;
  ok: boolean;
  summary: string;
}

export interface Briefing {
  at: string;
  reply: string;
  steps: BriefingStep[];
}

export interface Db {
  version: 2;
  /** Changes on every demo reset, so PayPal batch ids stay unique across runs. */
  runId?: string;
  clubs: Club[];
  briefing?: Briefing;
}
