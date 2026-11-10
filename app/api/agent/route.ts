import Anthropic from "@anthropic-ai/sdk";
import { runAgent, type AgentEvent, type ChatTurn } from "@/lib/agent";
import { baseUrl, fail } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The agent's API key was rejected. Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "The agent is rate-limited right now. Try again in a moment.";
  if (err instanceof Anthropic.APIError) return `The model returned an error: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

/**
 * Streams newline-delimited JSON: progress events while the agent works,
 * then one {type:"reply"} or {type:"error"} line.
 */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return fail("The agent needs an API key. Add ANTHROPIC_API_KEY to .env.local and restart.", 503);
  }
  let history: ChatTurn[];
  try {
    ({ history } = (await req.json()) as { history: ChatTurn[] });
    if (!Array.isArray(history) || history.length === 0) throw new Error("history is required");
  } catch (err) {
    return fail(err);
  }

  const origin = baseUrl(req);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // If the viewer disconnects, keep going: the agent's actions (reminders,
      // payout proposals) should complete rather than stop half-way.
      let open = true;
      const send = (obj: AgentEvent | Record<string, unknown>) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          open = false;
        }
      };
      try {
        const result = await runAgent(history.slice(-20), origin, send);
        send({ type: "reply", ...result });
      } catch (err) {
        console.error("[rotapot] agent failed:", err);
        send({ type: "error", message: describeError(err) });
      } finally {
        if (open) {
          try { controller.close(); } catch { /* already closed */ }
        }
      }
    },
    cancel() {
      /* viewer went away; start() keeps running and stops sending */
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
