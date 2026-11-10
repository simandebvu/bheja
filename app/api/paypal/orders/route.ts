import { payLink, withPaymentAccount } from "@/lib/pay-access";
import { NextResponse } from "next/server";
import { startContribution } from "@/lib/club";
import { fail } from "@/lib/http";

async function handlePOST(req: Request) {
  try {
    const { clubId, memberId, redirect } = (await req.json()) as { clubId: string; memberId: string; redirect?: boolean };
    let checkout;
    if (redirect === true) {
      const returnUrl = new URL(payLink(clubId, memberId), process.env.BETTER_AUTH_URL!);
      returnUrl.searchParams.set("paypalReturn", "1");
      const cancelUrl = new URL(returnUrl);
      cancelUrl.searchParams.delete("paypalReturn");
      cancelUrl.searchParams.set("cancelled", "1");
      checkout = { returnUrl: returnUrl.href, cancelUrl: cancelUrl.href };
    }
    return NextResponse.json(await startContribution(clubId, memberId, checkout));
  } catch (err) {
    return fail(err);
  }
}

export const POST = withPaymentAccount(handlePOST);
