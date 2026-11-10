"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { memberView } from "@/lib/invitations";
import { LogoMark, longDate } from "@/app/components/ui";

type View = ReturnType<typeof memberView>;
export default function MemberHome() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<View | null>(null), [error, setError] = useState("");
  useEffect(() => {
    async function load() { try {
      const response = await fetch(`/api/members/${id}`, { cache: "no-store" });
      if (response.status === 401) { window.location.assign(`/?next=${encodeURIComponent(`/members/${id}`)}`); return; }
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setView(body); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't refresh your membership."); } }
    void load(); const timer = setInterval(load, 5000); return () => clearInterval(timer);
  }, [id]);
  return <main className="member-home"><header className="gather-header"><Link href="/circles" className="brand"><LogoMark /><span className="wordmark">rotapot</span></Link><Link href="/circles">All my circles ↗</Link></header>
    {error && <p className="err" role="alert">{error}</p>}{view ? <><section className="member-welcome"><span className="eyebrow">Your chair is confirmed ✓</span><h1>You belong here,<br />{view.memberName.split(" ")[0]}.</h1><p>{view.name} · {view.purpose}</p><div className="member-metrics"><div><b>US${Number(view.amount)}</b><span>your monthly promise</span></div><div><b>US${Number(view.amount) * view.count}</b><span>the pot on your turn</span></div><div><b>{String(view.turn).padStart(2, "0")}</b><span>your turn in the circle</span></div></div></section>
      <section className="member-next"><span className="eyebrow">Your next good move</span><h2>{view.status === "draft" ? view.joined === view.count ? "Everyone’s in. Your treasurer is up next." : "You're in. Let the others catch up." : view.cycle?.paid ? "Your promise, kept." : "Time to put your little in."}</h2><p>{view.status === "draft" ? `${view.joined} of ${view.count} people have joined. ${view.treasurer} will open contributions when everyone is ready. You can return here from My circles.` : view.cycle?.paid ? `You're paid up for round ${view.cycle.number}. This month's pot goes to ${view.cycle.recipient}.` : `Round ${view.cycle?.number} · due ${longDate(view.cycle?.dueDate)}. This month's pot goes to ${view.cycle?.recipient}.`}</p>{view.payUrl && !view.cycle?.paid && <Link className="primary-action" href={view.payUrl}>Contribute US${Number(view.amount)} →</Link>}<span className="field-help">PayPal sandbox · no real money moves</span></section>
      {view.schedule.length > 0 && <section className="member-schedule"><h2>Good things go round.</h2><p className="gather-intro">One pot. One person. Every month.</p><ol className="review-rotation">{view.schedule.map((round) => <li key={round.number} className={round.mine ? "my-turn" : ""}><b>{round.paidOut ? "✓" : round.number}</b><span>{round.mine ? "Your turn" : round.name}<small>{longDate(round.dueDate)}{round.paidOut ? " · pot released" : ""}</small></span></li>)}</ol></section>}
      <details className="member-rules"><summary>Our circle's shared promises</summary><ul className="circle-rules">{view.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul></details>
    </> : !error && <p role="status">Finding your circle…</p>}
  </main>;
}
