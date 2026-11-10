import type { Club, Member } from "@/lib/types";
import { firstName } from "./ui";

function month(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.toLocaleDateString("en-GB", { month: "short" })} ’${String(d.getUTCFullYear()).slice(2)}`;
}

/** The rotation schedule: who gets the pot, when. Order is the content here. */
export default function Rotation({ club }: { club: Club }) {
  const member = (id: string) => club.members.find((m) => m.id === id) as Member;
  return (
    <nav className="rotation" aria-label="Payout rotation">
      <span className="rotation-label">Rotation</span>
      <ol>
        {club.cycles.map((c) => {
          const state = c.payout.status === "sent" ? "done" : c.number === club.currentCycle ? "now" : "next";
          return (
            <li key={c.number} className={state} aria-current={state === "now" ? "step" : undefined}>
              <span className="rot-n">{c.number}</span>
              <span className="rot-who">{firstName(member(c.recipientId).name)}</span>
              <span className="rot-when">{state === "done" ? "Paid out" : month(c.dueDate)}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
