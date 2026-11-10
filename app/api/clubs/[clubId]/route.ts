import { NextResponse } from "next/server";
import { loadDb } from "@/lib/db";
import { fail } from "@/lib/http";
import { paypalConfigured } from "@/lib/paypal";
import { agentConfigured } from "@/lib/stream";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const club = loadDb().clubs.find((c) => c.id === clubId);
  if (!club) return fail("Unknown circle", 404);
  return NextResponse.json({ club, paypalMode: paypalConfigured() ? "sandbox" : "mock", agentReady: agentConfigured() });
}
