import { memberMessagePrompt, runAgent } from "@/lib/agent";
import { recordInbound } from "@/lib/club";
import { loadClub } from "@/lib/db";
import { baseUrl, fail } from "@/lib/http";
import { agentConfigured, agentStream } from "@/lib/stream";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** A member replies on WhatsApp (simulated in the phone view); the agent handles it. */
export async function POST(req: Request, { params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  if (!agentConfigured()) return fail("The agent needs an API key.", 503);
  let memberId: string;
  let text: string;
  try {
    ({ memberId, text } = (await req.json()) as { memberId: string; text: string });
    text = String(text ?? "").trim().slice(0, 600);
    if (!text) throw new Error("Message is empty");
  } catch (err) {
    return fail(err);
  }
  let member;
  try {
    ({ member } = recordInbound(clubId, memberId, text));
  } catch (err) {
    return fail(err, 404);
  }
  const club = loadClub(clubId);
  const prompt = memberMessagePrompt({ name: member.name, language: member.language, club: club.name, text, today: new Date().toISOString().slice(0, 10) });
  const origin = baseUrl(req);
  return agentStream((send) => runAgent([{ role: "user", content: prompt }], origin, send, { clubId }));
}
