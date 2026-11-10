import Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent } from "./agent";

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The agent's API key was rejected. Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "The agent is rate-limited right now. Try again in a moment.";
  if (err instanceof Anthropic.APIError) return `The model returned an error: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

export function agentConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * Streams newline-delimited JSON: progress events while the agent works, then
 * one {type:"reply"} or {type:"error"} line. If the viewer disconnects the run
 * still completes, so actions (reminders, proposals) never stop half-way.
 */
export function agentStream(run: (send: (e: AgentEvent) => void) => Promise<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (obj: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          open = false;
        }
      };
      try {
        const result = await run(send);
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
    cancel() { /* viewer left; run keeps going and stops sending */ },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
