import { withAccount } from "@/lib/authorize";
import { NextResponse } from "next/server";
import { approvePayout, proposePayout } from "@/lib/club";
import { fail } from "@/lib/http";

/**
 * Treasurer release. The agent has no tool that reaches this route.
 * `prepare: true` lets the treasurer put a fully paid pot up for approval themselves
 * (same check the agent's propose_payout runs), so a release never depends on the agent.
 */
async function handlePOST(req: Request) {
  try {
    const { clubId, prepare } = (await req.json()) as { clubId: string; prepare?: boolean };
    if (prepare) {
      const result = proposePayout(clubId, "Everyone has paid. Prepared by the treasurer.", "treasurer");
      if (!result.ok) throw new Error("error" in result ? String(result.error) : "The pot isn't ready yet.");
      return NextResponse.json(result);
    }
    return NextResponse.json(await approvePayout(clubId));
  } catch (err) {
    return fail(err);
  }
}

export const POST = withAccount(handlePOST);
