import { invitationLink } from "@/lib/invitations";
import { payLink } from "@/lib/pay-access";
import { withAccount } from "@/lib/authorize";
import { NextResponse } from "next/server";
import { loadDb } from "@/lib/db";
import { fail } from "@/lib/http";
import { paypalConfigured } from "@/lib/paypal";
import { agentConfigured } from "@/lib/stream";

export const dynamic = "force-dynamic";

async function handleGET(_req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const club = loadDb().clubs.find((c) => c.id === clubId);
  if (!club) return fail("Unknown circle", 404);
  return NextResponse.json({ club, payLinks: club.status === "draft" ? {} : Object.fromEntries(club.members.map((m) => [m.id, payLink(club.id, m.id)])), inviteLinks: Object.fromEntries(club.members.filter((m) => !m.joinedAt && m.invite).map((m) => [m.id, invitationLink(club, m)])), paypalMode: paypalConfigured() ? "sandbox" : "mock", agentReady: agentConfigured() });
}

export const GET = withAccount(handleGET);
