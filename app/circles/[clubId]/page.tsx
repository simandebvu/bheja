"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Club, Cycle, Member } from "@/lib/types";
import AgentConsole from "../../components/AgentConsole";
import Phone from "../../components/Phone";
import PotRing from "../../components/PotRing";
import Rotation from "../../components/Rotation";
import { Avatar, COUNTRY, LogoMark, countriesOf, firstName } from "../../components/ui";

type State = { club: Club; paypalMode: "sandbox" | "mock"; agentReady: boolean };
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

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/clubs/${clubId}`, { cache: "no-store" });
    if (res.status === 404) return setMissing(true);
    if (!res.ok) return;
    const next: State = await res.json();
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
    fetch("/api/clubs", { cache: "no-store" }).then((r) => r.json()).then((d) => setClubs(d.clubs));
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  async function release() {
    setReleasing(true);
    setReleaseError(null);
    const res = await fetch("/api/payout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clubId }) });
    const data = await res.json();
    if (res.ok) {
      setSent(data);
      setNote({
        id: data.batchId,
        text: `Done. **US$${data.amount}** is on its way to ${data.recipient} through PayPal Payouts, and I've let ${firstName(data.recipient)} know on WhatsApp.${data.next ? ` The circle has turned: next up is **${data.next}**.` : ""}`,
      });
    } else setReleaseError(data.error);
    setReleasing(false);
    refresh();
  }

  async function reset() {
    await fetch("/api/clubs", { method: "POST" });
    setSent(null);
    setNote(null);
    setReleaseError(null);
    prevPaid.current = null;
    refresh();
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
  const paid = cycle.contributions.filter((c) => c.status === "paid").length;
  const collected = paid * Number(club.contributionAmount);
  const target = Number(cycle.payout.amount);
  const late = daysLate(cycle.dueDate);
  const awaiting = cycle.payout.status === "awaiting_approval";
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
          <button className="link-btn" onClick={reset}>Reset demo</button>
        </div>
      </header>

      <Rotation club={club} />

      <div className="stage">
        <section className="circle-col" aria-label={`Cycle ${cycle.number}`}>
          <div className="col-head">
            <h2>Cycle {cycle.number} of {club.cycles.length}</h2>
            <span className="muted">Due {dayMonth(cycle.dueDate)}</span>
          </div>

          <PotRing members={club.members} cycle={cycle} collected={collected} target={target} daysLate={late} justPaid={justPaid} />

          <div className={`release ${awaiting ? "armed" : sent ? "done" : ""}`}>
            {awaiting ? (
              <>
                <div className="release-copy">
                  <span className="release-eyebrow">Waiting for your approval</span>
                  <b>Release US${cycle.payout.amount} to {recipient.name}</b>
                  {cycle.payout.proposedReason && <span className="release-why">{cycle.payout.proposedReason}</span>}
                  <span className="release-math">{club.members.length} × US${club.contributionAmount} received · sent with PayPal Payouts</span>
                </div>
                <button className="release-btn" disabled={releasing} onClick={release}>
                  {releasing ? "Releasing…" : `Release US$${Number(cycle.payout.amount)}`}
                </button>
              </>
            ) : sent ? (
              <div className="release-copy">
                <span className="release-eyebrow">Released</span>
                <b>US${sent.amount} sent to {sent.recipient}</b>
                <span className="release-batch">PayPal batch <code>{sent.batchId}</code> · {sent.batchStatus.toLowerCase()}</span>
                {sent.next && <span className="release-math">The circle has turned. {sent.next} is next.</span>}
              </div>
            ) : (
              <div className="release-copy">
                <span className="release-eyebrow">Payout locked</span>
                <span className="release-why">
                  Unlocks when all {club.members.length} have paid. The agent puts it up for approval; only you can release it.
                </span>
              </div>
            )}
            {releaseError && <p className="err">{releaseError}</p>}
          </div>

          <ul className="roster">
            {[...cycle.contributions]
              .sort((a, b) => member(a.memberId).turn - member(b.memberId).turn)
              .map((c) => {
                const m = member(c.memberId);
                const country = COUNTRY[m.city];
                return (
                  <li key={m.id} className={c.status}>
                    <Avatar member={m} size={32} />
                    <div className="roster-who">
                      <b>{m.name}</b>
                      <span>{country?.flag} {m.city} · {m.language}</span>
                    </div>
                    {c.status === "paid" ? (
                      <span className="tag paid">{c.source === "paypal" ? "Paid via PayPal" : "Paid"}</span>
                    ) : c.status === "pending" ? (
                      <span className="tag pending">At checkout</span>
                    ) : (
                      <a className={`tag ${late > 0 ? "late" : "due"}`} href={`/pay/${club.id}/${m.id}`} target="_blank" rel="noreferrer" title="Open this member's pay page">
                        {late > 0 ? `${late}d late` : `Due ${dayMonth(cycle.dueDate)}`} · pay page ↗
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

        <Phone members={club.members} outbox={club.outbox} clubName={club.name} />
      </div>
    </main>
  );
}
