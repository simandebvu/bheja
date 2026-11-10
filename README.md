# Rotapot: an AI treasurer for savings clubs

Millions of people in Southern Africa save through rotating savings clubs. South Africans call them **stokvels**; Zimbabweans call them **mukando** or **rounds**. Every month each member chips in, and the whole pot goes to one member, in turn.

These clubs mostly run on WhatsApp groups, notebooks and trust. The treasurer chases late payers by hand, keeps the books in their head, and moves the money. Members are often spread across Johannesburg, Harare, Bulawayo and London, so cash doesn't work.

**Rotapot** gives treasurers an AI agent, built on PayPal. The demo treasurer, Rudo in Johannesburg, runs three circles:

| Circle | Members | State in the demo |
|---|---|---|
| Ubuntu Circle (mukando) | 6 in Zimbabwe, South Africa, UK | 3 members late |
| Leicester Diaspora Round | 5 in UK, Ireland, US, Zimbabwe | everyone paid, payout ready |
| Soweto Mothers' Stokvel | 8 in South Africa, UK | on track, not due yet |

- **Briefing.** When Rudo signs in, the agent goes through every circle on its own. Following each circle's rules, it sends the reminders that are due and puts ready payouts up for approval. Then it tells her what needs her. You can watch every step, including the actual tool calls.
- **Collect.** Every member gets a personal PayPal checkout link (Orders v2). The page greets them in their own language and shows when their turn comes.
- **Chase, kindly.** Reminders are written in Shona, Ndebele, isiZulu, Sesotho, Setswana or English, with a pay link. The agent never sends a member two reminders within 12 hours, and some circles forbid reminders before the due date.
- **Verify, don't trust.** "I already paid" gets checked against PayPal. If a checkout was approved but never captured, the agent captures it.
- **Members talk back.** In the phone view you can reply as a member, in their language: "I already paid", "can I pay half now?". The agent checks PayPal, reads their track record, answers them in their language, and can propose an instalment plan that the treasurer approves or declines. Members on a plan pay the right instalment from the same link.
- **Trust passport.** Every member's payment record across all their circles (years saving, on-time rate, streak, a dot for every contribution). Tap anyone in a circle to see theirs. This is the moat: a payment history that people with no credit file have never had on paper, and the agent uses it to judge how to treat late payers.
- **Human in the loop.** The agent can only *propose* a payout. Money moves (PayPal Payouts v1) only when the treasurer taps **Release**. The agent has no tool that can send money. Then the circle turns to the next person, and the recipient gets a WhatsApp-style notice.

## Run it

```bash
npm install
cp .env.example .env.local   # add keys (see below)
npm run dev                  # http://localhost:3000
```

| Variable | Needed for |
|---|---|
| `ANTHROPIC_API_KEY` | The treasurer agent (Claude Opus 4.8) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Real PayPal sandbox checkout and payouts. Leave blank for **mock mode**. |
| `PAYPAL_PAYOUT_RECEIVER_OVERRIDE` | Optional: send payouts to one of your sandbox personal accounts so you can see them land |

Getting PayPal sandbox keys: open developer.paypal.com, go to **Apps & Credentials** (Sandbox), choose **Create App**, then copy the Client ID and Secret. To pay on the checkout pages, log in with the sandbox *personal* account listed under **Testing Tools → Sandbox Accounts**.

**Reset demo** (top right) restores the seed data: cycle 3 of 6, three of six members paid, three days overdue.

## How it works

```
app/page.tsx                 Demo sign-in
app/circles/page.tsx         Home: the agent's briefing + all circles
app/circles/[clubId]         One circle: pot ring, agent chat, release, member phone view
app/pay/[clubId]/[memberId]  Member checkout page (PayPal JS SDK buttons)
app/api/briefing             Agent run across every circle (streamed)
app/api/agent                Claude tool-use loop
app/api/paypal/orders        Create order / capture order (Orders v2)
app/api/payout               Treasurer approval → PayPal Payouts v1
lib/agent.ts                 System prompt + 6 tools, chat and briefing modes
lib/club.ts                  Domain logic shared by routes and tools
lib/paypal.ts                PayPal REST client (sandbox), OAuth token cache
lib/db.ts                    JSON-file store + seed club
```

The agent's tools:

| Tool | What it does |
|---|---|
| `list_circles` | One line per circle: who still owes, days late, payout status |
| `get_circle` | One circle in detail: rules, each member's status, language, recent reminders |
| `verify_payment` | Checks the member's order in PayPal; captures approved-but-uncaptured orders |
| `send_reminder` | Queues a reminder in the member's language with their pay link |
| `propose_payout` | Marks the pot ready for approval. Refuses unless everyone has paid. Moves no money |
| `check_payout_status` | Reads the payout batch status back from PayPal |

**Safety by design:** Releasing money is a separate HTTP route that only the treasurer's button calls. Payouts use a deterministic `sender_batch_id` per cycle, and captures use a `PayPal-Request-Id`, so a double click can't pay twice.

## Demo script (under 3 minutes)

Click **Reset demo** first. The briefing runs again the next time the circles page opens.

1. **(0:00) Sign in.** "Rudo is treasurer of three savings circles across five countries. Millions of Africans save like this, on WhatsApp and trust."
2. **(0:15) The briefing runs by itself.** Let the trace play: it reads each circle, writes to Sipho in isiZulu, Thandiwe in Ndebele and Lerato in Sesotho, skips Soweto because its rules say not before the due date, and puts Leicester's US$500 up for approval.
3. **(0:50) Leicester.** Open the navy "ready to release" card. Show the ring: all five paid. Tap **Release US$500**. PayPal Payouts fires, the card turns green with the batch ID, gold pours round the ring into Farai, the circle *turns* to Tatenda, and Farai's phone shows "Makorokoto Farai!".
4. **(1:30) Ubuntu Circle.** Show the phone tabs with the three reminders in three languages (toggle "Show English"). Open Thandiwe's pay link on a phone and pay with PayPal sandbox; on the dashboard her segment fills gold and a receipt lands on her phone.
5. **(2:05) Members talk back.** On Sipho's phone, tap the suggested isiZulu reply ("can I pay half now, the rest Friday?") and send. The agent checks his record (78% on time), answers him in isiZulu, and a plan request appears for Rudo. Approve it, and tap Thandiwe's name to show her trust passport: "Rock solid", 37 of 38 on time.
6. **(2:40) Close.** "An AI treasurer that does the chasing and the bookkeeping, in your members' own languages, and never moves money without you."

## Honest limitations

- Reminders go to an in-app outbox. Sending them for real needs the WhatsApp Business API, which is the obvious next step.
- PayPal does not support ZAR as a transaction currency, so the club runs in USD. That fits Zimbabwe and the diaspora; South African members would want local rails (e.g. PayShap) later.
- The fixed receipt and payout messages (lib/messages.ts) and the sample member replies (app/components/Phone.tsx) need a native speaker's check before real use.
- Payment histories before the demo cycle are seeded (lib/db.ts) to show what the trust passport looks like with years of data.
- Demo sign-in only (no real accounts), single-process JSON store: this is a demo, not production.
