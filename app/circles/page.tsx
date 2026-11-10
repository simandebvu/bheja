"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Briefing, Club } from "@/lib/types";
import { streamAgent, Trace, upsertStep, type Step } from "../components/agentClient";
import MiniRing from "../components/MiniRing";
import { ledgerTotals, sinceLabel } from "@/lib/passport";
import { LogoMark, Markdown, countriesOf, firstName } from "../components/ui";

type Data = { clubs: Club[]; briefing: Briefing | null; paypalMode: "sandbox" | "mock"; agentReady: boolean };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Mangwanani" : h < 17 ? "Masikati" : "Manheru";
}

function daysLate(due: string) {
  const ms = Date.now() - new Date(`${due}T23:59:59Z`).getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

const dayMonth = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function circleState(club: Club) {
  const cycle = club.cycles.find((c) => c.number === club.currentCycle)!;
  const unpaid = cycle.contributions.filter((c) => c.status !== "paid").length;
  const late = unpaid ? daysLate(cycle.dueDate) : 0;
  const recipient = club.members.find((m) => m.id === cycle.recipientId)!;
  if (cycle.payout.status === "awaiting_approval") return { tone: "ready", label: `US$${Number(cycle.payout.amount)} ready to release`, cycle, recipient, unpaid };
  if (late > 0) return { tone: "late", label: `${unpaid} late · ${late}d overdue`, cycle, recipient, unpaid };
  if (unpaid === 0) return { tone: "ready", label: "Everyone has paid", cycle, recipient, unpaid };
  return { tone: "calm", label: `On track · due ${dayMonth(cycle.dueDate)}`, cycle, recipient, unpaid };
}

export default function Circles() {
  const [data, setData] = useState<Data | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [reply, setReply] = useState<string | null>(null);
  const [briefedAt, setBriefedAt] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/clubs", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  const runBriefing = useCallback(async () => {
    setRunning(true);
    setSteps([]);
    setReply(null);
    setError(null);
    await streamAgent("/api/briefing", {}, {
      step: (s) => {
        setSteps((prev) => upsertStep(prev, s));
        if (s.status !== "running") load();
      },
      reply: (r) => { setReply(r); setBriefedAt(new Date().toISOString()); },
      error: (m) => setError(m),
    });
    setRunning(false);
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/clubs", { cache: "no-store" });
      if (!res.ok) return;
      const d: Data = await res.json();
      setData(d);
      if (d.briefing) {
        setReply(d.briefing.reply);
        setBriefedAt(d.briefing.at);
        setSteps(d.briefing.steps.map((s, i) => ({ id: `saved-${i}`, tool: s.tool, input: s.input, status: s.ok ? "done" : "error", summary: s.summary })));
      } else if (d.agentReady && !started.current) {
        started.current = true;
        runBriefing();
      }
    })();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load, runBriefing]);

  async function reset() {
    await fetch("/api/clubs", { method: "POST" });
    setSteps([]);
    setReply(null);
    setBriefedAt(null);
    await load();
    runBriefing();
  }

  if (!data) {
    return <main className="loading"><LogoMark size={40} /></main>;
  }

  const { clubs } = data;
  const people = new Set(clubs.flatMap((c) => c.members.map((m) => m.name)));
  const flags = countriesOf(clubs.flatMap((c) => c.members.map((m) => m.city)));
  const monthly = clubs.reduce((sum, c) => sum + c.members.length * Number(c.contributionAmount), 0);
  const attention = clubs.map((c) => ({ club: c, s: circleState(c) })).filter((x) => x.s.tone !== "calm");
  const record = ledgerTotals(clubs);
  const earliest = clubs.flatMap((c) => c.members.map((m) => m.history?.since ?? "9999")).sort()[0];

  return (
    <main className="app home">
      <header className="masthead">
        <div className="brand">
          <LogoMark />
          <span className="wordmark">rotapot</span>
        </div>
        <div className="club">
          <h1>{greeting()}, Rudo</h1>
          <p>You&apos;re treasurer of {clubs.length} circles: {people.size} people in {flags.join(" ")} moving US${monthly.toLocaleString()} a month.</p>
        </div>
        <div className="env">
          <span className={`env-pill ${data.paypalMode === "sandbox" ? "live" : ""}`}><i aria-hidden /> PayPal {data.paypalMode}</span>
          <button className="link-btn" onClick={reset}>Reset demo</button>
          <Link className="link-btn" href="/">Sign out</Link>
        </div>
      </header>

      <section className="briefing" aria-live="polite">
        <div className="briefing-head">
          <div>
            <span className="briefing-eyebrow">{running ? "Your agent is working" : "Today's briefing"}</span>
            <h2>{running ? "Going through your circles…" : reply ? "Here's where things stand" : "Briefing"}</h2>
          </div>
          <div className="briefing-meta">
            {briefedAt && !running && <span>Prepared at {time(briefedAt)}</span>}
            <button className="ghost-btn" onClick={runBriefing} disabled={running || !data.agentReady}>{running ? "Working…" : "Run again"}</button>
          </div>
        </div>
        <div className="briefing-body">
          <div className="briefing-trace">
            <Trace steps={steps} clubs={clubs} />
            {running && !reply && <div className="thinking"><span /><span /><span /></div>}
            {!running && !steps.length && !reply && !data.agentReady && <p className="muted">Add an agent API key to get a briefing.</p>}
          </div>
          <div className="briefing-reply">
            {error && <p className="err">{error}</p>}
            {reply ? <Markdown text={reply} /> : !error && <p className="muted">The agent reads every circle, sends reminders the rules allow, and puts ready payouts in front of you. Nothing moves money without your tap.</p>}
            {attention.length > 0 && !running && (
              <div className="needs">
                {attention.map(({ club, s }) => (
                  <Link key={club.id} href={`/circles/${club.id}`} className={`needs-item ${s.tone}`}>
                    <b>{club.name}</b>
                    <span>{s.label}</span>
                    <i aria-hidden>→</i>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="record" aria-label="Your circles' payment record">
        <div className="record-figure"><b>{record.payments.toLocaleString()}</b><span>contributions on record</span></div>
        <div className="record-figure"><b>{Math.round(record.rate * 100)}%</b><span>paid on time</span></div>
        <div className="record-figure"><b>US${record.saved.toLocaleString()}</b><span>saved together since {sinceLabel(earliest)}</span></div>
        <p className="record-note">
          Every on-time payment builds each member&apos;s <b>trust passport</b>: a payment history most of them have never had on paper.
          Open any circle and tap a member to see theirs.
        </p>
      </section>

      <section className="circles" aria-label="Your circles">
        {clubs.map((club) => {
          const s = circleState(club);
          const collected = (club.members.length - s.unpaid) * Number(club.contributionAmount);
          return (
            <Link key={club.id} href={`/circles/${club.id}`} className={`circle-card ${s.tone}`}>
              <MiniRing club={club} />
              <div className="circle-card-body">
                <span className="circle-kind">{club.kind}</span>
                <h3>{club.name}</h3>
                <p className="circle-purpose">{club.purpose}</p>
                <div className="circle-facts">
                  <span>{countriesOf(club.members.map((m) => m.city)).join(" ")} {club.members.length} members</span>
                  <span>US${Number(club.contributionAmount)}/mo</span>
                  <span>Cycle {s.cycle.number}/{club.cycles.length}</span>
                </div>
                <div className="circle-foot">
                  <span className={`status ${s.tone}`}>{s.label}</span>
                  <span className="circle-pot"><b>US${collected}</b> of US${Number(s.cycle.payout.amount)} for {firstName(s.recipient.name)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
