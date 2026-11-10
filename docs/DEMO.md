# Demo guide

**[Live app](https://rotapot.simakk.co.za) · [Demo film](https://youtu.be/6AdlBTQAcvI) · [Devpost entry](https://devpost.com/software/rotapot)**

The film is about two minutes. The live application is a shared sandbox prototype with pre-filled demo sign-in.

## Three circles, three situations

| Circle | Starting situation | What to inspect |
| --- | --- | --- |
| Ubuntu Circle | Three members still owe contributions | Multilingual reminders, member replies and instalment plans |
| Leicester Diaspora Round | Everyone has contributed | Payout proposal, treasurer approval and rotation |
| Soweto Mothers’ Stokvel | Due date has not arrived | Circle-specific reminder instructions and payment history |

## Walkthrough

1. Sign in with the pre-filled demo form. The briefing runs across the circles. Read the human-readable progress and the tool trace.
2. Open Ubuntu. In the phone panel, choose a member and send the suggested reply requesting a split payment. The agent can read the member’s record and propose a plan. Approve or decline it from the dashboard.
3. Open the member’s pay link. An approved plan uses the next instalment amount. After a successful contribution, inspect the ring, ledger and receipt.
4. Open Leicester. If the agent has proposed the ready payout, use Release to invoke the sandbox payout flow. Review the returned batch ID and the next recipient.
5. Click a member’s name to inspect the trust passport.

## Sandbox checkout

Use a PayPal **sandbox personal account**, not a real account or real payment details. Developers can create test accounts in the [PayPal developer dashboard](https://developer.paypal.com/dashboard/accounts).

The app’s README previously documented guest checkout using test card `4111 1111 1111 1111`, a future expiry and CVV `123`. Availability of guest/card checkout depends on the sandbox buyer flow. If it is unavailable, use a sandbox personal account instead.

For a local run, set both PayPal credentials in `.env.local`. Set `PAYPAL_PAYOUT_RECEIVER_OVERRIDE` to a sandbox recipient you control if you want to inspect receipt of the payout. Leaving both credentials blank enables mock payments; it does not enable the AI agent, which needs its own key.

## Reset and limitations

**Reset demo** restores the seed data, starting cycles and briefing. The hosted instance is shared, so a reset affects other viewers.

- No real money moves; the REST client targets PayPal sandbox.
- Messages are in-app, not delivered via WhatsApp.
- Historical contribution records and initial balances are seeded.
- Language templates need native-speaker review.
- Demo sign-in does not create a real user account.
- The trust passport is a payment-history demonstration, not a validated credit score.
