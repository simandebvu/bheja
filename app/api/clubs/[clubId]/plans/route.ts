import { withAccount } from "@/lib/authorize";
import { NextResponse } from "next/server";
import { decidePlan } from "@/lib/club";
import { fail } from "@/lib/http";

/** Treasurer approves or declines a payment plan the agent proposed. */
async function handlePOST(req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  try {
    const { memberId, approve } = (await req.json()) as { memberId: string; approve: boolean };
    return NextResponse.json(decidePlan(clubId, memberId, Boolean(approve)));
  } catch (err) {
    return fail(err);
  }
}

export const POST = withAccount(handlePOST);
