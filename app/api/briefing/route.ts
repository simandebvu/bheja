import { NextResponse } from "next/server";
import { BRIEFING_PROMPT, runAgent } from "@/lib/agent";
import { loadDb, updateDb } from "@/lib/db";
import { baseUrl, fail } from "@/lib/http";
import { agentConfigured, agentStream } from "@/lib/stream";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** The last briefing, if any. */
export async function GET() {
  return NextResponse.json({ briefing: loadDb().briefing ?? null });
}

/** Run the agent across every circle, streaming its steps, and keep the result. */
export async function POST(req: Request) {
  if (!agentConfigured()) return fail("The agent needs an API key. Add ANTHROPIC_API_KEY and restart.", 503);
  const origin = baseUrl(req);
  return agentStream(async (send) => {
    const result = await runAgent([{ role: "user", content: BRIEFING_PROMPT }], origin, send);
    const briefing = { at: new Date().toISOString(), reply: result.reply, steps: result.actions };
    updateDb((db) => { db.briefing = briefing; });
    return { reply: result.reply, actions: result.actions, at: briefing.at };
  });
}
