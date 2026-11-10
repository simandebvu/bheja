# Architecture

Rotapot is a single Next.js application with a React dashboard, member checkout pages, server routes, a Claude tool loop and a JSON-backed domain model.

## Code map

| Location | Responsibility |
| --- | --- |
| `app/circles/` | Treasurer overview and circle dashboard |
| `app/pay/[clubId]/[memberId]/` | Member contribution checkout |
| `app/api/briefing/`, `app/api/agent/` | Agent runs and streaming responses |
| `lib/agent.ts` | Prompt, nine tool definitions and dispatch |
| `lib/club.ts` | Contributions, reminders, instalments and payout proposals |
| `lib/paypal.ts` | Sandbox REST client, OAuth token cache and request IDs |
| `lib/stream.ts` | Newline-delimited JSON events to the browser |
| `lib/db.ts`, `lib/passport.ts` | Seed data, persistence and payment-history summaries |

## Agent authority

| Tool | Effect |
| --- | --- |
| `list_circles` | Reads circle summaries |
| `get_circle` | Reads members, balances, rules and reminder history |
| `verify_payment` | Reads PayPal order status; can capture a previously approved checkout |
| `send_reminder` | Adds a message to the in-app outbox |
| `reply_to_member` | Adds an agent response to the conversation |
| `get_member_passport` | Reads the member’s payment history |
| `propose_payment_plan` | Creates a plan for treasurer review |
| `propose_payout` | Marks a complete pot as awaiting approval |
| `check_payout_status` | Reads the PayPal batch status |

There is no `release_payout` agent tool. The dashboard invokes a separate approval route. This separation limits the model’s available actions; it is **not** a substitute for production authentication and server-side authorization.

## Contribution and payout lifecycle

1. The member page requests an order for the current amount due: either the remaining contribution or the next approved instalment.
2. The member approves through PayPal checkout. The server captures the order and updates the contribution and receipt.
3. Payment verification can reconcile an approved-but-uncaptured checkout.
4. A payout proposal is rejected while any member is unpaid.
5. The treasurer’s Release action creates a PayPal payout batch, records its ID and advances the circle.

Captures use a `PayPal-Request-Id` derived from the order ID. Payout batches use an identifier based on circle, cycle and demo run. These reduce duplicate processor requests; they do not establish a complete production accounting or concurrency model. Batch creation also does not mean every recipient has received settled funds; the status-check tool reads the processor’s reported state.

## Rules in code and rules in the prompt

Code enforces a 12-hour reminder cooldown, rejects reminders for paid members, requires a fully contributed pot before proposing a payout, and checks that plans have 1–3 instalments totalling the outstanding balance within 21 days of the original due date.

Circle-specific instructions, such as avoiding reminders before the due date, are also given to the model. Not every natural-language circle rule is an independent server-side policy check.

## Storage and streaming

`data/db.json` holds shared demo state on the local filesystem. The application expects a single process; it does not provide database transactions or distributed locking. Reset replaces the shared demo state.

The server streams progress as newline-delimited JSON. A disconnected viewer stops receiving events while the server-side run continues if its process stays alive. This is not a durable background job and does not survive process termination.

## Before a real-money pilot

Production identity and authorization, transactional persistence, payment reconciliation, webhook verification, concurrency controls, abuse prevention, privacy controls and native-speaker review are required. See the [roadmap](ROADMAP.md) and [security notes](../SECURITY.md).
