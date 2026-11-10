"use client";

import type { Club } from "@/lib/types";
import { firstName } from "./ui";

export type Step = {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  status: "running" | "done" | "error";
  summary?: string;
};

/** Read an NDJSON agent stream, calling back on each step and on the final reply. */
export async function streamAgent(
  url: string,
  body: unknown,
  on: { step: (s: Step) => void; reply: (text: string) => void; error: (msg: string) => void },
) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
      on.error(data.error);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const ev = JSON.parse(line);
        if (ev.type === "step") on.step({ id: ev.id, tool: ev.tool, input: ev.input, status: ev.status, summary: ev.summary });
        else if (ev.type === "reply") on.reply(ev.reply);
        else if (ev.type === "error") on.error(ev.message);
      }
    }
  } catch (e) {
    on.error(`Couldn't reach the agent: ${String(e)}`);
  }
}

export function upsertStep(steps: Step[], s: Step): Step[] {
  return steps.some((x) => x.id === s.id) ? steps.map((x) => (x.id === s.id ? { ...x, ...s, input: x.input } : x)) : [...steps, s];
}

const LANG_CODE: Record<string, string> = { English: "en", Shona: "sn", Ndebele: "nd", isiZulu: "zu", Sesotho: "st", Setswana: "tn" };

/** Plain-language step, plus the literal call for people who want to see the machinery. */
export function describeStep(step: Step, clubs: Club[]): { label: string; call: string } {
  const club = clubs.find((c) => c.id === step.input.club_id);
  const who = (id: unknown) => firstName(club?.members.find((m) => m.id === id)?.name ?? String(id));
  const circle = club?.name ?? "";
  const i = step.input;
  switch (step.tool) {
    case "list_circles": return { label: "Looking across all your circles", call: "list_circles()" };
    case "get_circle": return { label: `Reading ${circle}'s books`, call: `get_circle(${i.club_id})` };
    case "verify_payment": return { label: `Checking PayPal for ${who(i.member_id)}'s payment`, call: `verify_payment(${i.member_id})` };
    case "send_reminder": return { label: `Writing to ${who(i.member_id)} in ${String(i.language)}`, call: `send_reminder(${i.member_id}, ${LANG_CODE[String(i.language)] ?? i.language})` };
    case "propose_payout": return { label: `Putting ${circle}'s payout up for your approval`, call: `propose_payout(${i.club_id})` };
    case "check_payout_status": return { label: `Checking ${circle}'s payout with PayPal`, call: `check_payout_status(${i.club_id})` };
    default: return { label: step.tool, call: `${step.tool}()` };
  }
}

export function Trace({ steps, clubs }: { steps: Step[]; clubs: Club[] }) {
  if (!steps.length) return null;
  return (
    <ol className="trace">
      {steps.map((s) => {
        const d = describeStep(s, clubs);
        return (
          <li key={s.id} className={s.status} title={s.status === "error" ? s.summary : undefined}>
            <span className="trace-icon" aria-hidden>{s.status === "running" ? "" : s.status === "done" ? "✓" : "–"}</span>
            <span className="trace-label">{d.label}</span>
            <code className="trace-call">{d.call}</code>
          </li>
        );
      })}
    </ol>
  );
}
