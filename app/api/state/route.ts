import { NextResponse } from "next/server";
import { loadClub, resetClub } from "@/lib/db";
import { paypalConfigured } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    club: loadClub(),
    paypalMode: paypalConfigured() ? "sandbox" : "mock",
    agentReady: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  });
}

/** POST resets the demo data. */
export async function POST() {
  return NextResponse.json({ club: resetClub() });
}
