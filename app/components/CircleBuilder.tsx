"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { LANGUAGES, type Club, type Language } from "@/lib/types";
import CirclePreview from "./CirclePreview";
import { LogoMark, longDate } from "./ui";

type Person = { paypalEmail?: string; name: string; email: string; city: string; language: Language };
type Draft = { name: string; kind: string; purpose: string; contributionAmount: string; firstDue: string; customRule: string; members: Person[] };
const titles = ["Give your circle a name.", "Make a monthly promise.", "Pull up a chair for your people.", "Look at what you're starting."];
const steps = ["Your circle", "The promise", "Your people", "Ready to gather"];
const blankPerson = (): Person => ({ name: "", email: "", city: "", language: "English" });
const futureDate = () => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

export default function CircleBuilder({ editId }: { editId?: string }) {
  const { data: session } = authClient.useSession();
  const [draft, setDraft] = useState<Draft>({ name: "", kind: "Stokvel", purpose: "", contributionAmount: "50", firstDue: futureDate(), customRule: "", members: [] });
  const [step, setStep] = useState(0), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const key = `rotapot-circle-draft:${session?.user.id}:${editId || "new"}`;
  useEffect(() => {
    if (!session || ready) return;
    (async () => {
      try {
        if (editId) {
          const response = await fetch(`/api/clubs/${editId}`);
          if (!response.ok) throw new Error("This circle couldn't be loaded.");
          const { club }: { club: Club } = await response.json();
          if (club.status !== "draft") throw new Error("This circle has already launched. Its agreed rules and rotation are locked.");
          setDraft({ name: club.name, kind: club.kind, purpose: club.purpose, contributionAmount: club.contributionAmount, firstDue: club.firstDue!, customRule: club.rules[4] || "", members: club.members.map((m) => ({ name: m.name, email: m.email!, city: m.city, language: m.language, paypalEmail: m.paypalEmail })) });
        } else {
          let cached: Draft | null = null;
          try { cached = JSON.parse(sessionStorage.getItem(key) || "null"); } catch { /* storage may be unavailable */ }
          if (cached && Array.isArray(cached.members) && cached.members.some((m) => m.email === session.user.email)) setDraft(cached);
          else setDraft((value) => ({ ...value, members: [{ name: session.user.name, email: session.user.email, city: "", language: "English" }, blankPerson()] }));
        }
        setReady(true);
      } catch (err) { setError(err instanceof Error ? err.message : "Couldn't load your circle."); }
    })();
  }, [session, ready, editId, key]);
  useEffect(() => {
    if (!ready || editId) return;
    try { sessionStorage.setItem(key, JSON.stringify(draft)); setSaved(true); } catch { setSaved(false); }
  }, [draft, ready, key, editId]);
  const change = (field: keyof Draft, value: string) => setDraft((d) => ({ ...d, [field]: value }));
  const person = (index: number, field: keyof Person, value: string) => setDraft((d) => ({ ...d, members: d.members.map((m, i) => i === index ? { ...m, [field]: value } : m) }));
  function move(index: number, direction: number) {
    setDraft((d) => { const members = [...d.members]; [members[index], members[index + direction]] = [members[index + direction], members[index]]; return { ...d, members }; });
  }
  async function submit() {
    setError("");
    if (step === 2) {
      const emails = draft.members.map((m) => m.email.trim().toLowerCase());
      if (new Set(emails).size !== emails.length) { setError("Each chair needs a different email address."); return; }
    }
    if (step < 3) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setBusy(true);
    try {
      const res = await fetch(editId ? `/api/clubs/${editId}/setup` : "/api/clubs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editId ? { action: "edit", circle: draft } : draft) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save your circle. Your draft is still here.");
      try { sessionStorage.removeItem(key); } catch { /* optional browser storage */ }
      window.location.assign(`/circles/${data.club.id}/setup?created=1`);
    } catch (err) { setError(err instanceof Error ? err.message : "Connection lost. Your draft is still here; try again."); setBusy(false); }
  }
  return <main className="gather-page">
    <header className="gather-header"><Link href="/circles" className="brand"><LogoMark /><span className="wordmark">rotapot</span></Link><Link href="/circles">{editId ? "Back to circles ↗" : "Save it for later ↗"}</Link></header>
    <div className="gather-grid builder-grid">
      <section className="gather-work">
        <nav className="stepper" aria-label="Circle setup">{steps.map((label, index) => <span key={label} className={index === step ? "current" : index < step ? "complete" : ""} aria-current={index === step ? "step" : undefined}><b>{index < step ? "✓" : `0${index + 1}`}</b>{label}</span>)}</nav>
        <span className="eyebrow">{editId ? "Make room for a change" : "Your first good move"} / 0{step + 1}</span>
        <h1 tabIndex={-1}>{titles[step]}</h1>
        <p className="gather-intro">{["A stokvel, a mukando, a round with old friends. Whatever you call it, make it yours.", "Choose an amount everyone can keep showing up for. Rotapot takes care of the remembering.", "You're in the circle too. Add names, emails and languages, then arrange the payout order together.", "Your people will see these exact terms before they join. You'll send invitations on the next screen."][step]}</p>
        {!ready ? <p role="status">{error || "Finding your chair…"}</p> : <form className="gather-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          {step === 0 && <>
            <fieldset className="kind-picker"><legend>What do your people call it?</legend>{["Stokvel", "Mukando", "Diaspora round", "Savings circle"].map((kind) => <label key={kind} className={draft.kind === kind ? "selected" : ""}><input type="radio" name="kind" checked={draft.kind === kind} onChange={() => change("kind", kind)} />{kind}</label>)}</fieldset>
            <label>Circle name<input value={draft.name} onChange={(e) => change("name", e.target.value)} required maxLength={80} placeholder="e.g. Sunday Sisters" autoFocus /></label>
            <label>What are you making possible?<textarea value={draft.purpose} onChange={(e) => change("purpose", e.target.value)} required maxLength={300} rows={3} placeholder="School fees. A first home. A little breathing room. Tell your people why." /></label>
            <div className="idea-chips">{["School fees, without the scramble", "A home, one brick at a time", "Big dreams with old friends"].map((idea) => <button type="button" key={idea} onClick={() => change("purpose", idea)}>{idea}</button>)}</div>
          </>}
          {step === 1 && <>
            <label>Each person contributes, every month<div className="money-input"><span>US$</span><input aria-label="Monthly contribution" type="number" min="1" max="10000" step="0.01" required value={draft.contributionAmount} onChange={(e) => change("contributionAmount", e.target.value)} /></div></label>
            <div className="idea-chips">{[25, 50, 100, 200].map((amount) => <button type="button" key={amount} onClick={() => change("contributionAmount", String(amount))}>${amount}</button>)}</div>
            <label>First contribution due<input type="date" required min={new Date().toISOString().slice(0, 10)} value={draft.firstDue} onChange={(e) => change("firstDue", e.target.value)} /></label>
            <p className="field-help">Give everyone time to accept. After that, contributions fall on this day each month (or the last day of shorter months).</p>
            <div className="promise-note"><b>One promise we always keep</b><p>The pot only goes out once everyone has paid, and only when you approve it.</p></div>
            <label>Anything else your circle should agree to? <small>Optional</small><textarea value={draft.customRule} onChange={(e) => change("customRule", e.target.value)} maxLength={600} rows={2} placeholder="e.g. If you need more time, let us know before the due date." /></label>
            <p className="field-help">This version uses USD and monthly rotations through PayPal sandbox. No real money moves.</p>
          </>}
          {step === 2 && <>
            <p className="field-help">The first chair receives the first pot. Use the arrows to choose the order before anyone is invited. Members can set their payout email when joining.</p>
            <div className="chair-list">{draft.members.map((m, index) => <fieldset className="chair-editor" key={index}><legend><b>{String(index + 1).padStart(2, "0")}</b> {m.email === session?.user.email ? "Your chair · treasurer" : `Chair ${index + 1}`}</legend>
              <div className="chair-fields"><label>Name<input value={m.name} required maxLength={80} onChange={(e) => person(index, "name", e.target.value)} autoComplete="off" /></label><label>Email<input type="email" value={m.email} required maxLength={254} readOnly={m.email === session?.user.email} onChange={(e) => person(index, "email", e.target.value)} autoComplete="off" /></label><label>City<input value={m.city} required maxLength={80} onChange={(e) => person(index, "city", e.target.value)} placeholder="e.g. Johannesburg" /></label><label>Preferred language<select value={m.language} onChange={(e) => person(index, "language", e.target.value)}>{LANGUAGES.map((lang) => <option key={lang}>{lang}</option>)}</select></label></div>
              {m.email === session?.user.email && <label className="owner-payout">Your PayPal sandbox payout email<input type="email" value={m.paypalEmail ?? m.email} required maxLength={254} onChange={(e) => person(index, "paypalEmail", e.target.value)} /><small>Where your pot goes on your turn. Use your sandbox personal account for testing.</small></label>}
              <div className="chair-actions"><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move chair ${index + 1} earlier`}>↑ Earlier</button><button type="button" disabled={index === draft.members.length - 1} onClick={() => move(index, 1)} aria-label={`Move chair ${index + 1} later`}>↓ Later</button>{m.email !== session?.user.email && <button type="button" disabled={draft.members.length <= 2} onClick={() => setDraft((d) => ({ ...d, members: d.members.filter((_, i) => i !== index) }))}>Remove</button>}</div>
            </fieldset>)}</div>
            <button type="button" className="add-chair" disabled={draft.members.length >= 20} onClick={() => setDraft((d) => ({ ...d, members: [...d.members, blankPerson()] }))}>＋ Pull up another chair <span>{draft.members.length}/20</span></button>
          </>}
          {step === 3 && <>
            <div className="review-promise"><span>{draft.kind}</span><h2>{draft.name}</h2><p>{draft.purpose}</p><div><b>US${Number(draft.contributionAmount)}<small>each / month</small></b><b>{draft.members.length}<small>people</small></b><b>US${Number(draft.contributionAmount) * draft.members.length}<small>monthly pot</small></b></div><p>First contributions: <strong>{longDate(draft.firstDue)}</strong></p></div>
            <h3>The agreed rotation</h3><ol className="review-rotation">{draft.members.map((m, i) => <li key={i}><b>{i + 1}</b><span>{m.name}<small>{m.email} · {m.language}</small></span></li>)}</ol>
            {draft.customRule && <div className="promise-note"><b>Your extra rule</b><p>{draft.customRule}</p></div>}
            <p className="field-help">Everyone gets one turn. Members review and accept the same contribution, date and rules. You launch when every chair is confirmed.</p>
            {editId && <p className="err">Saving changes replaces previous invitations and asks everyone to accept again. No money has moved.</p>}
          </>}
          {error && <p role="alert" className="err">{error}</p>}
          <div className="gather-controls">{step > 0 ? <button type="button" className="secondary-action" disabled={busy} onClick={() => { setStep(step - 1); setError(""); }}>← Back</button> : <span className="field-help">{saved ? "Draft saved in this browser" : "About three minutes"}</span>}<button className="primary-action" disabled={busy}>{busy ? "Saving your circle…" : step === 3 ? editId ? "Save & renew invitations →" : "Create my circle →" : "Keep going →"}</button></div>
        </form>}
      </section>
      {(ready || !editId) && <CirclePreview name={draft.name} amount={draft.contributionAmount} names={draft.members.map((m) => m.name)} step={step} />}
    </div>
  </main>;
}
