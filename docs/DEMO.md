# Demo guide

**[Live app](https://rotapot.simakk.co.za) · [Demo film](https://youtu.be/ucI4Xt354pM) · [Devpost entry](https://devpost.com/software/rotapot)**

The film is about two minutes. The live application is a sandbox prototype with verified email accounts and an empty starting state and optional sample circles.

## Three circles, three situations

| Circle | Starting situation | What to inspect |
| --- | --- | --- |
| Ubuntu Circle | Three members still owe contributions | Multilingual reminders, member replies and instalment plans |
| Leicester Diaspora Round | Everyone has contributed | Payout proposal, treasurer approval and rotation |
| Soweto Mothers’ Stokvel | Due date has not arrived | Circle-specific reminder instructions and payment history |

## Walkthrough

1. Create an account and click the verification link; it signs you in. Choose **See it working: open 3 sample circles** for the two-minute tour, or **Start my own circle** to build your own. The briefing runs across the circles. Read the human-readable progress and the tool trace.
2. Open Ubuntu. In the phone panel, choose a member and send the suggested reply requesting a split payment. The agent can read the member’s record and propose a plan. Approve or decline it from the dashboard.
3. Open the member’s pay link. An approved plan uses the next instalment amount. After a successful contribution, inspect the ring, ledger and receipt.
4. Open Leicester. If the agent has proposed the ready payout, use Release to invoke the sandbox payout flow. Review the returned batch ID and the next recipient.
5. Click a member’s name to inspect the trust passport.

## Sandbox checkout

Use a PayPal **sandbox personal account**, not a real account or real payment details. Developers can create test accounts in the [PayPal developer dashboard](https://developer.paypal.com/dashboard/accounts).

If PayPal's embedded buttons load slowly or open an empty window, select **Continue directly to PayPal**. This opens PayPal's hosted sandbox checkout in the same tab. After approval, Rotapot captures the payment and shows **Paid**. The return link remains scoped to that member's contribution.

The app’s README previously documented guest checkout using test card `4111 1111 1111 1111`, a future expiry and CVV `123`. Availability of guest/card checkout depends on the sandbox buyer flow. If it is unavailable, use a sandbox personal account instead.

For a local run, set both PayPal credentials in `.env.local`. Set `PAYPAL_PAYOUT_RECEIVER_OVERRIDE` to a sandbox recipient you control if you want to inspect receipt of the payout. Leaving both credentials blank enables mock payments; it does not enable the AI agent, which needs its own key.

## Reset and limitations

**Refresh sample circles** restores the example seed data, starting cycles and briefing. User-created circles and memberships are preserved. A reset affects only the signed-in account and invalidates its old member payment links.

- No real money moves; the REST client targets PayPal sandbox.
- Messages are in-app, not delivered via WhatsApp.
- Historical contribution records and initial balances are seeded.
- Language templates need native-speaker review.
- Sign-up creates a real verified account; payments remain in PayPal sandbox.
- The trust passport is a payment-history demonstration, not a validated credit score.
