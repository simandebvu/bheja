# Contributing

Focused improvements are welcome, especially around accessibility, language quality, payment-state handling and documentation.

1. Fork the repository and create a branch for one change.
2. Follow the [local setup](README.md#run-locally). Use sandbox credentials only.
3. Describe the problem and the behaviour your change produces.
4. Run `npm run typecheck` and `npm run build`.
5. Open a pull request with verification steps. For UI changes, include a screenshot; for payment or agent changes, explain the affected states and approval boundaries.

Keep credentials, real member information and `data/db.json` out of commits. Avoid resetting the shared hosted demo during other people’s walkthroughs; use your own local instance for development.

## Language contributions

Name the language and explain the intended tone and meaning. Include an English gloss and note any regional differences. Do not claim native-speaker validation unless it has actually happened.

## Reporting bugs

Include the circle, expected result, actual result and reproducible steps. Redact keys, account details and personal data. Security concerns belong in the private reporting process in [SECURITY.md](SECURITY.md).
