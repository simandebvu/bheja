"use client";

import { useEffect, useRef } from "react";
import { passportFor, sinceLabel } from "@/lib/passport";
import type { Club, Member } from "@/lib/types";
import { Avatar, COUNTRY } from "./ui";

const LEVEL_NOTE: Record<string, string> = {
  "Rock solid": "Pays on time, almost without exception.",
  Reliable: "Pays on time the vast majority of months.",
  Mixed: "Often pays, sometimes late. Worth a gentle eye.",
  Building: "New to Rotapot: not enough history yet.",
};

/** A member's trust passport: their payment record across every circle. */
export default function PassportCard({ member, clubs, onClose }: { member: Member; clubs: Club[]; onClose: () => void }) {
  const p = passportFor(clubs, member.name);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="passport-backdrop" onClick={onClose}>
      <aside className="passport" role="dialog" aria-modal="true" aria-label={`Trust passport for ${member.name}`} onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} className="passport-close" onClick={onClose} aria-label="Close">×</button>
        <div className="passport-top">
          <span className="passport-eyebrow">Trust passport</span>
          <div className="passport-who">
            <Avatar member={member} size={52} />
            <div>
              <h2>{member.name}</h2>
              <p>{COUNTRY[member.city]?.flag} {member.city} · saving with circles since {sinceLabel(p.since)}</p>
            </div>
          </div>
          <div className={`passport-level lvl-${p.level.replace(" ", "-").toLowerCase()}`}>
            <b>{p.level}</b>
            <span>{LEVEL_NOTE[p.level]}</span>
          </div>
        </div>

        <dl className="passport-stats">
          <div><dt>On time</dt><dd>{p.payments ? `${Math.round(p.onTimeRate * 100)}%` : "—"}</dd></div>
          <div><dt>Payments</dt><dd>{p.payments}</dd></div>
          <div><dt>Streak</dt><dd>{p.streak}</dd></div>
          <div><dt>Paid in</dt><dd>US${p.contributed.toLocaleString()}</dd></div>
        </dl>

        {p.circles.map((c) => (
          <section key={c.clubId} className="passport-circle">
            <div className="passport-circle-head">
              <b>{c.clubName}</b>
              <span>{c.onTime} of {c.payments} on time · since {sinceLabel(c.since)}</span>
            </div>
            <div className="dots" aria-label={`Last ${Math.min(36, c.dots.length)} payments`}>
              {c.dots.slice(-36).map((d, i) => <i key={i} className={d} />)}
            </div>
          </section>
        ))}
        <p className="passport-foot">Every contribution through Rotapot adds to this record. In time it&apos;s the credit history most members have never had.</p>
      </aside>
    </div>
  );
}
