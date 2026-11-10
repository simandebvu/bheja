import Anthropic from "@anthropic-ai/sdk";
import { addNudge, proposePayout, refreshPayoutStatus, statusSummary, verifyContribution } from "./club";
import { loadClub } from "./db";
import type { Language } from "./types";

const MODEL = "claude-opus-4-8";
const MAX_STEPS = 12;

const SYSTEM = `You are "Bheja", the AI treasurer for a rotating savings club (called a stokvel in South Africa, a mukando or round in Zimbabwe). Members across South Africa, Zimbabwe and the diaspora each contribute a fixed amount every month through PayPal, and the whole pot goes to one member per month in rotation.

Your job:
- Keep the club's books straight and explain them in plain, warm language.
- Notice who has not paid and how late they are, and send friendly reminders.
- Write reminders in each member's own language (English, Shona, Ndebele, isiZulu or Sesotho), short like a WhatsApp message, with the amount, due date and their payment link. Be respectful and kind; nobody likes being chased for money. Add a one-line English translation after a non-English message, prefixed "EN:".
- When every member has paid, propose the payout to the member whose turn it is.

Hard rules:
- You never move money yourself. You can only PROPOSE a payout; the human treasurer approves it in the app. Say so when relevant.
- Always call get_club_status before answering questions about who has paid; never guess from memory.
- If a member claims they paid but the records disagree, use verify_payment to check with PayPal before saying anything.
- Do not invent members, amounts or dates. Use member_id values exactly as returned by tools.
- Keep replies brief: a few sentences or a short list.`;

const tools: Anthropic.Tool[] = [
  {
    name: "get_club_status",
    description:
      "Get the club's current cycle: due date, payout recipient, each member's contribution status, days late, language, the club rules, payout status and recent reminders. Call this before answering any question about payments.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "verify_payment",
    description:
      "Check a member's contribution against PayPal (Orders API). If PayPal shows the order was approved but never captured, this captures it and marks the member as paid. Use when records and a member's claim disagree.",
    input_schema: {
      type: "object",
      properties: { member_id: { type: "string" } },
      required: ["member_id"],
      additionalProperties: false,
    },
  },
  {
    name: "send_reminder",
    description:
      "Queue a WhatsApp-style payment reminder to one member. Write the message in the member's preferred language. Include their payment link, which is provided as {{PAY_LINK}} and replaced automatically.",
    input_schema: {
      type: "object",
      properties: {
        member_id: { type: "string" },
        language: { type: "string", enum: ["English", "Shona", "Ndebele", "isiZulu", "Sesotho"] },
        message: { type: "string", description: "The reminder text. Use {{PAY_LINK}} where the link goes." },
      },
      required: ["member_id", "language", "message"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_payout",
    description:
      "Propose releasing this cycle's pot to the member whose turn it is. Fails unless every member has paid. Does NOT send money; the treasurer must approve it in the app.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string", description: "One sentence for the treasurer explaining why it is ready." } },
      required: ["reason"],
      additionalProperties: false,
    },
  },
  {
    name: "check_payout_status",
    description: "Check a cycle's payout status with PayPal Payouts. Defaults to the current cycle; pass an earlier cycle number to check a payout already sent.",
    input_schema: {
      type: "object",
      properties: { cycle: { type: "integer" } },
      additionalProperties: false,
    },
  },
];

export interface AgentAction {
  tool: string;
  input: unknown;
  ok: boolean;
  summary: string;
}

async function runTool(name: string, input: Record<string, unknown>, baseUrl: string): Promise<{ result: unknown; summary: string }> {
  switch (name) {
    case "get_club_status": {
      const s = statusSummary();
      return { result: s, summary: `Read club status (${s.members_paid} paid)` };
    }
    case "verify_payment": {
      const r = await verifyContribution(String(input.member_id));
      return { result: r, summary: `Verified ${input.member_id} with PayPal` };
    }
    case "send_reminder": {
      const memberId = String(input.member_id);
      const club = loadClub();
      if (!club.members.some((m) => m.id === memberId)) throw new Error(`Unknown member "${memberId}"`);
      const link = `${baseUrl}/pay/${memberId}`;
      const text = String(input.message).replaceAll("{{PAY_LINK}}", link);
      const nudge = addNudge(memberId, text.includes(link) ? text : `${text}\n${link}`, input.language as Language);
      return { result: { queued: true, nudge_id: nudge.id }, summary: `Reminder to ${memberId} (${input.language})` };
    }
    case "propose_payout": {
      const r = proposePayout(String(input.reason));
      return { result: r, summary: r.ok ? `Proposed payout to ${r.recipient}` : "Payout not ready" };
    }
    case "check_payout_status": {
      const r = await refreshPayoutStatus(typeof input.cycle === "number" ? input.cycle : undefined);
      return { result: r, summary: `Checked payout for cycle ${r.cycle}` };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function runAgent(history: ChatTurn[], baseUrl: string): Promise<{ reply: string; actions: AgentAction[] }> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
  const actions: AgentAction[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: SYSTEM,
      tools,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { reply: "Sorry, I can't help with that request.", actions };
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
      return { reply: reply || "(no reply)", actions };
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const input = (tu.input ?? {}) as Record<string, unknown>;
      try {
        const { result, summary } = await runTool(tu.name, input, baseUrl);
        actions.push({ tool: tu.name, input, ok: true, summary });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        actions.push({ tool: tu.name, input, ok: false, summary: message });
        results.push({ type: "tool_result", tool_use_id: tu.id, content: message, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: "I ran out of steps on that one. Try asking again more specifically.", actions };
}
