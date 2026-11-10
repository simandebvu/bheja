"use client";

import { useEffect, useState } from "react";
import type { Member, Nudge } from "@/lib/types";
import { Avatar, firstName, initials } from "./ui";

const URL_RE = /(https?:\/\/\S+)/;

function time(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Split a reminder into the member-language part and the EN: translation line. */
function splitMessage(text: string) {
  const lines = text.split("\n");
  const enIdx = lines.findIndex((l) => l.trim().startsWith("EN:"));
  const main = (enIdx >= 0 ? lines.slice(0, enIdx) : lines).join("\n").trim();
  const en = enIdx >= 0 ? lines.slice(enIdx).join("\n").replace(/^\s*EN:\s*/, "").trim() : null;
  return { main, en };
}

function Body({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        URL_RE.test(p) ? <span key={i} className="wa-link">{p.replace(/^https?:\/\//, "")}</span> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

/**
 * What the member sees: reminders arriving in a WhatsApp-style chat.
 * Follows the most recent reminder automatically.
 */
export default function Phone({ members, outbox, clubName }: { members: Member[]; outbox: Nudge[]; clubName: string }) {
  const recipients = members.filter((m) => outbox.some((n) => n.memberId === m.id));
  const latest = outbox[outbox.length - 1]?.memberId;
  const [selected, setSelected] = useState<string | undefined>(latest);
  const [showEn, setShowEn] = useState(false);

  useEffect(() => {
    if (latest) setSelected(latest);
  }, [latest, outbox.length]);

  const member = members.find((m) => m.id === selected);
  const thread = outbox.filter((n) => n.memberId === selected);

  return (
    <section className="phone-col" aria-label="What members receive">
      <div className="col-head">
        <h2>On their phones</h2>
        {recipients.length > 0 && (
          <label className="toggle">
            <input type="checkbox" checked={showEn} onChange={(e) => setShowEn(e.target.checked)} /> Show English
          </label>
        )}
      </div>
      {recipients.length > 0 && (
        <div className="phone-tabs" role="tablist">
          {recipients.map((m) => (
            <button key={m.id} role="tab" aria-selected={m.id === selected} className={m.id === selected ? "on" : ""} onClick={() => setSelected(m.id)}>
              {firstName(m.name)}
            </button>
          ))}
        </div>
      )}
      <div className="phone">
        <div className="phone-notch" aria-hidden />
        <div className="wa-head">
          <span className="wa-group" aria-hidden>{initials(clubName)}</span>
          <div>
            <b>{clubName}</b>
            <span>{member ? `to ${member.name} · ${member.language}` : "treasurer bot"}</span>
          </div>
        </div>
        <div className="wa-body">
          {thread.length === 0 ? (
            <div className="wa-empty">
              <p>Reminders, receipts and payout notices arrive here, in each member&apos;s own language.</p>
              <p className="hint">Ask the agent to remind whoever&apos;s late</p>
            </div>
          ) : (
            thread.map((n) => {
              const { main, en } = splitMessage(n.message);
              const link = n.message.match(URL_RE)?.[1];
              return (
                <div key={n.id} className={`wa-msg wa-${n.kind ?? "reminder"}`}>
                  {n.kind === "payout" && <span className="wa-tag">Payout</span>}
                  {n.kind === "receipt" && <span className="wa-tag">Receipt</span>}
                  <div className="wa-bubble">
                    <Body text={showEn && en ? en : main.replace(URL_RE, "").replace(/\s+([.!?])/g, "$1").trim()} />
                    {link && n.kind !== "receipt" && n.kind !== "payout" && (
                      <div className="wa-card">
                        <span className="wa-card-label">Pay your contribution</span>
                        <span className="wa-card-host">{link.replace(/^https?:\/\//, "").split("/")[0]}</span>
                        <span className="wa-card-cta">Pay with PayPal</span>
                      </div>
                    )}
                    <span className="wa-time">{time(n.createdAt)} ✓✓</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {member && (
          <div className="wa-foot">
            <Avatar member={member} size={22} />
            <span>{member.city}</span>
          </div>
        )}
      </div>
    </section>
  );
}
