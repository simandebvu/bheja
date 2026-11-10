import { NextResponse } from "next/server";
import { decidePlan } from "@/lib/club";
import { fail } from "@/lib/http";

/** Treasurer approves or declines a payment plan the agent proposed. */
export async function POST(req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  try {
    const { memberId, approve } = (await req.json()) as { memberId: string; approve: boolean };
    return NextResponse.json(decidePlan(clubId, memberId, Boolean(approve)));
  } catch (err) {
    return fail(err);
  }
}
