export type Language = "English" | "Shona" | "Ndebele" | "isiZulu" | "Sesotho";

export interface Member {
  id: string;
  name: string;
  city: string;
  language: Language;
  paypalEmail: string;
  /** Position in the payout rotation (1-based). */
  turn: number;
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

export interface Nudge {
  id: string;
  memberId: string;
  language: Language;
  message: string;
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
