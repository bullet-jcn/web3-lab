# Data lifecycle, privacy, and support operations

This runbook connects the public privacy promise to executable deletion and retention controls. It
does not replace jurisdiction-specific legal review before a real commercial launch.

## Data inventory and retention

| Data | Location | Retention boundary |
| --- | --- | --- |
| Opaque Session token hash | PostgreSQL | 30 days after expiration or revocation |
| Redis nonce, revocation and rate-limit state | Redis | Short TTL; not a durable source of truth |
| Abandoned `created` transaction intent | PostgreSQL | 30 days after last update |
| Transaction/Receipt and deterministic risk history | PostgreSQL | 365 days after last update/creation |
| Watchlist and wallet-to-user relation | PostgreSQL | Until the user deletes service data |
| Address book and transaction recovery state | Browser storage | Until user deletion or browser clearing |
| Public transactions and Events | Blockchain | Controlled by the network; not deletable here |

Run a count-only preview first:

```bash
npm run data:retention:preview
```

Review environment and cutoffs, then apply only with an exact environment confirmation:

```bash
npm run data:retention:apply -- --confirm-environment=staging
```

The operation uses one database transaction and an advisory lock. Schedule it from one protected job,
alert on failures, and retain aggregate counts only. Never log deleted rows.

## User-requested deletion

An authenticated user types the exact confirmation in the identity panel. `DELETE /api/account`
requires same-origin JSON, a durable PostgreSQL session and the session's internal user ID. The server
deletes that user inside a transaction; foreign keys cascade through wallets, sessions, Watchlist,
transaction intents and risk reports. Only after database success does the client clear service
cookies, TanStack Query state and `web3-lab:*` browser keys. Wallet-provider storage is not erased.

Deletion cannot remove transactions, logs, balances or address activity already published to a public
blockchain. Support must explain that boundary without claiming that the wallet address itself was
deleted.

## Support and security handling

Publish `NEXT_PUBLIC_OPERATOR_NAME` and `NEXT_PUBLIC_SUPPORT_EMAIL`; release preflight fails without
them. Ask users for the environment, time, route, Request ID and public transaction Hash when relevant.
Never request or accept a seed phrase, private key, Session Cookie, complete signature, hidden calldata,
database URL or remote-control session.

Triage suspected account/session compromise or an unintended write as a security incident. Treat
sustained authentication, PostgreSQL, Redis, RPC or transaction-observer failure as a high-priority
service incident. Response targets are operational goals, not a promise to reverse an irreversible
transaction. Public privacy, terms, risk and support pages must be reviewed for the actual operator and
launch jurisdictions before production approval.
