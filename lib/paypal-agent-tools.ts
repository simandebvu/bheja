import type Anthropic from "@anthropic-ai/sdk";
import { paypalConfigured } from "./paypal";

/**
 * A small allowlist of real PayPal Agent Toolkit tools for the in-app agent,
 * behind PAYPAL_AGENT_TOOLKIT=1. Read-only lookups plus invoicing; the agent
 * can never create/pay orders, refund or touch disputes. Sandbox only.
 * Does not touch the payment path (lib/paypal.ts, lib/club.ts).
 */
export const PAYPAL_TOOL_ACTIONS = {
  transactions: { list: true },
  orders: { get: true },
  invoices: { create: true, send: true, get: true, generateQRC: true },
};

export interface PayPalTools {
  tools: Anthropic.Tool[];
  names: Set<string>;
  run(name: string, input: Record<string, unknown>): Promise<{ result: unknown; isError: boolean }>;
}

interface BedrockSpec {
  toolSpec: { name: string; description: string; inputSchema: { json: Record<string, unknown> } };
}

/** Toolkit errors come back as a JSON string inside a JSON string, not as throws. */
export function unwrapToolText(text: string): { result: unknown; isError: boolean } {
  let value: unknown = text;
  for (let i = 0; i < 2 && typeof value === "string"; i++) {
    try {
      value = JSON.parse(value);
    } catch {
      break;
    }
  }
  // Failures look like {error: ...} or, from the transaction search API, {ok: false, status, code, message}.
  const o = (typeof value === "object" && value !== null ? value : {}) as { error?: unknown; ok?: unknown };
  const isError = Boolean(o.error) || o.ok === false;
  return { result: value, isError };
}

export function mapTools(specs: BedrockSpec[]): Anthropic.Tool[] {
  return specs.map(({ toolSpec }) => {
    const { $schema: _omit, ...schema } = toolSpec.inputSchema.json as Record<string, unknown>;
    return { name: toolSpec.name, description: toolSpec.description, input_schema: schema as Anthropic.Tool.InputSchema };
  });
}

export async function loadPayPalTools(): Promise<PayPalTools | null> {
  if (process.env.PAYPAL_AGENT_TOOLKIT !== "1" || !paypalConfigured()) return null;
  try {
    const { PayPalAgentToolkit } = await import("@paypal/agent-toolkit/bedrock");
    // A fresh toolkit per agent run: its token is cached and never refreshed.
    const toolkit = new PayPalAgentToolkit({
      clientId: process.env.PAYPAL_CLIENT_ID!,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
      configuration: { actions: PAYPAL_TOOL_ACTIONS, context: { sandbox: true } },
    });
    const tools = mapTools(toolkit.getTools() as BedrockSpec[]);
    const names = new Set(tools.map((t) => t.name));
    return {
      tools,
      names,
      async run(name, input) {
        if (!names.has(name)) throw new Error(`Unknown PayPal tool ${name}`);
        try {
          const res = await toolkit.handleToolCall({ toolUseId: "pp", name, input });
          return unwrapToolText(res.content.map((c) => c.text).join(""));
        } catch (err) {
          return { result: { error: err instanceof Error ? err.message : String(err) }, isError: true };
        }
      },
    };
  } catch (err) {
    console.warn("PayPal Agent Toolkit unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}
