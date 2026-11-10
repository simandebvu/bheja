import { NextResponse } from "next/server";
import { mockContribution } from "@/lib/club";
import { fail } from "@/lib/http";
import { paypalConfigured } from "@/lib/paypal";

export async function POST(req: Request) {
  if (paypalConfigured()) return fail("Mock payments are disabled when PayPal sandbox is configured.", 403);
  try {
    const { clubId, memberId } = (await req.json()) as { clubId: string; memberId: string };
    mockContribution(clubId, memberId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
