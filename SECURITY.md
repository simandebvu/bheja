# Security and prototype scope

Rotapot v0.1.x is a demonstration for PayPal sandbox. It is not suitable for production funds, real financial records or public multi-tenant use.

Better Auth provides verified email/password accounts, server-side sessions, rate limits and password resets via Resend. Treasurer APIs validate sessions and mutation origins. Account circle files are isolated by authenticated user ID. Invitation links expire after seven days and require a verified account with the invited email to accept. Member pages validate the membership binding and expose only member-facing data. Signed payment links grant only contribution access and expire after 30 days. Drafts cannot collect contributions or release payouts; edits invalidate prior invitations and acceptances. Circle state still uses per-account JSON files rather than a transactional database. Do not deploy this build with real member data or switch it to production payment credentials.

## Reporting a concern

Do not put secrets, personal information or exploit details in a public issue. If GitHub offers **Security → Report a vulnerability** on this repository, use that private channel. Otherwise, open a minimal issue asking the maintainer for a private reporting channel without including sensitive details.

Include the affected version or commit, a reproduction using test data, the impact and any proposed fix. There is no guaranteed response SLA or bug bounty program.

## Credentials

Keep local credentials in `.env.local`, which is ignored by Git. If a key is exposed, revoke and replace it with the provider; deleting it from the latest commit is not sufficient.
