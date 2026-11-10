"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { invitationPreview } from "@/lib/invitations";
import { LogoMark, longDate } from "@/app/components/ui";
import CirclePreview from "@/app/components/CirclePreview";

type Preview = ReturnType<typeof invitationPreview>;
export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { data: session, isPending } = authClient.useSession();
  const [invite, setInvite] = useState<Preview | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [payoutEmail, setPayoutEmail] = useState("");
  useEffect(() => { if (session) setPayoutEmail(session.user.email); }, [session]);
  useEffect(() => {
    fetch(`/api/join/${token}`, { cache: "no-store" }).then(async (res) => { const body = await res.json(); if (!res.ok) throw new Error(body.error); setInvite(body); }).catch((err) => setError(err.message || "Couldn't open this invitation. Try refreshing."));
  }, [token]);
  const next = encodeURIComponent(`/join/${token}`);
  return <main className="gather-page"><header className="gather-header"><Link href="/" className="brand"><LogoMark /><span className="wordmark">rotapot</span></Link><span className="env-pill">A private invitation</span></header>
    {!invite ? <section className="invitation-error"><h1>{error ? "Let's find your chair." : "Opening your invitation…"}</h1><p role="status">{error || "One moment."}</p><Link href="/circles">Go to my circles →</Link></section> : <div className="gather-grid"><section className="gather-work"><span className="eyebrow">{invite.treasurer} saved you a chair</span><h1>{invite.memberName.split(" ")[0]}, you're part of this.</h1><p className="gather-intro">Welcome to <b>{invite.name}</b>. {invite.purpose}</p><div className="review-promise"><span>The promise you're joining</span><div><b>US${Number(invite.amount)}<small>each / month</small></b><b>US${Number(invite.pot)}<small>your turn's pot</small></b><b>{String(invite.turn).padStart(2, "0")}<small>your turn</small></b></div><p>First contributions due <b>{longDate(invite.firstDue)}</b></p></div>
      <h2 className="section-title">Everyone on the same page.</h2><ul className="circle-rules">{invite.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      <p className="promise-note">This is a PayPal sandbox circle. No real money moves. When contributions open, use a PayPal sandbox buyer account.</p>
      {!session ? <div className="join-actions"><p>This chair is reserved for <b>{invite.emailHint}</b>. Verify that email to join.</p><Link className="primary-action" href={`/sign-up?next=${next}`}>Create an account & join →</Link><Link href={`/?next=${next}`}>Already have an account? Sign in</Link></div> : <form className="gather-form" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError("");
        try {
          const res = await fetch(`/api/join/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acceptRules: true, paypalEmail: payoutEmail }) });
          const body = await res.json(); if (!res.ok) throw new Error(body.error);
          window.location.assign(`/members/${body.id}?welcome=1`);
        } catch (err) { setError(err instanceof Error ? err.message : "Couldn't join. Please try again."); setBusy(false); }
      }}><p className="field-help">Signed in as <b>{session.user.email}</b>. This must match the invitation email.</p><label>Your PayPal sandbox payout email<input type="email" required maxLength={254} value={payoutEmail} onChange={(e) => setPayoutEmail(e.target.value)} /></label><p className="field-help">This is where your pot will go on your turn. For testing, use a PayPal sandbox personal account email.</p><label className="agreement"><input type="checkbox" required /> <span>I agree to the monthly contribution, payout order and circle rules above.</span></label>{error && <p role="alert" className="err">{error}</p>}<button className="primary-action" disabled={busy || isPending}>{busy ? "Saving your chair…" : invite.joined ? "Open my membership →" : "I'm in. Save my chair →"}</button><button type="button" className="link-btn" onClick={async () => { const result = await authClient.signOut(); if (result.error) setError("Couldn't sign out. Try again."); else window.location.reload(); }}>Use a different account</button></form>}
    </section><CirclePreview name={invite.name} names={invite.members.map((m) => m.name)} amount={invite.amount} step={3} /></div>}
  </main>;
}
