"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Club, Cycle, Member } from "@/lib/types";
import AgentConsole from "../../components/AgentConsole";
import PassportCard from "../../components/PassportCard";
import Phone from "../../components/Phone";
import PotRing from "../../components/PotRing";
import Rotation from "../../components/Rotation";
import { Avatar, COUNTRY, LogoMark, countriesOf, firstName } from "../../components/ui";
import { circleRecord } from "@/lib/passport";

type State = { payLinks: Record<string, string>; club: Club; paypalMode: "sandbox" | "mock"; agentReady: boolean };
type Sent = { recipient: string; amount: string; batchId: string; batchStatus: string; next: string | null };

function daysLate(due: string) {
  const ms = Date.now() - new Date(`${due}T23:59:59Z`).getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

const dayMonth = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const stamp = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function CircleDashboard() {
  const { clubId } = useParams<{ clubId: string }>();
  const [state, setState] = useState<State | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [missing, setMissing] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState<Set<string>>(new Set());
  const prevPaid = useRef<Set<string> | null>(null);
  const [pouring, setPouring] = useState(false);
  const frozen = useRef(false);
  const [passportOf, setPassportOf] = useState<Member | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const refresh = useCallback(async () => {
    if (frozen.current) return;
    const res = await fetch(`/api/clubs/${clubId}`, { cache: "no-store" });
    if (res.status === 401) { window.location.assign("/"); return; }
    if (res.status === 404) return setMissing(true);
    if (!res.ok) return;
    const next: State = await res.json();
    if (next.club.status === "draft") { window.location.replace(`/circles/${clubId}/setup`); return; }
    const cycle = next.club.cycles.find((c) => c.number === next.club.currentCycle)!;
    const paidNow = new Set(cycle.contributions.filter((c) => c.status === "paid").map((c) => `${cycle.number}:${c.memberId}`));
    if (prevPaid.current) {
      const fresh = [...paidNow].filter((k) => !prevPaid.current!.has(k)).map((k) => k.split(":")[1]);
      if (fresh.length) {
        setJustPaid(new Set(fresh));
        setTimeout(() => setJustPaid(new Set()), 2000);
      }
    }
    prevPaid.current = paidNow;
    setState(next);
    setClubs((prev) => (prev.length ? prev.map((c) => (c.id === next.club.id ? next.club : c)) : [next.club]));
  }, [clubId]);

  useEffect(() => {
    fetch("/api/clubs", { cache: "no-store" }).then((r) => r.json()).then((d) => setClubs((d.clubs ?? []).filter((c: Club) => c.status !== "draft")));
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  async function release() {
    setReleasing(true);
    setReleaseError(null);
    // Freeze the screen before the request: a background refresh landing while PayPal
    // is processing would otherwise show the next cycle's empty pot before the pour.
    frozen.current = true;
    try {
      const res = await fetch("/api/payout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clubId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "PayPal didn't confirm the payout. Nothing was sent. Try again.");
      // Hold the screen on the full pot while the gold pours, then let the circle turn.
      setPouring(true);
      await new Promise((r) => setTimeout(r, 1700));
      setSent(data);
      setNote({
        id: data.batchId,
        text: `Done. **US$${Number(data.amount)}** is on its way to ${data.recipient} through PayPal Payouts, and I've let ${firstName(data.recipient)} know in their circle inbox.${data.next ? ` The circle has turned: next up is **${data.next}**.` : ""}`,
      });
    } catch (err) {
      setReleaseError(err instanceof TypeError ? "Couldn't reach Rotapot. Check your connection; nothing was sent." : err instanceof Error ? err.message : "Something went wrong. Nothing was sent.");
    } finally {
      setPouring(false);
      frozen.current = false;
      setReleasing(false);
      void refresh();
    }
  }

  /** Treasurer puts a fully paid pot up for approval without waiting for the agent. */
  async function prepare() {
    setPreparing(true);
    setReleaseError(null);
    try {
      const res = await fetch("/api/payout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clubId, prepare: true }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't prepare the payout. Try again.");
    } catch (err) {
      setReleaseError(err instanceof TypeError ? "Couldn't reach Rotapot. Check your connection and try again." : err instanceof Error ? err.message : "Couldn't prepare the payout. Try again.");
    } finally {
      setPreparing(false);
      void refresh();
    }
  }

  async function decide(memberId: string, approve: boolean) {
    setDeciding(memberId);
    setPlanError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/plans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, approve }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't save your answer. Try again.");
      }
    } catch (err) {
      setPlanError(err instanceof TypeError ? "Couldn't reach Rotapot. Check your connection and try again." : err instanceof Error ? err.message : "Couldn't save your answer. Try again.");
    } finally {
      setDeciding(null);
      void refresh();
    }
  }

  async function reset() {
    try {
      const response = await fetch("/api/clubs/demo", { method: "POST" });
      if (!response.ok) throw new Error("Couldn't refresh sample circles.");
      window.location.assign("/circles");
    } catch { setReleaseError("Couldn't refresh sample circles. Please try again."); }
  }

  if (missing) {
    return (
      <main className="loading">
        <p>That circle doesn&apos;t exist. <Link href="/circles">Back to your circles</Link></p>
      </main>
    );
  }
  if (!state) {
    return (
      <main className="loading">
        <LogoMark size={40} />
      </main>
    );
  }

  const { club } = state;
  const cycle = club.cycles.find((c) => c.number === club.currentCycle) as Cycle;
  const member = (id: string) => club.members.find((m) => m.id === id) as Member;
  const recipient = member(cycle.recipientId);
  const collected = cycle.contributions.reduce((sum, c) => sum + (c.status === "paid" ? Number(club.contributionAmount) : c.paidAmount ?? 0), 0);
  const pendingPlans = cycle.contributions.filter((c) => c.plan?.status === "pending");
  const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const target = Number(cycle.payout.amount);
  const late = daysLate(cycle.dueDate);
  // Right after a release, the screen can still hold the old cycle for a moment: don't
  // flash the Release button again for a payout that has just been sent.
  const awaiting = cycle.payout.status === "awaiting_approval" && !(sent && sent.recipient === recipient.name);
  // Fully paid but nobody (agent or treasurer) has put it up for approval yet.
  const allPaid = (cycle.payout.status === "none" || cycle.payout.status === "failed") && !sent && cycle.contributions.every((c) => c.status === "paid");
  const flags = countriesOf(club.members.map((m) => m.city));

  return (
    <main className="app">
      <header className="masthead">
        <Link href="/circles" className="brand" aria-label="All circles">
          <LogoMark />
          <span className="wordmark">rotapot</span>
        </Link>
        <div className="club">
          <Link href="/circles" className="crumb">← All circles</Link>
          <h1>{club.name} <span className="kind">{club.kind}</span></h1>
          <p>
            {flags.join(" ")} {club.members.length} members · US${Number(club.contributionAmount)} each, every month · you&apos;re the treasurer
          </p>
        </div>
        <div className="env">
          <span className={`env-pill ${state.paypalMode === "sandbox" ? "live" : ""}`}>
            <i aria-hidden /> PayPal {state.paypalMode === "sandbox" ? "sandbox" : "mock mode"}
          </span>
          {club.sample ? <button className="link-btn" onClick={reset}>Refresh sample circles</button> : <Link className="link-btn" href={`/circles/${club.id}/setup`}>Circle details</Link>}
        </div>
      </header>

      <Rotation club={club} />

      <div className="stage">
        <section className="circle-col" aria-label={`Cycle ${cycle.number}`}>
          <div className="col-head">
            <h2>Cycle {cycle.number} of {club.cycles.length}</h2>
            <span className="muted">Due {dayMonth(cycle.dueDate)}</span>
          </div>

          <PotRing members={club.members} cycle={cycle} collected={collected} target={target} daysLate={late} justPaid={justPaid} pouring={pouring} />

          {pendingPlans.map((c) => {
            const m = member(c.memberId);
            const rec = circleRecord(club, m.id);
            return (
              <div key={m.id} className="request">
                <div className="request-copy">
                  <span className="release-eyebrow">Plan request · needs your answer</span>
                  <b>{m.name} asks to pay in {c.plan!.instalments.length} part{c.plan!.instalments.length > 1 ? "s" : ""}</b>
                  <span className="request-plan">{c.plan!.instalments.map((i) => `US$${Number(i.amount)} by ${shortDate(i.due)}`).join("  ·  ")}</span>
                  <span className="release-why">{c.plan!.reason}</span>
                  {rec && <button className="request-record" onClick={() => setPassportOf(m)}>{rec.onTime} of {rec.payments} paid on time · view passport</button>}
                </div>
                <div className="request-actions">
                  <button className="approve" disabled={deciding === m.id} onClick={() => decide(m.id, true)}>Approve plan</button>
                  <button className="decline" disabled={deciding === m.id} onClick={() => decide(m.id, false)}>Decline</button>
                </div>
              </div>
            );
          })}
          {planError && <p className="err" role="alert">{planError}</p>}

          <div className={`release ${awaiting ? "armed" : sent ? "done" : allPaid ? "ready" : ""}`} aria-live="polite">
            {awaiting ? (
              <>
                <div className="release-copy">
                  <span className="release-eyebrow">Waiting for your approval</span>
                  <b>Release US${target} to {recipient.name}</b>
                  {cycle.payout.proposedReason && <span className="release-why">{cycle.payout.proposedReason}</span>}
                  <span className="release-math">{club.members.length} × US${Number(club.contributionAmount)} received · sent with PayPal Payouts</span>
                </div>
                <button className="release-btn" disabled={releasing} onClick={release}>
                  {releasing ? "Releasing…" : `Release US$${target}`}
                </button>
              </>
            ) : sent ? (
              <div className="release-copy">
                <span className="release-eyebrow">Released</span>
                <b>US${Number(sent.amount)} sent to {sent.recipient}</b>
                <span className="release-batch">PayPal batch <code>{sent.batchId}</code> · {sent.batchStatus.toLowerCase()}</span>
                {sent.next && <span className="release-math">The circle has turned. {sent.next} is next.</span>}
              </div>
            ) : allPaid ? (
              <>
                <div className="release-copy">
                  <span className="release-eyebrow ok">Everyone has paid</span>
                  <b>US${target} is ready for {recipient.name}</b>
                  <span className="release-why">Get it ready, check the details, then release it. Only you can send it.</span>
                </div>
                <button className="secondary-action" disabled={preparing} onClick={prepare}>
                  {preparing ? "Getting it ready…" : "Get payout ready →"}
                </button>
              </>
            ) : (
              <div className="release-copy">
                <span className="release-eyebrow">Payout locked</span>
                <span className="release-why">
                  Unlocks when all {club.members.length} have paid. Rotapot puts it up for approval; only you can release it.
                </span>
              </div>
            )}
            {releaseError && <p className="err" role="alert">{releaseError}</p>}
          </div>

          <ul className="roster">
            {[...cycle.contributions]
              .sort((a, b) => member(a.memberId).turn - member(b.memberId).turn)
              .map((c) => {
                const m = member(c.memberId);
                const country = COUNTRY[m.city];
                const rec = circleRecord(club, m.id);
                return (
                  <li key={m.id} className={c.status}>
                    <button className="roster-person" onClick={() => setPassportOf(m)} title="Open trust passport">
                      <Avatar member={m} size={32} />
                      <div className="roster-who">
                        <b>{m.name}</b>
                        <span>{country?.flag} {m.city} · {m.language}{rec?.payments ? ` · ${Math.round((rec.onTime / rec.payments) * 100)}% on time` : " · First round together"}</span>
                      </div>
                    </button>
                    {c.status === "paid" ? (
                      <span className="tag paid">{c.source === "paypal" ? "Paid via PayPal" : "Paid"}</span>
                    ) : c.status === "pending" ? (
                      <span className="tag pending">At checkout</span>
                    ) : c.plan?.status === "approved" ? (
                      <a className="tag plan" href={state.payLinks[m.id]} target="_blank" rel="noreferrer">
                        Plan · {c.paidAmount ? `US$${c.paidAmount} in, ` : ""}next by {shortDate(c.plan.instalments.find((i) => !i.paid)?.due ?? cycle.dueDate)} ↗
                      </a>
                    ) : c.plan?.status === "pending" ? (
                      <span className="tag pending">Plan requested</span>
                    ) : (
                      <a className={`tag ${late > 0 ? "late" : "due"}`} href={state.payLinks[m.id]} target="_blank" rel="noreferrer" aria-label={`${late > 0 ? `${late} days late` : `Due ${dayMonth(cycle.dueDate)}`}. Open ${firstName(m.name)}'s pay page`}>
                        {late > 0 ? `${late}d late` : `Due ${dayMonth(cycle.dueDate)}`} · Pay ↗
                      </a>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>

        <div className="mid-col">
          <AgentConsole club={club} clubs={clubs.length ? clubs : [club]} ready={state.agentReady} onChange={refresh} note={note} />
          <section className="ledger" aria-label="Ledger">
            <div className="col-head"><h2>Ledger</h2></div>
            <ol>
              {[...club.activity].reverse().slice(0, 12).map((a, i) => (
                <li key={`${a.at}-${i}`} className={`k-${a.kind}`}>
                  <time>{stamp(a.at)}</time>
                  <span>{a.text}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <Phone
          club={club}
          clubs={clubs.length ? clubs : [club]}
          onChange={refresh}
          onAgentNote={(text) => setNote({ id: `${Date.now()}`, text })}
        />
      </div>
      {passportOf && <PassportCard member={passportOf} clubs={clubs.length ? clubs : [club]} onClose={() => setPassportOf(null)} />}
    </main>
  );
}
