import Anthropic from "@anthropic-ai/sdk";
import { addReminder, overview, proposePayout, refreshPayoutStatus, statusSummary, verifyContribution } from "./club";
import { loadClub, loadDb } from "./db";
import { LANGUAGES, type Language } from "./types";

// Point ANTHROPIC_BASE_URL at an Anthropic-compatible gateway (e.g. a LiteLLM
// proxy) to route through it; the SDK reads that variable automatically.
const MODEL = process.env.AGENT_MODEL || "claude-opus-4-8";
const VIA_GATEWAY = Boolean(process.env.ANTHROPIC_BASE_URL);
const MAX_STEPS = 14;

const SYSTEM = `You are Rotapot, the AI treasurer's assistant for rotating savings circles (stokvels in South Africa, mukando or rounds in Zimbabwe and the diaspora). You work for the treasurer, Rudo, and you speak to her directly as "you". She runs several circles. Members pay a fixed monthly amount through PayPal; each month the whole pot goes to one member in rotation.

What you do:
- Keep each circle's books straight and explain them plainly and warmly.
- Spot who is late and send friendly reminders, following each circle's own rules (some circles say no reminders before the due date).
- Write reminders in the member's own language (English, Shona, Ndebele, isiZulu, Sesotho or Setswana): short, like a WhatsApp message, with the amount, due date and {{PAY_LINK}}. Kind, never shaming. After a non-English reminder add a blank line and a one-line English translation starting "EN:".
- As soon as every member of a circle has paid, call propose_payout yourself without asking. Proposing moves no money; it puts the payout in front of you (Rudo) to release.

Hard rules:
- You never move money. Only Rudo can release a payout, in the app.
- Use tools for facts; never guess who has paid. If a member says they paid but the books disagree, verify_payment before answering.
- Never show internal identifiers (club_id, member_id, message or order IDs) or tool names in your replies. Use people's names and circle names.
- Don't recite the circle's rules back unless asked.
- Replies are short: at most 4 sentences, or a short list of at most 5 items. No headings.`;

const clubIds = () => loadDb().clubs.map((c) => c.id);

function tools(): Anthropic.Tool[] {
  const club_id = { type: "string" as const, enum: clubIds(), description: "Which circle." };
  return [
    {
      name: "list_circles",
      description: "One line per circle Rudo runs: cycle, due date, who still has to pay, days late, who receives the pot, payout status. Start here for anything spanning circles.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "get_circle",
      description: "Full detail for one circle's current cycle: rules, every member's status, days late, language, and whether they were reminded in the last 12 hours.",
      input_schema: { type: "object", properties: { club_id }, required: ["club_id"], additionalProperties: false },
    },
    {
      name: "verify_payment",
      description: "Check a member's contribution against PayPal (Orders API). If PayPal shows an approved checkout that was never captured, this captures it and marks them paid.",
      input_schema: { type: "object", properties: { club_id, member_id: { type: "string" } }, required: ["club_id", "member_id"], additionalProperties: false },
    },
    {
      name: "send_reminder",
      description: "Send a WhatsApp-style payment reminder to one member in their language. Put {{PAY_LINK}} where their personal PayPal link goes. Refuses if they already paid or were reminded in the last 12 hours.",
      input_schema: {
        type: "object",
        properties: {
          club_id,
          member_id: { type: "string" },
          language: { type: "string", enum: LANGUAGES },
          message: { type: "string" },
        },
        required: ["club_id", "member_id", "language", "message"],
        additionalProperties: false,
      },
    },
    {
      name: "propose_payout",
      description: "Put this cycle's payout in front of Rudo for release. Refuses unless every member has paid. Moves no money.",
      input_schema: {
        type: "object",
        properties: { club_id, reason: { type: "string", description: "One short sentence for Rudo on why it's ready." } },
        required: ["club_id", "reason"],
        additionalProperties: false,
      },
    },
    {
      name: "check_payout_status",
      description: "Check a payout with PayPal Payouts. Defaults to the current cycle; pass an earlier cycle number for one already sent.",
      input_schema: { type: "object", properties: { club_id, cycle: { type: "integer" } }, required: ["club_id"], additionalProperties: false },
    },
  ];
}

