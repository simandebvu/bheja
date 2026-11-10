import type { Club } from "@/lib/types";
import { ShweshweDefs } from "./ui";

const S = 120;
const C = S / 2;
const R = 46;

function arc(startDeg: number, endDeg: number) {
  const p = (d: number) => ({ x: C + R * Math.cos((d * Math.PI) / 180), y: C + R * Math.sin((d * Math.PI) / 180) });
  const s = p(startDeg);
  const e = p(endDeg);
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${endDeg - startDeg > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
}

/** A small pot: one segment per member, gold when paid; the recipient's segment is at the top. */
export default function MiniRing({ club }: { club: Club }) {
  const cycle = club.cycles.find((c) => c.number === club.currentCycle)!;
  const ordered = [...club.members].sort((a, b) => a.turn - b.turn);
  const n = ordered.length;
  const step = 360 / n;
  const recipientTurn = club.members.find((m) => m.id === cycle.recipientId)!.turn;
  const paid = cycle.contributions.filter((c) => c.status === "paid").length;
  const id = `mini-${club.id}`;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mini-ring" aria-hidden>
      <ShweshweDefs id={id} />
      <circle cx={C} cy={C} r={R} fill="none" stroke={`url(#${id})`} strokeWidth="16" />
      {ordered.map((m, i) => {
        const centre = -90 + (i - (recipientTurn - 1)) * step;
        const status = cycle.contributions.find((c) => c.memberId === m.id)?.status;
        return status === "paid" ? (
          <path key={m.id} d={arc(centre - step / 2 + 3, centre + step / 2 - 3)} stroke="var(--marigold)" strokeWidth="12" fill="none" />
        ) : null;
      })}
      <circle cx={C} cy={C - R} r="5" fill="var(--marigold)" stroke="var(--surface)" strokeWidth="2" />
      <text x={C} y={C + 6} textAnchor="middle" className="mini-count">{paid}/{n}</text>
    </svg>
  );
}
