import { notFound } from "next/navigation";
import { LogoMark, firstName } from "@/app/components/ui";
import { amountDueNow, daysLate } from "@/lib/club";
import { currentCycle, loadDb } from "@/lib/db";
import { GREETING } from "@/lib/messages";
import { paypalConfigured } from "@/lib/paypal";
import PayButtons from "./PayButtons";

export const dynamic = "force-dynamic";

const dayMonth = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
const monthYear = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

export default async function PayPage({ params }: { params: Promise<{ clubId: string; memberId: string }> }) {
  const { clubId, memberId } = await params;
  const club = loadDb().clubs.find((c) => c.id === clubId);
  const member = club?.members.find((m) => m.id === memberId);
  if (!club || !member) notFound();
  const cycle = currentCycle(club);
  const contribution = cycle.contributions.find((c) => c.memberId === memberId);
  const recipient = club.members.find((m) => m.id === cycle.recipientId)!;
  const myCycle = club.cycles.find((c) => c.recipientId === member.id)!;
  const late = daysLate(cycle.dueDate);
  const isRecipient = recipient.id === member.id;
  const amount = contribution && contribution.status !== "paid" ? amountDueNow(club, contribution) : Number(club.contributionAmount);
  const plan = contribution?.plan?.status === "approved" ? contribution.plan : null;
  const instalmentNo = plan ? plan.instalments.findIndex((i) => !i.paid) + 1 : 0;

  const turnText =
    myCycle.payout.status === "sent"
      ? `You received your pot of US$${Number(myCycle.payout.amount)} in ${monthYear(myCycle.dueDate)}.`
      : isRecipient
        ? `It's your turn: this month's US$${Number(cycle.payout.amount)} pot comes to you once everyone has paid.`
        : `Your turn is cycle ${myCycle.number}: US$${Number(myCycle.payout.amount)} comes to you in ${monthYear(myCycle.dueDate)}.`;

  return (
    <main className="pay">
      <div className="pay-brand">
        <LogoMark size={26} />
        <span className="wordmark">rotapot</span>
      </div>
      <div className="pay-card">
        <p className="pay-hello">
          {GREETING[member.language]} <b>{firstName(member.name)}</b>, this is your contribution to
        </p>
        <h1 className="pay-club">{club.name}</h1>
        <div className="pay-amount">US${amount}</div>
        {plan && instalmentNo > 0 && (
          <p className="pay-plan">Instalment {instalmentNo} of {plan.instalments.length} of your agreed plan · due {dayMonth(plan.instalments[instalmentNo - 1].due)}</p>
        )}
        <p className="pay-for">
          Cycle {cycle.number} of {club.cycles.length}. This month&apos;s pot goes to <b>{isRecipient ? "you" : recipient.name}</b>.
        </p>
        {contribution?.status !== "paid" && !plan && (
          <span className={`pay-due ${late > 0 ? "" : "ontime"}`}>
            {late > 0 ? `Was due ${dayMonth(cycle.dueDate)} · ${late} day${late === 1 ? "" : "s"} late` : `Due ${dayMonth(cycle.dueDate)}`}
          </span>
        )}

        <ol className="pay-line" aria-label="Payout rotation" style={{ gridTemplateColumns: `repeat(${club.cycles.length}, 1fr)` }}>
          {club.cycles.map((c) => {
            const who = club.members.find((m) => m.id === c.recipientId)!;
            const state = c.payout.status === "sent" ? "done" : c.number === cycle.number ? "now" : "";
            return (
              <li key={c.number} className={`${state} ${who.id === member.id ? "you" : ""}`}>
                <span className="bar" />
                {who.id === member.id ? "You" : firstName(who.name)}
              </li>
            );
          })}
        </ol>
        <p className="pay-turn">{turnText}</p>

        {contribution?.status === "paid" ? (
          <div className="pay-ok"><b>All paid up</b>Thank you. Your US${amount} is in the pot.</div>
        ) : (
          <PayButtons clubId={club.id} memberId={member.id} clientId={paypalConfigured() ? process.env.PAYPAL_CLIENT_ID! : null} amount={String(amount)} />
        )}
      </div>
      <p className="pay-foot">Payments go through PayPal. Rotapot never sees your card details, and the treasurer approves every payout.</p>
    </main>
  );
}
