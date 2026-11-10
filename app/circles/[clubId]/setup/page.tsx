"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Club } from "@/lib/types";
import CirclePreview from "@/app/components/CirclePreview";
import { LogoMark, longDate } from "@/app/components/ui";

type Data = { club: Club; inviteLinks: Record<string, string> };
export default function SetupCircle() {
  const { clubId } = useParams<{ clubId: string }>();
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(""), [notice, setNotice] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/clubs/${clubId}`, { cache: "no-store" });
      if (res.status === 401) { window.location.assign("/"); return; }
      if (res.status === 404) throw new Error("This circle is no longer available.");
      if (!res.ok) throw new Error("Couldn't refresh your circle. Try again.");
      setData(await res.json());
      setError((prev) => (prev === "Couldn't refresh your circle. Try again." ? "" : prev));
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't refresh your circle. Try again."); }
  }, [clubId]);
  useEffect(() => { void refresh(); const timer = setInterval(refresh, 5000); return () => clearInterval(timer); }, [refresh]);
  async function action(action: string, memberId?: string) {
    const response = await fetch(`/api/clubs/${clubId}/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, memberId }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Couldn't complete that action.");
    return body;
  }
  async function invite(memberId?: string) {
    if (!data) return;
    setBusy(memberId || "all"); setError(""); setNotice("");
    const targets = data.club.members.filter((m) => !m.joinedAt && (memberId ? m.id === memberId : m.invite?.status !== "sent"));
    let sent = 0;
    const failed: string[] = [];
    for (const [index, member] of targets.entries()) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, 600));
      try { await action("invite", member.id); sent++; } catch (err) { failed.push(`${member.name}: ${err instanceof Error ? err.message : "Could not send."}`); }
    }
    setNotice(sent ? `${sent} invitation${sent === 1 ? " is" : "s are"} on the way. Your people can review the rules and join from their email.` : "");
    setError(failed.join(" ")); setBusy(""); await refresh();
  }
  if (!data) return <main className="gather-page"><Link href="/circles">← My circles</Link><p role="status">{error || "Setting the chairs…"}</p></main>;
  const { club } = data;
  const joined = club.members.filter((m) => m.joinedAt).length;
  const active = club.status !== "draft";
  const datePassed = Boolean(club.firstDue && club.firstDue < new Date().toISOString().slice(0, 10));
  return <main className="gather-page"><header className="gather-header"><Link href="/circles" className="brand"><LogoMark /><span className="wordmark">rotapot</span></Link><Link href="/circles">← My circles</Link></header>
    <div className="gather-grid"><section className="gather-work">
      <span className="eyebrow">{active ? "Your circle is moving" : "The chairs are set"}</span><h1>{active ? "Let the good go round." : "Now, bring your people in."}</h1><p className="gather-intro">{active ? "Everyone has agreed. Your first round is ready." : `${club.name} is yours. Send each person their invitation. They'll see the promise, the rules, and exactly when it's their turn.`}</p>
      <div className="gather-checklist"><div className="done"><b>✓</b><span>Circle created<small>{club.name} · US${Number(club.contributionAmount)} each month</small></span></div><div className={joined === club.members.length ? "done" : ""}><b>{joined === club.members.length ? "✓" : "2"}</b><span>Bring everyone in<small>{joined} of {club.members.length} chairs confirmed</small></span></div><div className={active ? "done" : ""}><b>{active ? "✓" : "3"}</b><span>Launch your first round<small>First contributions due {longDate(club.firstDue)}</small></span></div></div>
      {notice && <p className="auth-notice" role="status">{notice}</p>}{error && <p className="err" role="alert">{error}</p>}
      {!active && <div className="setup-actions"><button className="primary-action" disabled={Boolean(busy) || !club.members.some((m) => !m.joinedAt && m.invite?.status !== "sent")} onClick={() => void invite()}>{busy === "all" ? "Sending invitations…" : "Send pending invitations ↗"}</button><Link className="secondary-action" href={`/circles/${club.id}/edit`}>Edit people & promises</Link></div>}
      <ul className="invite-list">{club.members.map((member) => <li key={member.id}><span className={`invite-avatar ${member.joinedAt ? "joined" : ""}`}>{member.joinedAt ? "✓" : member.turn}</span><div className="invite-person"><b>{member.name}</b><small>{member.email || member.paypalEmail}</small><span className={member.joinedAt ? "joined-text" : ""}>{member.joinedAt ? "Chair confirmed" : member.invite?.status === "sent" ? "Invitation sent · waiting for them" : member.invite?.status === "failed" ? "Delivery failed · try again" : member.invite?.status === "sending" ? "Sending…" : "Ready to invite"}</span></div>{!member.joinedAt && !active && <div className="invite-controls"><button className="secondary-action" disabled={Boolean(busy)} onClick={() => void invite(member.id)}>{busy === member.id ? "Sending…" : member.invite?.status === "sent" ? "Resend" : "Send invite"}</button><button className="link-btn" onClick={async () => { try { await navigator.clipboard.writeText(new URL(data.inviteLinks[member.id], window.location.origin).href); setNotice(`Private invitation for ${member.name} copied. Share it only with them; they'll need to verify their email to join.`); } catch { setError("Clipboard access wasn't available. Use Send invite instead."); } }}>Copy private link</button></div>}</li>)}</ul>
      <div className="launch-card"><span className="eyebrow">{active ? "Round 01 is open" : joined === club.members.length ? "Everybody's here" : "Good things take a circle"}</span><h2>{active ? "Your first pot is waiting." : joined === club.members.length ? "Ready when you are." : `${club.members.length - joined} more ${club.members.length - joined === 1 ? "yes" : "yeses"} to go.`}</h2><p>{active ? "Open the dashboard to follow contributions, talk to your AI treasurer, and approve payouts." : "When everyone has accepted, launch the circle to open contributions. The agreed people, amount and order will be locked for this rotation."}</p>
        {datePassed && !active && <p className="err">The first due date has passed. Edit your circle with a future date, then invite everyone to agree again.</p>}
        {active ? <Link className="primary-action" href={`/circles/${club.id}`}>Open my circle →</Link> : <button className="primary-action" disabled={Boolean(busy) || joined !== club.members.length || datePassed} onClick={async () => { setBusy("launch"); setError(""); try { await action("launch"); window.location.assign(`/circles/${club.id}`); } catch (err) { setError(err instanceof Error ? err.message : "Couldn't launch."); setBusy(""); } }}>{busy === "launch" ? "Opening the circle…" : "Launch our first round →"}</button>}
      </div>
      {!active && <><p className="field-help">Need to change the people, date or rotation? Editing renews invitations so everyone agrees to the same promise.</p><div className="cancel-draft">{confirmCancel ? <><p>Cancel {club.name}? Its invitations will stop working. This only removes this unlaunched circle.</p><button className="secondary-action" disabled={Boolean(busy)} onClick={() => setConfirmCancel(false)}>Keep gathering</button><button className="secondary-action" disabled={Boolean(busy)} onClick={async () => { setBusy("cancel"); try { await action("cancel"); window.location.assign("/circles"); } catch (err) { setError(err instanceof Error ? err.message : "Couldn't cancel."); setBusy(""); } }}>Yes, cancel this circle</button></> : <button className="link-btn" onClick={() => setConfirmCancel(true)}>Cancel this draft</button>}</div></>}
    </section><CirclePreview names={club.members.map((m) => m.name)} name={club.name} amount={club.contributionAmount} step={3} /></div>
  </main>;
}
