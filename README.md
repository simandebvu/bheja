# Rotapot: an AI treasurer for savings clubs

Millions of people in Southern Africa save through rotating savings clubs. South Africans call them **stokvels**; Zimbabweans call them **mukando** or **rounds**. Every month each member chips in, and the whole pot goes to one member, in turn.

These clubs mostly run on WhatsApp groups, notebooks and trust. The treasurer chases late payers by hand, keeps the books in their head, and moves the money. Members are often spread across Johannesburg, Harare, Bulawayo and London, so cash doesn't work.

**Rotapot** gives the club an AI treasurer, built on PayPal:

- **Collect.** Every member gets a PayPal checkout link (Orders v2) for their monthly contribution. US dollars work for both the Zimbabwean and South African members, and for the diaspora.
- **Chase, kindly.** A Claude agent reads the books, works out who is late, and writes reminders **in each member's own language**: Shona, Ndebele, isiZulu, Sesotho or English.
- **Verify, don't trust.** When someone says "I already paid", the agent checks PayPal before saying anything. If PayPal shows an approved checkout that was never captured, it captures it and fixes the records.
- **Pay out, with a human in the loop.** When everyone has paid, the agent *proposes* the payout. Money moves (PayPal Payouts v1) only when the human treasurer taps **Approve**. The agent has no tool that can send money.

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
app/page.tsx                 Treasurer dashboard + agent chat + WhatsApp outbox
app/pay/[memberId]           Member checkout page (PayPal JS SDK buttons)
app/api/agent                Claude tool-use loop
app/api/paypal/orders        Create order / capture order (Orders v2)
app/api/payout               Treasurer approval → PayPal Payouts v1
lib/agent.ts                 System prompt + 5 tools
lib/club.ts                  Domain logic shared by routes and tools
lib/paypal.ts                PayPal REST client (sandbox), OAuth token cache
lib/db.ts                    JSON-file store + seed club
```

The agent's tools:

| Tool | What it does |
|---|---|
| `get_club_status` | Cycle, due date, who has paid, days late, languages, rules |
| `verify_payment` | Checks the member's order in PayPal; captures approved-but-uncaptured orders |
| `send_reminder` | Queues a reminder in the member's language with their pay link |
| `propose_payout` | Marks the pot ready for approval. Refuses unless everyone has paid. Moves no money |
| `check_payout_status` | Reads the payout batch status back from PayPal |

**Safety by design:** Releasing money is a separate HTTP route that only the treasurer's button calls. Payouts use a deterministic `sender_batch_id` per cycle, and captures use a `PayPal-Request-Id`, so a double click can't pay twice.

## Demo script (under 3 minutes)

1. **(0:00) The problem.** "This is Rudo. She's the treasurer of a six-person mukando spread across Harare, Durban, Bulawayo, Pretoria and London. It's the 10th, the money was due on the 7th, and three people haven't paid."
2. **(0:25)** Click **"Who still owes this month?"** The agent reads the books and answers.
3. **(0:45)** Click **"Remind everyone who's late, in their own language."** Show the WhatsApp outbox filling with isiZulu, Ndebele and Sesotho messages, each with an English line and a pay link.
4. **(1:15)** Click **"Thandiwe says she already paid. Can you check?"** The agent checks PayPal instead of taking her word for it.
5. **(1:35)** Open Thandiwe's pay link and pay with the PayPal sandbox. Back on the dashboard, the pot bar fills. Pay the other two the same way.
6. **(2:10)** Ask **"Is the pot ready to pay out?"** The agent proposes paying US$300 to Rudo, and the **Approve payout** button lights up.
7. **(2:30)** Click **Approve**. PayPal Payouts sends the money, the activity feed shows the batch ID, and the club moves on to cycle 4.
8. **(2:45) Close.** "An AI treasurer that does the chasing and the bookkeeping, and never touches the money without a human saying yes."

## Honest limitations

- Reminders go to an in-app outbox. Sending them for real needs the WhatsApp Business API, which is the obvious next step.
- PayPal does not support ZAR as a transaction currency, so the club runs in USD. That fits Zimbabwe and the diaspora; South African members would want local rails (e.g. PayShap) later.
- Single-club, single-process JSON store: this is a demo, not production.
