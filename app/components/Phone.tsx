"use client";

import { useEffect, useRef, useState } from "react";
import type { Club, Language, Member } from "@/lib/types";
import { streamAgent, Trace, upsertStep, type Step } from "./agentClient";
import { Avatar, firstName, initials } from "./ui";

const URL_RE = /(https?:\/\/\S+)/;

/**
 * Example replies a member might send, one per language. They exercise the agent:
 * a request for time, a split payment, and an "I already paid" claim.
 * (Have a native speaker check before real use.)
 */
const SAMPLE_REPLY: Record<Language, string> = {
  Shona: "Ndichabhadhara neChishanu, mari yangu yanonoka svondo rino.",
  Ndebele: "Sengibhadele izolo nge-PayPal!",
  isiZulu: "Ngicela ngikhokhe uhhafu manje, okunye ngoLwesihlanu?",
  Sesotho: "Ke kopa ho lefa halofo hona joale, e nngwe ka Labohlano.",
  Setswana: "Ke kopa go duela halofo jaanong, e nngwe ka Labotlhano.",
  English: "Could I pay half now and the rest on Friday?",
};

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Split a message into the member-language part and the EN: translation line. */
function splitMessage(text: string) {
  const lines = text.split("\n");
  const enIdx = lines.findIndex((l) => l.trim().startsWith("EN:"));
  const main = (enIdx >= 0 ? lines.slice(0, enIdx) : lines).join("\n").trim();
  const en = enIdx >= 0 ? lines.slice(enIdx).join("\n").replace(/^\s*EN:\s*/, "").trim() : null;
  return { main, en };
}

function Body({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((p, i) =>
        URL_RE.test(p) ? <span key={i} className="wa-link">{p.replace(/^https?:\/\//, "")}</span> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

/**
 * The member's phone: messages from the circle arrive here, and the member can
 * reply. Replies go to the agent, which answers in the member's language.
 */
export default function Phone({
  club,
  clubs,
  onChange,
  onAgentNote,
}: {
  club: Club;
  clubs: Club[];
  onChange: () => void;
  onAgentNote: (text: string) => void;
}) {
  const { members, outbox } = club;
  const cycle = club.cycles.find((c) => c.number === club.currentCycle)!;
  const unpaid = new Set(cycle.contributions.filter((c) => c.status !== "paid").map((c) => c.memberId));
  const tabs = members.filter((m) => outbox.some((n) => n.memberId === m.id) || unpaid.has(m.id));
  const latest = outbox[outbox.length - 1]?.memberId;
  const [selected, setSelected] = useState<string | undefined>(latest ?? tabs[0]?.id);
  const [showEn, setShowEn] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (latest && !busy) setSelected(latest);
  }, [latest, outbox.length, busy]);

  const member: Member | undefined = members.find((m) => m.id === selected);
  const thread = outbox.filter((n) => n.memberId === selected);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [thread.length, busy]);

  async function sendReply(text: string) {
    if (!member || !text.trim() || busy) return;
    setBusy(true);
    setSteps([]);
    setError(null);
    setDraft("");
    let summary = "";
    await streamAgent(`/api/clubs/${club.id}/inbox`, { memberId: member.id, text }, {
      step: (s) => {
        setSteps((prev) => upsertStep(prev, s));
        onChange();
      },
      reply: (r) => { summary = r; },
      error: (m) => setError(m),
    });
    setBusy(false);
    onChange();
    if (summary) onAgentNote(`**${firstName(member.name)} replied on WhatsApp.** ${summary}`);
  }

  return (
    <section className="phone-col" aria-label="What members see">
      <div className="col-head">
        <h2>On their phones</h2>
        <label className="toggle">
          <input type="checkbox" checked={showEn} onChange={(e) => setShowEn(e.target.checked)} /> Show English
        </label>
      </div>
      {tabs.length > 0 && (
        <div className="phone-tabs" role="tablist">
          {tabs.map((m) => (
            <button key={m.id} role="tab" aria-selected={m.id === selected} className={m.id === selected ? "on" : ""} onClick={() => setSelected(m.id)} disabled={busy}>
              {firstName(m.name)}
            </button>
          ))}
        </div>
      )}
      <div className="phone">
        <div className="phone-notch" aria-hidden />
        <div className="wa-head">
          <span className="wa-group" aria-hidden>{initials(club.name)}</span>
          <div>
            <b>{club.name}</b>
            <span>{busy ? "Rotapot is typing…" : member ? `${member.name}'s phone · ${member.language}` : "treasurer bot"}</span>
          </div>
        </div>
        <div className="wa-body" ref={bodyRef}>
          {thread.length === 0 && !busy ? (
            <div className="wa-empty">
              <p>Reminders, receipts and payout notices arrive here, in each member&apos;s own language. Members can reply, and the agent answers.</p>
            </div>
          ) : (
            thread.map((n) => {
              const mine = n.direction === "in";
              const { main, en } = splitMessage(n.message);
              const link = n.message.match(URL_RE)?.[1];
              const text = showEn && en ? en : main.replace(URL_RE, "").replace(/\s+([.!?])/g, "$1").trim();
              return (
                <div key={n.id} className={`wa-msg wa-${n.kind ?? "reminder"} ${mine ? "mine" : ""}`}>
                  {n.kind === "payout" && <span className="wa-tag">Payout</span>}
                  {n.kind === "receipt" && <span className="wa-tag">Receipt</span>}
                  {n.kind === "plan" && <span className="wa-tag">Payment plan</span>}
                  <div className="wa-bubble">
                    <Body text={text} />
                    {link && n.kind === "reminder" && (
                      <div className="wa-card">
                        <span className="wa-card-label">Pay your contribution</span>
                        <span className="wa-card-host">{link.replace(/^https?:\/\//, "").split("/")[0]}</span>
                        <span className="wa-card-cta">Pay with PayPal</span>
                      </div>
                    )}
                    <span className="wa-time">{time(n.createdAt)} {mine ? "✓✓" : ""}</span>
                  </div>
                </div>
              );
            })
          )}
          {busy && (
            <div className="wa-msg">
              <div className="wa-bubble wa-typing" aria-label="Rotapot is typing"><span /><span /><span /></div>
            </div>
          )}
        </div>
        {member && (
          <form className="wa-compose" onSubmit={(e) => { e.preventDefault(); sendReply(draft); }}>
            {!draft && !busy && (
              <button type="button" className="wa-suggest" onClick={() => setDraft(SAMPLE_REPLY[member.language])} title="Fill in an example reply">
                {SAMPLE_REPLY[member.language]}
              </button>
            )}
            <div className="wa-input">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Reply as ${firstName(member.name)}`} aria-label={`Reply as ${member.name}`} disabled={busy} />
              <button type="submit" disabled={busy || !draft.trim()} aria-label="Send">➤</button>
            </div>
          </form>
        )}
      </div>
      {(busy || steps.length > 0) && (
        <div className="phone-trace">
          <span className="phone-trace-label">Agent handling {member ? firstName(member.name) : ""}&apos;s message</span>
          <Trace steps={steps} clubs={clubs} />
        </div>
      )}
      {error && <p className="err">{error}</p>}
      {member && <div className="phone-member"><Avatar member={member} size={20} /> {member.city}</div>}
    </section>
  );
}
