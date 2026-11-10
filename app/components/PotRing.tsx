"use client";

import type { Cycle, Member } from "@/lib/types";
import { ShweshweDefs, firstName, initials, toneFor } from "./ui";

const SIZE = 440;
const C = SIZE / 2;
const R = 138; // ring centreline
const STROKE = 34;
const AVATAR_R = 190; // where member markers sit
const GAP_DEG = 5;

function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) };
}

function arc(r: number, startDeg: number, endDeg: number) {
  const s = polar(r, startDeg);
  const e = polar(r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/**
 * The pot, seen from above. Members sit around the rim in rotation order;
 * a segment fills marigold when that member pays. The whole circle turns so
 * whoever receives this cycle's pot is always at the top.
 */
export default function PotRing({
  members,
  cycle,
  collected,
  target,
  daysLate,
  justPaid,
}: {
  members: Member[];
  cycle: Cycle;
  collected: number;
  target: number;
  daysLate: number;
  justPaid: Set<string>;
}) {
  const n = members.length;
  const step = 360 / n;
  const ordered = [...members].sort((a, b) => a.turn - b.turn);
  const recipient = members.find((m) => m.id === cycle.recipientId)!;
  // Turn the circle so the recipient sits at 12 o'clock.
  const rotation = -(recipient.turn - 1) * step;
  const paidCount = cycle.contributions.filter((c) => c.status === "paid").length;
  const allPaid = paidCount === n;

  return (
    <figure className="pot" aria-label={`Pot: US$${collected} of US$${target} collected. ${firstName(recipient.name)} receives this cycle.`}>
      <svg viewBox={`-56 -36 ${SIZE + 112} ${SIZE + 72}`} role="img">
        <ShweshweDefs id="shweshwe" />
        <circle cx={C} cy={C} r={R} fill="none" stroke="url(#shweshwe)" strokeWidth={STROKE} />

        <g className="pot-turn" style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${C}px ${C}px` }}>
          {ordered.map((m, i) => {
            const centre = -90 + i * step;
            const contribution = cycle.contributions.find((c) => c.memberId === m.id);
            const status = contribution?.status ?? "unpaid";
            const isRecipient = m.id === recipient.id;
            const pos = polar(AVATAR_R, centre);
            // Label sits radially outside the marker, in screen orientation.
            const screenAngle = ((centre + rotation) * Math.PI) / 180;
            const lx = pos.x + Math.cos(screenAngle) * 40;
            const ly = pos.y + Math.sin(screenAngle) * 40 + 5;
            const anchor = Math.abs(Math.cos(screenAngle)) < 0.3 ? "middle" : Math.cos(screenAngle) > 0 ? "start" : "end";
            const late = status !== "paid" && daysLate > 0;
            return (
              <g key={m.id}>
                {/* the member's share of the pot */}
                <path
                  d={arc(R, centre - step / 2 + GAP_DEG / 2, centre + step / 2 - GAP_DEG / 2)}
                  className={`seg ${status === "paid" ? "seg-paid" : ""} ${justPaid.has(m.id) ? "seg-fresh" : ""}`}
                  pathLength={100}
                  fill="none"
                  strokeWidth={STROKE - 6}
                />
                {status === "pending" && (
                  <path d={arc(R, centre - step / 2 + GAP_DEG / 2, centre + step / 2 - GAP_DEG / 2)} className="seg-pending" fill="none" strokeWidth={STROKE - 6} />
                )}
                {/* member marker, counter-rotated so initials stay upright */}
                <g style={{ transform: `rotate(${-rotation}deg)`, transformOrigin: `${pos.x}px ${pos.y}px` }} className="pot-turn">
                  {isRecipient && <circle cx={pos.x} cy={pos.y} r={33} className="recipient-halo" />}
                  <circle cx={pos.x} cy={pos.y} r={25} fill={toneFor(m)} stroke={late ? "var(--coral)" : "var(--surface)"} strokeWidth={late ? 3 : 3} />
                  <text x={pos.x} y={pos.y + 5} textAnchor="middle" className="marker-initials">{initials(m.name)}</text>
                  {status === "paid" && (
                    <g transform={`translate(${pos.x + 17} ${pos.y - 19})`}>
                      <circle r="9" fill="var(--jade)" stroke="var(--surface)" strokeWidth="2" />
                      <path d="M-4 0 L-1 3 L4 -3" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )}
                  <text x={lx + (anchor === "start" ? -12 : anchor === "end" ? 12 : 0)} y={ly} textAnchor={anchor} className="marker-name">{firstName(m.name)}</text>
                </g>
              </g>
            );
          })}
        </g>

        {/* the money in the middle */}
        <circle cx={C} cy={C} r={R - STROKE / 2 - 8} fill="var(--surface)" />
        <text x={C} y={C - 44} textAnchor="middle" className="pot-eyebrow">IN THE POT</text>
        <text x={C} y={C + 12} textAnchor="middle" className="pot-amount">${collected}</text>
        <text x={C} y={C + 40} textAnchor="middle" className="pot-of">of ${target} · {paidCount}/{n} paid</text>
        <text x={C} y={C + 72} textAnchor="middle" className={`pot-status ${allPaid ? "ok" : daysLate > 0 ? "late" : ""}`}>
          {allPaid ? "Ready to release" : daysLate > 0 ? `${daysLate} day${daysLate === 1 ? "" : "s"} overdue` : `Due ${new Date(`${cycle.dueDate}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
        </text>
      </svg>
      <figcaption>
        <span className="caption-arrow" aria-hidden>▲</span> {firstName(recipient.name)} receives this cycle
      </figcaption>
    </figure>
  );
}
