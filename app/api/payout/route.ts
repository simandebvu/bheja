import { NextResponse } from "next/server";
import { approvePayout } from "@/lib/club";
import { fail } from "@/lib/http";

/** Treasurer approval. The agent has no tool that reaches this route. */
export async function POST() {
  try {
    return NextResponse.json(await approvePayout());
  } catch (err) {
    return fail(err);
  }
}
