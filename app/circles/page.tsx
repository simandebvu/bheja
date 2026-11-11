"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Briefing, BriefingNote, Club } from "@/lib/types";
import BriefingCards, { changesSince } from "../components/BriefingCards";
import { streamAgent, Trace, upsertStep, type Step } from "../components/agentClient";
import MiniRing from "../components/MiniRing";
import ConnectAgent from "../components/ConnectAgent";
import { ledgerTotals, sinceLabel } from "@/lib/passport";
import { LogoMark, Markdown, countriesOf, firstName } from "../components/ui";

type Data = { memberships: { id: string; name: string; status: string; amount: string }[]; clubs: Club[]; briefing: Briefing | null; paypalMode: "sandbox" | "mock"; agentReady: boolean };

/** Agent step log: open on wide screens and while running; tucked away (and below the cards) on phones. */
function TraceDetails({ steps, clubs, running }: { steps: Step[]; clubs: Club[]; running: boolean }) {
  const [wide, setWide] = useState(false);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  useEffect(() => { setWide(window.matchMedia("(min-width: 901px)").matches); }, []);
  if (!steps.length) return null;
  const open = running || (userOpen ?? wide);
  return (
    <details className="trace-details" open={open} onToggle={(e) => { if (!running) setUserOpen(e.currentTarget.open); }}>
      <summary>How the agent prepared this ({steps.length} step{steps.length === 1 ? "" : "s"})</summary>
      <Trace steps={steps} clubs={clubs} />
    </details>
  );
}

function clubFallbackDate() { return new Date().toISOString().slice(0, 7); }

