import { NextResponse } from "next/server";
import { startContribution } from "@/lib/club";
import { fail } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const { memberId } = (await req.json()) as { memberId: string };
    return NextResponse.json(await startContribution(memberId));
  } catch (err) {
    return fail(err);
  }
}
