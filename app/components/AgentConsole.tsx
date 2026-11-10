"use client";

import { useEffect, useRef, useState } from "react";
import type { Club } from "@/lib/types";
import { streamAgent, Trace, upsertStep, type Step } from "./agentClient";
import { Markdown } from "./ui";

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; steps: Step[]; error?: boolean; pending?: boolean; note?: boolean };

function suggestions(club: Club): string[] {
  const cycle = club.cycles.find((c) => c.number === club.currentCycle);
  const unpaid = cycle?.contributions.find((c) => c.status !== "paid");
  const name = unpaid ? club.members.find((m) => m.id === unpaid.memberId)?.name.split(" ")[0] : null;
  return [
    "Who still owes this month?",
    "Remind everyone who's late.",
    ...(name ? [`${name} says the money's already sent. Can you check?`] : []),
    "Is the pot ready to pay out?",
  ];
}

export default function AgentConsole({
  club,
  clubs,
  ready,
  onChange,
  note,
}: {
  club: Club;
  clubs: Club[];
  ready: boolean;
  onChange: () => void;
  /** A message to post into the conversation, e.g. after the treasurer releases a payout. */
  note: { id: string; text: string } | null;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const lastNote = useRef<string | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    if (note && note.id !== lastNote.current) {
      lastNote.current = note.id;
      setTurns((t) => [...t, { role: "assistant", content: note.text, steps: [], note: true }]);
    }
  }, [note]);

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
    const history = [...turns.filter((t) => !(t.role === "assistant" && (t.error || t.note))), { role: "user" as const, content }];
    setTurns((t) => [...t, { role: "user", content }, { role: "assistant", content: "", steps: [], pending: true }]);
    setInput("");
    setBusy(true);
    await streamAgent(
      "/api/agent",
      { clubId: club.id, history: history.filter((t) => t.content).map(({ role, content }) => ({ role, content })) },
      {
        step: (s) => {
          patchLast((t) => ({ ...t, steps: upsertStep(t.steps, s) }));
          if (s.status !== "running") onChange();
        },
        reply: (r) => patchLast((t) => ({ ...t, content: r, pending: false })),
        error: (m) => patchLast((t) => ({ ...t, content: m, error: true, pending: false })),
      },
    );
    setBusy(false);
    onChange();
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
            <p className="agent-intro-guard">It can put a payout up for approval. Only you can release money.</p>
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="q">{t.content}</div>
          ) : (
            <div key={i} className={`a ${t.error ? "a-error" : ""} ${t.note ? "a-note" : ""}`}>
              <Trace steps={t.steps} clubs={clubs} />
              {t.pending && !t.content && <div className="thinking"><span /><span /><span /></div>}
              {t.content && <div className="a-text"><Markdown text={t.content} /></div>}
            </div>
          ),
        )}
      </div>

      <div className="suggest">
        {suggestions(club).map((s) => (
          <button key={s} onClick={() => send(s)} disabled={busy || !ready}>{s}</button>
        ))}
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask about ${club.name}`} aria-label="Message the treasurer agent" />
        <button type="submit" disabled={busy || !input.trim() || !ready}>Ask</button>
      </form>
    </section>
  );
}
