import { NextResponse } from "next/server";
import { loadDb, resetDb } from "@/lib/db";
import { paypalConfigured } from "@/lib/paypal";
import { agentConfigured } from "@/lib/stream";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = loadDb();
  return NextResponse.json({ clubs: db.clubs, briefing: db.briefing ?? null, paypalMode: paypalConfigured() ? "sandbox" : "mock", agentReady: agentConfigured() });
}

/** POST resets all demo data, including the briefing. */
export async function POST() {
  resetDb();
  return NextResponse.json({ ok: true });
}
