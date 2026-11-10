import { runAgent, type ChatTurn } from "@/lib/agent";
import { loadDb } from "@/lib/db";
import { baseUrl, fail } from "@/lib/http";
import { agentConfigured, agentStream } from "@/lib/stream";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!agentConfigured()) return fail("The agent needs an API key. Add ANTHROPIC_API_KEY and restart.", 503);
  let history: ChatTurn[];
  let clubId: string | undefined;
  try {
    ({ history, clubId } = (await req.json()) as { history: ChatTurn[]; clubId?: string });
    if (!Array.isArray(history) || history.length === 0) throw new Error("history is required");
    if (clubId && !loadDb().clubs.some((c) => c.id === clubId)) throw new Error("Unknown circle");
  } catch (err) {
    return fail(err);
  }
  const origin = baseUrl(req);
  return agentStream((send) => runAgent(history.slice(-20), origin, send, { clubId }));
}
