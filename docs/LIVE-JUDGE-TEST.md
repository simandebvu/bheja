# Live judge walkthrough — 10 November 2026

Environment: https://rotapot.simakk.co.za, real Resend email delivery and PayPal sandbox. No real money was used. Tested through Chrome's visible product flows, with server records used to confirm capture results.

## Journey verified

- Organizer created and verified their account, then signed in.
- Created **Judge Journey Circle**, a two-person stokvel with US$5 monthly contributions and a US$10 pot. First due date: 24 November 2026.
- Edited the organizer's sandbox payout destination before inviting the second member.
- Sent the invitation through Resend; it arrived in the recipient's Gmail inbox. SPF, DKIM and DMARC passed.
- Invited member created an account, received a real verification email, verified it, signed in, reviewed the rules and accepted their chair.
- Member confirmation showed both people joined. Organizer launched the circle through the setup checklist.
- Paid both contributions through PayPal's hosted sandbox checkout. Rotapot captured each payment, showed **Paid**, recorded the capture IDs and updated the pot.
- Payout remained locked after one payment, then became **Waiting for your approval** after both payments.
- AI treasurer read the circle and correctly reported the US$10 pot ready, without releasing money.
- Treasurer released the US$10 pot. PayPal confirmed both the batch and recipient transaction as **SUCCESS**, and Rotapot advanced to round two with the invited member next.

## Payment evidence

| Payment | Amount | PayPal order | PayPal capture |
| --- | --- | --- | --- |
| Organizer, judge circle round 1 | US$5 | `3S0900976S597411G` | `54G638762U641474V` |
| Invited member, judge circle round 1 | US$5 | `0J314778H2602390A` | `5CM55989LE783474X` |
| Additional sample-circle checkout | US$50 | `7YD88979C5462442K` | `6K939536FN031262K` |

Payout: batch `5UGMC6GXH2RUY`, recipient transaction `3D097098ST215922D`, US$10.00, **SUCCESS** at 18:39:39 SAST. The sandbox fee was US$0.25. The recipient was the user-provided sandbox personal account.

## Issues found and fixed

1. Embedded PayPal buttons partially loaded and opened a blank popup in the test browser. Added loading feedback and **Continue directly to PayPal**, using PayPal's returned approval URL, a signed member-scoped return URL and server-side capture. The successful payments above used this route.
2. User-created circle IDs produced a payout `sender_item_id` longer than PayPal's 63-character limit. The original release failed safely with the pot still awaiting approval. Item IDs now use a deterministic hash of the full batch identity, retaining stable retries and distinct cycles.
3. Corrected the payout confirmation copy to refer to the member's in-app circle inbox, rather than claiming a WhatsApp message was sent.

Regression coverage checks redirect URLs, contribution scoping, wrong-order rejection, capture recording and payout ID length/stability. Auth, onboarding and payment tests pass.

## Scope

This validates a live sandbox journey, not production money handling. Reminders and receipts are currently in-app; invitation and verification emails are real. The organizer and member each entered their own new passwords. No passwords or signed invitation tokens are stored in this report.
