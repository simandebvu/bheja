import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { runAgent, type ChatTurn } from "@/lib/agent";
import { baseUrl, fail } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return fail("The agent needs a Claude API key. Add ANTHROPIC_API_KEY to .env.local and restart.", 503);
  }
  try {
    const { history } = (await req.json()) as { history: ChatTurn[] };
    if (!Array.isArray(history) || history.length === 0) return fail("history is required");
    const result = await runAgent(history.slice(-20), baseUrl(req));
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return fail("Claude API key missing or invalid. Set ANTHROPIC_API_KEY in .env.local.", 401);
    if (err instanceof Anthropic.RateLimitError) return fail("Claude is rate-limited right now; try again in a moment.", 429);
    if (err instanceof Anthropic.APIError) return fail(`Claude API error: ${err.message}`, 502);
    return fail(err, 500);
  }
}
