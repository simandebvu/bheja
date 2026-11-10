import Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent } from "./agent";

/** Shown to treasurers: plain words, no stack traces or env var names. Details go to the server log. */
const UNCHANGED = "Anything it finished is saved; nothing else changed.";
function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return `The agent couldn't sign in to its model service. ${UNCHANGED}`;
  if (err instanceof Anthropic.RateLimitError) return `The agent is busy right now. Try again in a minute. ${UNCHANGED}`;
  if (err instanceof Anthropic.APIError) return `The agent lost its connection part-way. Try again. ${UNCHANGED}`;
  return `The agent stopped part-way. Try again. ${UNCHANGED}`;
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
