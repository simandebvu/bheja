"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark, ShweshweDefs } from "./components/ui";

/** A decorative pot: six seats, four paid, turning slowly. */
function HeroRing() {
  const C = 160;
  const R = 112;
  const seats = 6;
  const arc = (a: number, b: number) => {
    const p = (d: number) => `${C + R * Math.cos((d * Math.PI) / 180)} ${C + R * Math.sin((d * Math.PI) / 180)}`;
    return `M ${p(a)} A ${R} ${R} 0 0 1 ${p(b)}`;
  };
  return (
    <svg viewBox="0 0 320 320" className="hero-ring" aria-hidden>
      <ShweshweDefs id="hero" />
      <g className="hero-spin">
        <circle cx={C} cy={C} r={R} fill="none" stroke="url(#hero)" strokeWidth="38" />
        {Array.from({ length: seats }, (_, i) => {
          const c = -90 + i * 60;
          return (
            <g key={i}>
              {i < 4 && <path d={arc(c - 27, c + 27)} stroke="var(--marigold)" strokeWidth="30" fill="none" />}
              <circle cx={C + 150 * Math.cos((c * Math.PI) / 180)} cy={C + 150 * Math.sin((c * Math.PI) / 180)} r="13" fill={i === 0 ? "var(--marigold)" : "rgba(255,255,255,0.9)"} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function SignIn() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <main className="signin">
      <section className="signin-pitch">
        <div className="brand light">
          <LogoMark size={34} />
          <span className="wordmark">rotapot</span>
        </div>
        <h1>
          The AI treasurer
          <br />
          for savings circles.
        </h1>
        <p className="signin-lede">
          Stokvels, mukando, diaspora rounds: millions of people pool money every month on trust and WhatsApp. Rotapot collects through PayPal,
          chases late payers kindly in their own language, and puts each payout in front of the treasurer, who is the only one who can release it.
        </p>
        <HeroRing />
      </section>

      <section className="signin-panel">
        <form
          className="signin-card"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            router.push("/circles");
          }}
        >
          <h2>Sign in</h2>
          <p className="muted">This is a demo account. The details are filled in for you.</p>
          <label>
            Email
            <input type="email" defaultValue="rudo@rotapot.demo" autoComplete="username" />
          </label>
          <label>
            Password
            <input type="password" defaultValue="mukando-2026" autoComplete="current-password" />
          </label>
          <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in as Rudo"}</button>
          <p className="signin-who">
            <b>Rudo Chikwanha</b> · Johannesburg. Treasurer of three circles with members in Zimbabwe, South Africa, the UK, Ireland and the US.
          </p>
        </form>
        <p className="signin-foot">Payments run on PayPal sandbox. No real money moves.</p>
      </section>
    </main>
  );
}
