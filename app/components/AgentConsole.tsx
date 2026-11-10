"use client";

import { useEffect, useRef, useState } from "react";
import type { Member } from "@/lib/types";
import { Markdown, firstName } from "./ui";

type Step = { id: string; tool: string; input: Record<string, unknown>; status: "running" | "done" | "error"; summary?: string };
type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; steps: Step[]; error?: boolean; pending?: boolean };

const SUGGESTIONS = [
  "Who still owes this month?",
  "Remind everyone who's late, in their own language.",
  "Thandiwe says she already paid. Can you check?",
  "Is the pot ready to pay out?",
];

function describe(step: Step, members: Member[]): string {
  const who = (id: unknown) => firstName(members.find((m) => m.id === id)?.name ?? String(id));
  switch (step.tool) {
    case "get_club_status": return "Reading the club's books";
    case "verify_payment": return `Checking PayPal for ${who(step.input.member_id)}'s payment`;
    case "send_reminder": return `Writing to ${who(step.input.member_id)} in ${String(step.input.language)}`;
    case "propose_payout": return "Preparing the payout for your approval";
    case "check_payout_status": return "Checking the payout with PayPal";
    default: return step.tool;
  }
}

export default function AgentConsole({ members, ready, onChange }: { members: Member[]; ready: boolean; onChange: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function patchLast(fn: (t: Extract<Turn, { role: "assistant" }>) => Extract<Turn, { role: "assistant" }>) {
    setTurns((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === "assistant") next[next.length - 1] = fn(last);
      return next;
    });
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history = [...turns, { role: "user" as const, content }];
    setTurns([...history, { role: "assistant", content: "", steps: [], pending: true }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: history.filter((t) => t.content).map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
        patchLast((t) => ({ ...t, content: data.error, error: true, pending: false }));
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
          if (ev.type === "step") {
            patchLast((t) => {
              const steps = t.steps.some((s) => s.id === ev.id)
                ? t.steps.map((s) => (s.id === ev.id ? { ...s, status: ev.status, summary: ev.summary } : s))
                : [...t.steps, { id: ev.id, tool: ev.tool, input: ev.input, status: ev.status }];
              return { ...t, steps };
            });
            if (ev.status !== "running") onChange();
          } else if (ev.type === "reply") {
            patchLast((t) => ({ ...t, content: ev.reply, pending: false }));
          } else if (ev.type === "error") {
            patchLast((t) => ({ ...t, content: ev.message, error: true, pending: false }));
          }
        }
      }
    } catch (e) {
      patchLast((t) => ({ ...t, content: `Couldn't reach the agent: ${String(e)}`, error: true, pending: false }));
    } finally {
      setBusy(false);
      onChange();
    }
  }

  return (
    <section className="agent" aria-label="Treasurer agent">
      <div className="col-head">
        <h2>Treasurer agent</h2>
        <span className={`dot ${ready ? "on" : ""}`}>{ready ? "Online" : "No API key"}</span>
      </div>

      <div className="agent-scroll" ref={scroller} aria-live="polite">
        {turns.length === 0 && (
          <div className="agent-intro">
            <p className="agent-intro-lead">Ask in plain words. The agent reads the books, checks PayPal, and writes to members in their own language.</p>
            <p className="agent-intro-guard">It can propose a payout, but money only moves when you release it.</p>
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="q">{t.content}</div>
          ) : (
            <div key={i} className={`a ${t.error ? "a-error" : ""}`}>
              {t.steps.length > 0 && (
                <ol className="trace">
                  {t.steps.map((s) => (
                    <li key={s.id} className={s.status}>
                      <span className="trace-icon" aria-hidden>{s.status === "running" ? "" : s.status === "done" ? "✓" : "!"}</span>
                      <span>{describe(s, members)}</span>
                    </li>
                  ))}
                </ol>
              )}
              {t.pending && !t.content && (
                <div className="thinking"><span /><span /><span /></div>
              )}
              {t.content && <div className="a-text"><Markdown text={t.content} /></div>}
            </div>
          ),
        )}
      </div>

      <div className="suggest">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy || !ready}>{s}</button>
        ))}
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about payments, reminders or the payout" aria-label="Message the treasurer agent" />
        <button type="submit" disabled={busy || !input.trim() || !ready}>Ask</button>
      </form>
    </section>
  );
}
