# Changelog

## 0.1.0 — 2026-11-10

First tagged sandbox prototype, prepared for the PayPal AI Hackathon.

### Included

- Three savings circles with an automatic treasurer briefing and streamed agent tools.
- PayPal Orders v2 contributions, JavaScript SDK checkout and Payouts v1 integration.
- Multilingual in-app reminders and replies, with instalment plans reviewed by the treasurer.
- Contribution rings, payout rotation, activity ledger and member trust passports.
- Demo reset, mock-payment mode and documented local setup.
- Public demo film, judge walkthrough, architecture notes and project roadmap.
- CI for TypeScript checking and the production build.

### Refinements in the initial release

- Paid member pages hide checkout controls.
- Payout batch identifiers include the demo run so reset scenarios can be repeated.
- Dashboard payout transitions preserve the filled-pot animation.
- Agent streaming tolerates a viewer disconnect while the server process remains alive.

### Known limits

Sandbox only; demo authentication; JSON-file storage; seeded history; in-app messages instead of real WhatsApp. See [architecture](docs/ARCHITECTURE.md) for the boundary between the prototype and a production service.
