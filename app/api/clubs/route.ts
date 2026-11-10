import { createCircle } from "@/lib/group-setup";
import { memberships } from "@/lib/invitations";
import { fail } from "@/lib/http";
import { withAccount } from "@/lib/authorize";
import { NextResponse } from "next/server";
import { loadDb } from "@/lib/db";
import { paypalConfigured } from "@/lib/paypal";
import { agentConfigured } from "@/lib/stream";

export const dynamic = "force-dynamic";

async function handleGET() {
  const db = loadDb();
  return NextResponse.json({ clubs: db.clubs, memberships: memberships(), briefing: db.briefing ?? null, paypalMode: paypalConfigured() ? "sandbox" : "mock", agentReady: agentConfigured() });
}

async function handlePOST(req: Request) {
  try { return NextResponse.json({ club: createCircle(await req.json()) }, { status: 201 }); }
  catch (error) { return fail(error); }
}

export const GET = withAccount(handleGET);
export const POST = withAccount(handlePOST);
