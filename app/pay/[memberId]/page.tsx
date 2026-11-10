import { notFound } from "next/navigation";
import { LogoMark, firstName } from "@/app/components/ui";
import { daysLate } from "@/lib/club";
import { currentCycle, loadClub } from "@/lib/db";
import { paypalConfigured } from "@/lib/paypal";
import PayButtons from "./PayButtons";

export const dynamic = "force-dynamic";

function dayMonth(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function monthYear(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export default async function PayPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const club = loadClub();
  const member = club.members.find((m) => m.id === memberId);
  if (!member) notFound();
  const cycle = currentCycle(club);
  const contribution = cycle.contributions.find((c) => c.memberId === memberId);
  const recipient = club.members.find((m) => m.id === cycle.recipientId)!;
  const myCycle = club.cycles.find((c) => c.recipientId === member.id)!;
  const late = daysLate(cycle.dueDate);
  const isRecipient = recipient.id === member.id;

  const turnText =
    myCycle.payout.status === "sent"
      ? `You received your pot of US$${myCycle.payout.amount} in ${monthYear(myCycle.dueDate)}.`
      : isRecipient
        ? `It's your turn: this month's US$${cycle.payout.amount} pot comes to you once everyone has paid.`
        : `Your turn is cycle ${myCycle.number}: US$${myCycle.payout.amount} comes to you in ${monthYear(myCycle.dueDate)}.`;

  return (
    <main className="pay">
      <div className="pay-brand">
        <LogoMark size={26} />
        <span className="wordmark">rotapot</span>
      </div>
      <div className="pay-card">
        <p className="pay-hello">Hi <b>{firstName(member.name)}</b>, this is your contribution to</p>
        <h1 style={{ fontSize: 18, marginTop: 2 }}>{club.name}</h1>
        <div className="pay-amount">US${club.contributionAmount}</div>
        <p className="pay-for">
          Cycle {cycle.number} of {club.cycles.length}. This month&apos;s pot goes to <b>{isRecipient ? "you" : recipient.name}</b>.
        </p>
        {contribution?.status !== "paid" && (
          <span className={`pay-due ${late > 0 ? "" : "ontime"}`}>
            {late > 0 ? `Was due ${dayMonth(cycle.dueDate)} · ${late} day${late === 1 ? "" : "s"} late` : `Due ${dayMonth(cycle.dueDate)}`}
          </span>
        )}

        <ol className="pay-line" aria-label="Payout rotation">
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
          <div className="pay-ok"><b>All paid up</b>Thank you. Your US${club.contributionAmount} is in the pot.</div>
        ) : (
          <PayButtons memberId={member.id} clientId={paypalConfigured() ? process.env.PAYPAL_CLIENT_ID! : null} amount={club.contributionAmount} />
        )}
      </div>
      <p className="pay-foot">Payments go through PayPal. Rotapot never holds your card details, and the treasurer approves every payout.</p>
    </main>
  );
}
