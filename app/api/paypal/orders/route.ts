import { NextResponse } from "next/server";
import { startContribution } from "@/lib/club";
import { fail } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const { clubId, memberId } = (await req.json()) as { clubId: string; memberId: string };
    return NextResponse.json(await startContribution(clubId, memberId));
  } catch (err) {
    return fail(err);
  }
}
