import { NextResponse } from "next/server";
import { approvePayout } from "@/lib/club";
import { fail } from "@/lib/http";

/** Treasurer release. The agent has no tool that reaches this route. */
export async function POST(req: Request) {
  try {
    const { clubId } = (await req.json()) as { clubId: string };
    return NextResponse.json(await approvePayout(clubId));
  } catch (err) {
    return fail(err);
  }
}
