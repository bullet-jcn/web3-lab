# Backend persistence foundation

This document defines the first Milestone 4 backend boundary. It is intentionally narrower than
the complete production-operations milestone: the storage adapters exist, but the existing SIWE
and watchlist Route Handlers have not yet been migrated to them.

## Source-of-truth boundary

| Data | Store | Reason |
| --- | --- | --- |
| Users and wallet ownership | PostgreSQL | Durable identity and relational ownership constraints |
| Session records and revocation time | PostgreSQL | Durable audit and revocation source of truth |
| Watchlists | PostgreSQL | Multi-device user state |
| Transaction intents and receipts | PostgreSQL | Durable lifecycle and idempotency evidence |
| Deterministic risk reports | PostgreSQL | Durable supported finding codes and user decisions |
| One-time SIWE nonce | Redis | Atomic consume-once state with a short TTL |
| Session-revocation fast path | Redis | Bounded cache; PostgreSQL remains authoritative |
| Rate-limit counters | Redis | Atomic, expiring coordination state |
| In-flight idempotency claims | Redis | Fast duplicate suppression; PostgreSQL uniqueness remains authoritative |

Redis data may expire or be lost without erasing durable user history. PostgreSQL must never rely
on Redis as the only record of a session, transaction, receipt, or risk decision.

## Privacy boundary

- Store only a SHA-256 digest of an opaque session bearer token. Never store the raw token.
- Normalize public EVM addresses to lowercase before persistence and always scope chain-dependent
  records by `chain_id`.
- Persist transaction hashes and minimal intent fingerprints, not private keys, seed phrases,
  signatures, raw calldata, EIP-712 payloads, or wallet-provider secrets.
- Persist deterministic risk finding codes and the user's decision, not AI prose or prompts.
- Hash untrusted Redis key identifiers so wallet/session/request identifiers are not visible in key
  names.

## Local development

Prerequisite: a Docker-compatible Compose runtime. The repository does not install or start one.

```bash
docker compose up -d postgres redis
export DATABASE_URL=postgresql://web3_lab:local_web3_lab_only@127.0.0.1:5432/web3_lab
export REDIS_URL=redis://127.0.0.1:6379
npm run db:migrate
```

The credentials in `compose.yaml` are local-only defaults. Staging and production must inject
private TLS connection URLs through their secret manager.

## Migration rules

- Migration filenames are ordered and immutable after application.
- The runner executes each migration in its own transaction and records a SHA-256 checksum.
- A checksum mismatch stops deployment instead of silently accepting edited history.
- A PostgreSQL advisory lock prevents two deployers from applying the same migration concurrently.
- Destructive or long-running changes require a later migration and an explicit rollback plan.

## Storage cutover and rollback

Production must set `BACKEND_STORAGE_MODE` explicitly:

- `postgres` enables Redis-backed one-time nonces, opaque revocable sessions, and PostgreSQL
  watchlists.
- `legacy-cookie` restores the previous signed-cookie implementation as an emergency application
  rollback. It is not an automatic fallback and should not remain the production steady state.

An unavailable PostgreSQL/Redis dependency returns `503`; the server does not silently treat an
outage as an empty watchlist, a valid nonce, or an authenticated session. Switching modes invalidates
the other mode's cookie format, so users may need to sign in again. PostgreSQL watchlist data remains
durable during rollback, but the legacy route cannot display it until `postgres` mode is restored.

The backend session cookie contains a random 256-bit opaque token. PostgreSQL stores only its
SHA-256 hash and binds it to the user, wallet, chain, expiry, and revocation timestamp. The session
API returns only the public wallet address and chain ID; internal user/wallet UUIDs do not cross the
browser boundary.

## Current verification boundary

Unit and Route tests cover configuration validation, schema contracts, parameterized repository
behavior, transactional receipt updates, opaque Redis keys, nonce consumption, idempotency outcomes,
the atomic rate-limit script, nonce replay rejection, public Session response fields, durable logout,
database-scoped Watchlist capacity, and explicit `503` failures. This machine currently has neither
Docker nor native PostgreSQL/Redis servers, so no local real-service integration result is claimed
yet. CI provisions disposable PostgreSQL and Redis services, applies the real migration, and enables
the adapter integration suite; that result becomes evidence only after the workflow actually passes.
