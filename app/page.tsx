"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Club, Cycle, Member } from "@/lib/types";

type State = { club: Club; paypalMode: "sandbox" | "mock"; agentReady: boolean };
type Action = { tool: string; ok: boolean; summary: string };
type Turn = { role: "user" | "assistant"; content: string; actions?: Action[] };

const SUGGESTIONS = [
  "Who still owes this month?",
  "Remind everyone who's late, in their own language.",
  "Thandiwe says she already paid. Can you check?",
  "Is the pot ready to pay out?",
];

function daysLate(due: string) {
  const ms = Date.now() - new Date(`${due}T23:59:59Z`).getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard() {
  const [state, setState] = useState<State | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Turn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: next.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json();
      setTurns([...next, res.ok ? { role: "assistant", content: data.reply, actions: data.actions } : { role: "assistant", content: `⚠️ ${data.error}` }]);
    } catch (e) {
      setTurns([...next, { role: "assistant", content: `⚠️ ${String(e)}` }]);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function approve() {
    setApproving(true);
    setNotice(null);
    const res = await fetch("/api/payout", { method: "POST" });
    const data = await res.json();
    setNotice(res.ok ? `Payout sent via PayPal Payouts: batch ${data.batchId} (${data.batchStatus}).` : `Payout failed: ${data.error}`);
    setApproving(false);
    refresh();
  }

  async function reset() {
    await fetch("/api/state", { method: "POST" });
    setTurns([]);
    setNotice(null);
    refresh();
  }

  if (!state) return <main className="shell">Loading…</main>;

  const { club } = state;
  const cycle = club.cycles.find((c) => c.number === club.currentCycle) as Cycle;
  const member = (id: string) => club.members.find((m) => m.id === id) as Member;
  const paid = cycle.contributions.filter((c) => c.status === "paid").length;
  const collected = paid * Number(club.contributionAmount);
  const target = Number(cycle.payout.amount);
  const recipient = member(cycle.recipientId);
  const late = daysLate(cycle.dueDate);

  return (
    <main className="shell">
      <div className="top">
        <div className="brand">
          <div className="logo">B</div>
          <div>
            <h1>{club.name}</h1>
            <p>
              AI treasurer · {club.members.length} members in South Africa, Zimbabwe &amp; the UK · US${club.contributionAmount}/month
            </p>
          </div>
        </div>
        <div className="badges">
          <span className={`badge ${state.paypalMode === "sandbox" ? "live" : "warn"}`}>
            PayPal: {state.paypalMode === "sandbox" ? "sandbox" : "mock mode"}
          </span>
          <span className={`badge ${state.agentReady ? "live" : "warn"}`}>Claude agent: {state.agentReady ? "ready" : "no API key"}</span>
          <button className="ghost" onClick={reset}>Reset demo</button>
        </div>
      </div>

      <div className="grid">
        <section>
          <div className="card">
            <h2>Cycle {cycle.number} of {club.cycles.length}</h2>
            <div className="pot">
              <div>
                <div className="big">
                  US${collected.toFixed(0)} <small>/ US${target.toFixed(0)}</small>
                </div>
                <div className="meta">
                  Due {cycle.dueDate}
                  {late > 0 && paid < club.members.length ? ` · ${late} day${late === 1 ? "" : "s"} overdue` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="meta">This month&apos;s payout goes to</div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{recipient.name}</div>
                <div className="meta">{recipient.city}</div>
              </div>
            </div>
            <div className="bar"><div style={{ width: `${Math.min(100, (collected / target) * 100)}%` }} /></div>
            <div className="meta">{paid} of {club.members.length} members have paid</div>
          </div>

          <div className="card">
            <h2>Members</h2>
            <table>
              <thead>
                <tr><th>Member</th><th>Language</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {cycle.contributions.map((c) => {
                  const m = member(c.memberId);
                  return (
                    <tr key={m.id}>
                      <td className="who">
                        <b>{m.name} {m.id === cycle.recipientId && <span className="turn">· THIS MONTH&apos;S TURN</span>}</b>
                        <span>{m.city} · turn #{m.turn}</span>
                      </td>
                      <td className="meta">{m.language}</td>
                      <td>
                        <span className={`pill ${c.status}`}>
                          {c.status === "paid" ? (c.source === "paypal" ? "Paid · PayPal" : "Paid") : c.status === "pending" ? "Checkout started" : late > 0 ? `${late}d late` : "Unpaid"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {c.status !== "paid" && (
                          <a className="secondary" href={`/pay/${m.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                            Pay link ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Payout</h2>
            <div className="payout">
              <div>
                {cycle.payout.status === "awaiting_approval" ? (
                  <>
                    <b>Bheja proposes sending US${cycle.payout.amount} to {recipient.name}.</b>
                    <div className="meta">{cycle.payout.proposedReason}</div>
                  </>
                ) : cycle.payout.status === "sent" ? (
                  <b>Sent ✓</b>
                ) : (
                  <span className="meta">The agent will propose the payout once everyone has paid. Money only moves when you approve it.</span>
                )}
              </div>
              <button className="primary" disabled={cycle.payout.status !== "awaiting_approval" || approving} onClick={approve}>
                {approving ? "Sending…" : "Approve payout"}
              </button>
            </div>
            {notice && <p className="meta" style={{ marginBottom: 0 }}>{notice}</p>}
          </div>
        </section>

        <section>
          <div className="card chat">
            <header>
              <h2>Ask Bheja</h2>
              <p>Your treasurer agent. It reads the books, checks PayPal, writes reminders and proposes payouts. It can&apos;t send money without you.</p>
            </header>
            <div className="msgs" ref={msgsRef}>
              {turns.length === 0 && <div className="empty">Try one of the suggestions below.</div>}
              {turns.map((t, i) => (
                <div key={i} className={`msg ${t.role}`}>
                  {t.content}
                  {t.actions && t.actions.length > 0 && (
                    <div className="actions">
                      {t.actions.map((a, j) => (
                        <span key={j} className={`action ${a.ok ? "" : "err"}`}>{a.ok ? "✓" : "✗"} {a.summary}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {busy && <div className="thinking">Bheja is working…</div>}
            </div>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>{s}</button>
              ))}
            </div>
            <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about payments, reminders, payouts…" />
              <button className="primary" disabled={busy || !input.trim()}>Send</button>
            </form>
          </div>

          <div className="card">
            <h2>WhatsApp outbox</h2>
            <div className="outbox">
              {club.outbox.length === 0 && <div className="empty">No reminders yet.</div>}
              {[...club.outbox].reverse().map((n) => (
                <div key={n.id} className="wa">
                  <div className="to">To {member(n.memberId).name} · {n.language} · {fmtTime(n.createdAt)}</div>
                  {n.message}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Activity</h2>
            <ul className="feed">
              {[...club.activity].reverse().map((a, i) => (
                <li key={i}><time>{fmtTime(a.at)}</time><span>{a.text}</span></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
