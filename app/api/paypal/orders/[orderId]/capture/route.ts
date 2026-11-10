import { NextResponse } from "next/server";
import { completeContribution } from "@/lib/club";
import { fail } from "@/lib/http";

export async function POST(_req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    return NextResponse.json(await completeContribution(orderId));
  } catch (err) {
    return fail(err);
  }
}