/** Shona greeting with its English meaning, so it welcomes rather than puzzles. */
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? { sn: "Mangwanani", en: "Good morning" } : h < 17 ? { sn: "Masikati", en: "Good afternoon" } : { sn: "Manheru", en: "Good evening" };
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
  const { data: session } = authClient.useSession();
  const [data, setData] = useState<Data | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [reply, setReply] = useState<string | null>(null);
  const [notes, setNotes] = useState<BriefingNote[] | null>(null);
  const [briefedAt, setBriefedAt] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [running, setRunning] = useState(false);
  // Briefing failures and page-load failures are shown in different places: a dropped
  // background poll must never look like the agent failed, and clears on the next success.
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const started = useRef(false);
  const [sampleBusy, setSampleBusy] = useState(false);

  // Background polls fail for ordinary reasons (laptop wakes, Wi-Fi switches, a deploy restarts
  // the server). Stay quiet for a few misses and keep retrying; only then say we're reconnecting.
  const failures = useRef(0);
  // Runs once, on whichever request succeeds first (the first one may fail during a restart).
  const initialised = useRef(false);
  const onFirstLoad = useRef<(d: Data) => void>(() => {});
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/clubs", { cache: "no-store" });
      if (res.status === 401) { window.location.assign("/"); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next: Data = await res.json();
      failures.current = 0;
      setData(next);
      setLoadError(null);
      if (!initialised.current) { initialised.current = true; onFirstLoad.current(next); }
    } catch {
      failures.current += 1;
      if (failures.current >= 3) setLoadError("Can't reach Rotapot right now. Retrying automatically…");
    }
  }, []);

  const runBriefing = useCallback(async () => {
    setRunning(true);
    setSteps([]);
    setReply(null);
    setNotes(null);
    setError(null);
    await streamAgent("/api/briefing", {}, {
      step: (s) => {
        setSteps((prev) => upsertStep(prev, s));
        if (s.status !== "running") load();
      },
      reply: (r, ev) => {
        setReply(r);
        setNotes(Array.isArray(ev.notes) && ev.notes.length ? (ev.notes as BriefingNote[]) : null);
        setBriefedAt(typeof ev.at === "string" ? ev.at : new Date().toISOString());
        setScheduled(false);
      },
      error: (m) => setError(m),
    });
    setRunning(false);
    load();
  }, [load]);

  useEffect(() => {
    onFirstLoad.current = (d: Data) => {
      if (d.briefing) {
        setReply(d.briefing.reply);
        setNotes(d.briefing.notes?.length ? d.briefing.notes : null);
        setBriefedAt(d.briefing.at);
        setScheduled(d.briefing.source === "scheduled");
        setSteps(d.briefing.steps.map((s, i) => ({ id: `saved-${i}`, tool: s.tool, input: s.input, status: s.ok ? "done" : "error", summary: s.summary })));
      } else if (d.clubs.some((c) => c.status !== "draft") && d.agentReady && !started.current) {
        started.current = true;
        runBriefing();
      }
    };
    void load();
    // Poll only while the tab is visible, and catch up as soon as it comes back.
    const t = setInterval(() => { if (!document.hidden) void load(); }, 4000);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onVisible); };
  }, [load, runBriefing]);

  async function reset() {
    setSampleBusy(true); setError(null);
    try {
      const response = await fetch("/api/clubs/demo", { method: "POST" });
      if (!response.ok) throw new Error("Could not load sample circles.");
      setSteps([]); setReply(null); setNotes(null); setBriefedAt(null);
      await load();
      // The briefing starts at the top of the page; take people to it instead of leaving them at the button.
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (data?.agentReady) void runBriefing();
    } catch { setError("Could not load sample circles. Please try again."); }
    finally { setSampleBusy(false); }
  }

  if (!data) {
    return <main className="loading">{loadError ? <div><p className="err" role="alert">{loadError}</p><button className="secondary-action" onClick={() => { setLoadError(null); void load(); }}>Try again</button></div> : <LogoMark size={40} />}</main>;
  }

  const isEmpty = !data.clubs.length && !(data.memberships ?? []).length;
  const clubs = data.clubs.filter((club) => club.status !== "draft");
  const drafts = data.clubs.filter((club) => club.status === "draft");
  const people = new Set(clubs.flatMap((c) => c.members.map((m) => m.name)));
  const flags = countriesOf(clubs.flatMap((c) => c.members.map((m) => m.city)));
  const monthly = clubs.reduce((sum, c) => sum + c.members.length * Number(c.contributionAmount), 0);
  const attention = clubs.map((c) => ({ club: c, s: circleState(c) })).filter((x) => x.s.tone !== "calm");
  const record = ledgerTotals(clubs);
  // For older text-only briefings: say what moved since, so stale numbers don't mislead.
  const sinceAll = briefedAt ? clubs.flatMap((c) => { const ch = changesSince(c, briefedAt); return ch.length ? [`${c.name}: ${ch.join(", ")}`] : []; }) : [];
  const earliest = clubs.flatMap((c) => c.members.map((m) => m.history?.since ?? m.joinedAt?.slice(0, 7) ?? clubFallbackDate())).sort()[0];

  return (
    <main className="app home">
      <header className="masthead">
        <div className="brand">
          <LogoMark />
          <span className="wordmark">rotapot</span>
        </div>
        <div className="club">
          <h1 title={greeting().en}>{greeting().sn}, {session?.user.name.split(" ")[0] || "friend"} <span className="greet-en">{greeting().en}</span></h1>
          <p>{clubs.length ? `${clubs.length} active circles · ${people.size} people · US$${monthly.toLocaleString()} together each month` : drafts.length ? "Your people are gathering. Let’s make it a circle." : "A little each. A lot together."}</p>
        </div>
        <div className="env">
          <span className={`env-pill ${data.paypalMode === "sandbox" ? "live" : ""}`}><i aria-hidden /> PayPal {data.paypalMode}</span>
          <Link className="secondary-action" href="/circles/new">＋ New circle</Link>
          <button
            className="link-btn"
            onClick={async () => {
              const result = await authClient.signOut();
              if (result.error) { setError("Could not sign out. Please try again."); return; }
              window.location.href = "/";
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {loadError && <p className="reconnecting" role="status">{loadError}</p>}
      {error && !clubs.length && <p className="err" role="alert">{error}</p>}
      {isEmpty && <section className="first-circle"><div><span className="eyebrow">Every circle starts with one person</span><h2>Yours starts here.</h2><p>Your people already have the trust. Give it a name, a monthly promise, and a place to grow.</p><div className="first-circle-actions"><button className="primary-action" disabled={sampleBusy} onClick={() => void reset()}>{sampleBusy ? "Opening the samples…" : "See it working: open 3 sample circles →"}</button><Link className="secondary-action" href="/circles/new">Start my own circle</Link></div><span className="field-help">Samples show late payers, a ready payout and the AI treasurer at work. Your own circle takes about three minutes and needs at least one other person.</span></div><div className="empty-circle-art" aria-hidden><span>You</span><i>＋</i><i>＋</i><i>＋</i><b>A little each.<br />A lot together.</b></div></section>}
      {drafts.length > 0 && <section className="draft-section"><div className="section-heading"><h2>Good things are gathering.</h2><span>Circles you're setting up</span></div><div className="draft-grid">{drafts.map((club) => <Link className="draft-card" key={club.id} href={`/circles/${club.id}/setup`}><span className="eyebrow">{club.kind} · gathering</span><h3>{club.name}</h3><p>{club.purpose}</p><div className="draft-chairs">{club.members.map((m) => <span key={m.id} className={m.joinedAt ? "joined" : ""} title={m.name}>{m.joinedAt ? "✓" : m.name[0]}</span>)}</div><footer><span>{club.members.filter((m) => m.joinedAt).length} / {club.members.length} chairs confirmed</span><b>Keep gathering →</b></footer></Link>)}</div></section>}
      {(data.memberships ?? []).length > 0 && <section className="draft-section"><div className="section-heading"><h2>Your seat at the table.</h2><span>Circles you've joined</span></div><div className="draft-grid">{data.memberships.map((membership) => <Link className="draft-card" key={membership.id} href={`/members/${membership.id}`}><span className="eyebrow">Member · {membership.status === "draft" ? "Gathering" : "Active"}</span><h3>{membership.name}</h3><p>US${Number(membership.amount)} each month</p><footer><span>Your contributions & rotation</span><b>My chair →</b></footer></Link>)}</div></section>}
      {clubs.length > 0 && <><section className="briefing" aria-live="polite">
        <div className="briefing-head">
          <div>
            <span className="briefing-eyebrow">{running ? "Your agent is working" : "Today's briefing"}</span>
            <h2>{running ? "Going through your circles…" : reply ? "Here's where things stand" : "Briefing"}</h2>
          </div>
          <div className="briefing-meta">
            {briefedAt && !running && <span>{scheduled ? `Ran on its own at ${time(briefedAt)} · while you were away` : `Prepared at ${time(briefedAt)}`}</span>}
            <button className="ghost-btn" onClick={runBriefing} disabled={running || !data.agentReady}>{running ? "Working…" : "Run again"}</button>
          </div>
        </div>
        <div className="briefing-body">
          <div className={`briefing-trace${running ? " running" : ""}`}>
            <TraceDetails steps={steps} clubs={clubs} running={running} />
            {running && !reply && <div className="thinking"><span /><span /><span /></div>}
            {!running && !steps.length && !reply && !data.agentReady && <p className="muted">Add an agent API key to get a briefing.</p>}
          </div>
          <div className="briefing-reply">
            {error && <p className="err" role="alert">{error}</p>}
            {notes && briefedAt && !running ? (
              <BriefingCards notes={notes} clubs={clubs} at={briefedAt} />
            ) : reply ? (
              <>
                <Markdown text={reply} />
                {briefedAt && !running && sinceAll.length > 0 && <p className="brief-since">Since this briefing: {sinceAll.join("; ")}.</p>}
              </>
            ) : !error && <p className="muted">The agent reads every circle, sends reminders the rules allow, and puts ready payouts in front of you. Nothing moves money without your tap.</p>}
            {!notes && attention.length > 0 && !running && (
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
        <div className="record-figure"><b>{record.payments ? `${Math.round(record.rate * 100)}%` : "—"}</b><span>paid on time</span></div>
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
                <span className="circle-kind">{club.kind}{club.sample ? " · Sample circle" : ""}</span>
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
      </section></>}
      {!isEmpty && <section className="sample-invitation"><div><span className="eyebrow">Taking a look around?</span><h3>See a circle already in motion.</h3><p>Explore sample contributions, a ready payout and the AI treasurer. Your own circles stay untouched.</p></div><button className="secondary-action" disabled={sampleBusy} onClick={() => void reset()}>{sampleBusy ? "Opening the sample…" : data.clubs.some((c) => c.sample) ? "Refresh sample circles ↻" : "Explore sample circles →"}</button></section>}
      <ConnectAgent />
    </main>
  );
}
