"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/auth-navigation";
import AuthForm from "./AuthForm";
import { LogoMark, ShweshweDefs } from "./ui";

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

export default function SignInView({ googleEnabled }: { googleEnabled: boolean }) {
  // Signed-in people (including straight after clicking a verification link) skip the form.
  const { data: session } = authClient.useSession();
  useEffect(() => {
    if (!session?.user.emailVerified) return;
    const query = new URLSearchParams(window.location.search);
    if (query.has("error")) return;
    window.location.replace(safeNext(query.get("next")));
  }, [session]);

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
          <span className="lede-long">
            Stokvels, mukando, diaspora rounds: millions of people pool money every month on trust and WhatsApp. Rotapot collects through PayPal,
            chases late payers kindly in their own language, and puts each payout in front of the treasurer, who is the only one who can release it.
          </span>
          <span className="lede-short">Collects through PayPal, reminds kindly in each member&apos;s language. Only the treasurer releases a payout.</span>
        </p>
        <HeroRing />
      </section>

      <section className="signin-panel">
        <AuthForm googleEnabled={googleEnabled} />
        <p className="signin-foot">Payments run on PayPal sandbox. No real money moves.</p>
      </section>
    </main>
  );
}