export interface AgentAction {
  tool: string;
  input: Record<string, unknown>;
  ok: boolean;
  summary: string;
}

async function runTool(name: string, input: Record<string, unknown>, baseUrl: string): Promise<{ result: unknown; summary: string }> {
  const clubId = String(input.club_id ?? "");
  const clubName = () => loadClub(clubId).name;
  const memberName = (id: unknown) => loadClub(clubId).members.find((m) => m.id === id)?.name.split(" ")[0] ?? String(id);
  switch (name) {
    case "list_circles": {
      const o = overview();
      return { result: o, summary: `Read ${o.length} circles` };
    }
    case "get_circle": {
      const s = statusSummary(clubId);
      return { result: s, summary: `${s.club}: ${s.members_paid} paid` };
    }
    case "verify_payment": {
      const r = await verifyContribution(clubId, String(input.member_id));
      return { result: r, summary: `Checked ${memberName(input.member_id)} with PayPal` };
    }
    case "send_reminder": {
      const memberId = String(input.member_id);
      const link = `${baseUrl}/pay/${clubId}/${memberId}`;
      const raw = String(input.message);
      const text = raw.includes("{{PAY_LINK}}") ? raw.replaceAll("{{PAY_LINK}}", link) : `${raw}\n${link}`;
      addReminder(clubId, memberId, text, input.language as Language);
      return { result: { sent: true }, summary: `Reminded ${memberName(memberId)} in ${input.language}` };
    }
    case "propose_payout": {
      const r = proposePayout(clubId, String(input.reason));
      return { result: r, summary: r.ok ? `Payout for ${clubName()} ready for you` : `${clubName()} payout not ready` };
    }
    case "check_payout_status": {
      const r = await refreshPayoutStatus(clubId, typeof input.cycle === "number" ? input.cycle : undefined);
      return { result: r, summary: `Checked ${clubName()} payout` };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Progress events streamed to the UI so people can watch the agent work. */
export type AgentEvent =
  | { type: "thinking" }
  | { type: "step"; id: string; tool: string; input: Record<string, unknown>; status: "running" }
  | { type: "step"; id: string; tool: string; input: Record<string, unknown>; status: "done" | "error"; summary: string };

export const BRIEFING_PROMPT =
  "Good morning. Go through all my circles. Following each circle's own rules, send any reminders that are due and propose any payouts that are ready. Then brief me in at most 4 short bullets, most urgent first: what you did, and what needs me.";

export async function runAgent(
  history: ChatTurn[],
  baseUrl: string,
  onEvent: (e: AgentEvent) => void = () => {},
  context: { clubId?: string } = {},
): Promise<{ reply: string; actions: AgentAction[] }> {
  const client = new Anthropic({ timeout: 90_000, maxRetries: 1 });
  const messages: Anthropic.MessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
  const actions: AgentAction[] = [];
  const system = context.clubId
    ? `${SYSTEM}\n\nRudo is currently looking at the circle "${loadClub(context.clubId).name}" (club_id ${context.clubId}). Assume questions are about it unless she says otherwise.`
    : SYSTEM;

  for (let step = 0; step < MAX_STEPS; step++) {
    onEvent({ type: "thinking" });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Gateways may not forward newer request fields; only send them first-party.
      ...(VIA_GATEWAY ? {} : { thinking: { type: "adaptive" as const }, output_config: { effort: "medium" as const } }),
      system,
      tools: tools(),
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { reply: "I can't help with that one.", actions };
    }

    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason === "pause_turn") continue;

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: reply || "Done.", actions };
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const input = (tu.input ?? {}) as Record<string, unknown>;
      onEvent({ type: "step", id: tu.id, tool: tu.name, input, status: "running" });
      try {
        const { result, summary } = await runTool(tu.name, input, baseUrl);
        onEvent({ type: "step", id: tu.id, tool: tu.name, input, status: "done", summary });
        actions.push({ tool: tu.name, input, ok: true, summary });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        onEvent({ type: "step", id: tu.id, tool: tu.name, input, status: "error", summary: message });
        actions.push({ tool: tu.name, input, ok: false, summary: message });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: message, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "That took more steps than I allow myself. Try asking about one circle at a time.", actions };
}
