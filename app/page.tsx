"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Club, Cycle, Member } from "@/lib/types";
import AgentConsole from "./components/AgentConsole";
import Phone from "./components/Phone";
import PotRing from "./components/PotRing";
import Rotation from "./components/Rotation";
import { Avatar, COUNTRY, LogoMark, firstName } from "./components/ui";

type State = { club: Club; paypalMode: "sandbox" | "mock"; agentReady: boolean };
type Sent = { recipient: string; amount: string; batchId: string; batchStatus: string };

function daysLate(due: string) {
  const ms = Date.now() - new Date(`${due}T23:59:59Z`).getTime();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Treasury() {
  const [state, setState] = useState<State | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState<Set<string>>(new Set());
  const prevPaid = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
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
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  async function release(recipient: Member, amount: string) {
    setReleasing(true);
    setReleaseError(null);
    const res = await fetch("/api/payout", { method: "POST" });
    const data = await res.json();
    if (res.ok) setSent({ recipient: recipient.name, amount, batchId: data.batchId, batchStatus: data.batchStatus });
    else setReleaseError(data.error);
    setReleasing(false);
    refresh();
  }

  async function reset() {
    await fetch("/api/state", { method: "POST" });
    setSent(null);
    setReleaseError(null);
    prevPaid.current = null;
    refresh();
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

  return (
    <main className="app">
      <header className="masthead">
        <div className="brand">
          <LogoMark />
          <span className="wordmark">rotapot</span>
        </div>
        <div className="club">
          <h1>{club.name}</h1>
          <p>
            {club.members.length} members in Zimbabwe, South Africa and the UK · US${club.contributionAmount} each, every month · treasurer: {club.treasurerName}
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
            <span className="muted">Due {new Date(`${cycle.dueDate}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</span>
          </div>

          <PotRing members={club.members} cycle={cycle} collected={collected} target={target} daysLate={late} justPaid={justPaid} />

          <div className={`release ${awaiting ? "armed" : ""}`}>
            {awaiting ? (
              <>
                <div className="release-copy">
                  <span className="release-eyebrow">Waiting for your approval</span>
                  <b>Release US${cycle.payout.amount} to {recipient.name}</b>
                  <span className="release-why">{cycle.payout.proposedReason}</span>
                  <span className="release-math">{club.members.length} × US${club.contributionAmount} received · paid out through PayPal Payouts</span>
                </div>
                <button className="release-btn" disabled={releasing} onClick={() => release(recipient, cycle.payout.amount)}>
                  {releasing ? "Releasing…" : `Release US$${cycle.payout.amount}`}
                </button>
              </>
            ) : sent ? (
              <div className="release-copy">
                <span className="release-eyebrow ok">Released</span>
                <b>US${sent.amount} sent to {sent.recipient}</b>
                <span className="release-math">PayPal batch {sent.batchId} · {sent.batchStatus.toLowerCase()} · the circle has turned to {firstName(recipient.name)}</span>
              </div>
            ) : (
              <div className="release-copy">
                <span className="release-eyebrow">Payout locked</span>
                <span className="release-why">
                  Unlocks when all {club.members.length} have paid. The agent proposes it; only you can release it.
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
                      <a className="tag late" href={`/pay/${m.id}`} target="_blank" rel="noreferrer" title="Open this member's pay page">
                        {late > 0 ? `${late}d late` : "Unpaid"} · pay page ↗
                      </a>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>

        <div className="mid-col">
          <AgentConsole members={club.members} ready={state.agentReady} onChange={refresh} />
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
