import { withAccount } from "@/lib/authorize";
import { NextResponse } from "next/server";
import { approvePayout } from "@/lib/club";
import { fail } from "@/lib/http";

/** Treasurer release. The agent has no tool that reaches this route. */
async function handlePOST(req: Request) {
  try {
    const { clubId } = (await req.json()) as { clubId: string };
    return NextResponse.json(await approvePayout(clubId));
  } catch (err) {
    return fail(err);
  }
}

export const POST = withAccount(handlePOST);
