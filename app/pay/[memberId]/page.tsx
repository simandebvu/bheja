import { notFound } from "next/navigation";
import { currentCycle, loadClub } from "@/lib/db";
import { paypalConfigured } from "@/lib/paypal";
import PayButtons from "./PayButtons";

export const dynamic = "force-dynamic";

export default async function PayPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const club = loadClub();
  const member = club.members.find((m) => m.id === memberId);
  if (!member) notFound();
  const cycle = currentCycle(club);
  const contribution = cycle.contributions.find((c) => c.memberId === memberId);
  const recipient = club.members.find((m) => m.id === cycle.recipientId);

  return (
    <main className="paywrap">
      <div className="card paycard">
        <div className="logo" style={{ margin: "0 auto" }}>R</div>
        <h1 style={{ fontSize: 18, marginBottom: 0 }}>{club.name}</h1>
        <p className="meta">Cycle {cycle.number} contribution for {member.name}</p>
        <div className="amount">US${club.contributionAmount}</div>
        <p className="meta">
          Due {cycle.dueDate}. This month&apos;s pot goes to {recipient?.name}.
        </p>
        {contribution?.status === "paid" ? (
          <div className="ok">You&apos;re all paid up for this cycle. Thank you! 🙏</div>
        ) : (
          <PayButtons memberId={member.id} clientId={paypalConfigured() ? process.env.PAYPAL_CLIENT_ID! : null} amount={club.contributionAmount} />
        )}
      </div>
      <p className="meta" style={{ textAlign: "center" }}>Payments are processed by PayPal (sandbox).</p>
    </main>
  );
}
