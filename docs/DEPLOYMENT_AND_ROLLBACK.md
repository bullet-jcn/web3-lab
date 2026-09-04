# Deployment environments and rollback

This document defines the provider-neutral release contract for Web3 Sentinel. It does not claim
that a cloud environment exists merely because the repository can build an image. A real release
needs a protected environment, an immutable artifact, successful probes, smoke evidence, alert
delivery evidence, and an operator record.

## Environment isolation

| Environment | Purpose | Data and secrets | Promotion rule |
| --- | --- | --- | --- |
| Preview | Review one candidate release | Disposable or isolated test data; preview-only secrets | Automated gate; never receives production credentials |
| Staging | Rehearse the production topology and rollback | Dedicated PostgreSQL, Redis, RPC quotas and wallet test accounts | Gate, migration rehearsal, readiness, smoke and rollback drill |
| Production | Serve users | Production-only secret-manager values and managed data services | Protected approval, immutable release, canary/readiness evidence |

No environment shares `AUTH_COOKIE_SECRET`, database, Redis namespace, RPC quota credential, OTLP
credential or WalletConnect allowlist. `NODE_ENV` is `production` in all three deployed environments;
`DEPLOYMENT_ENVIRONMENT` is the operational identity used by health evidence and logs.

The following values are mandatory for every deployed release:

- `DEPLOYMENT_ENVIRONMENT`: `preview`, `staging`, or `production`.
- `RELEASE_ID`: the immutable lowercase Git commit SHA.
- `NEXT_DEPLOYMENT_ID`: exactly the same SHA, enabling Next.js rolling-version skew protection.
- `APP_ORIGIN`: the environment's exact HTTPS origin, used by Origin and SIWE validation.
- `BACKEND_STORAGE_MODE=postgres` for a normal release.
- a base64 `AUTH_COOKIE_SECRET` containing at least 32 random bytes.
- PostgreSQL, Redis, Alchemy, WalletConnect and observability configuration.
- staging and production independent fallback RPC URLs for every supported chain.

`NEXT_PUBLIC_*` values are compiled into the browser bundle by Next.js. They are public identifiers,
not server secrets, and changing them requires a new artifact. Database, Redis, auth, Gemini and OTLP
credentials are runtime server secrets and must never be supplied as Docker build arguments.

Run the safe configuration check before building or promoting:

```bash
npm run release:preflight
```

It emits only environment, release, origin, storage mode, observability mode and fallback count. It
does not print credentials or provider URLs. The protected `.github/workflows/release-gate.yml`
executes this check plus lint, types, tests and a production build from `main`; the workflow becoming
green is gate evidence, not deployment evidence.

## Immutable container contract

`Dockerfile` produces Next.js standalone output on Node 24 and runs it as an unprivileged user. Build
the target environment's public configuration into an image tagged by `RELEASE_ID`, retain its image
digest, and promote or roll back that digest. Never rebuild an old Git revision and call the result
the same release.

The image contains `scripts/migrate.mjs` and immutable migration files, but application startup does
not run migrations. A single protected release job applies migrations before traffic promotion;
multiple application replicas must not each mutate the schema while starting.

Use different probes for different decisions:

- `GET /api/health/live` proves only that the Node process can answer HTTP. A failed liveness probe
  may restart the process.
- `GET /api/health/ready` validates deployment identity, storage mode, PostgreSQL, Redis and the
  critical RPC path. An unhealthy readiness probe removes the instance from traffic and blocks
  promotion; it must not create a restart loop for an external dependency outage.

## Release sequence

1. Merge reviewed code to protected `main`; use that commit SHA as `RELEASE_ID` and
   `NEXT_DEPLOYMENT_ID`.
2. Run the protected release gate for preview. Build and retain the immutable image digest.
3. Apply forward-compatible migrations once. Migrations use an advisory lock and checksum history;
   an edited historical migration stops the release.
4. Deploy preview and verify liveness, readiness, CSP, SIWE, one read path and a wallet-rejection path.
5. Promote the candidate to staging with staging-built public configuration. Exercise PostgreSQL,
   Redis, primary-to-fallback RPC, logout revocation and the documented rollback drill.
6. Obtain protected production approval. Confirm the previous healthy image digest remains routable.
7. Apply production migrations, deploy a canary or smallest available traffic slice, and require
   healthy readiness plus route/error/latency signals before increasing traffic.
8. Exercise a supported testnet write path before any mainnet write rollout. Record transaction Hash,
   receipt status and release ID without copying calldata, signatures or private wallet material.
9. Test alert delivery and record the monitoring incident ID. Close the release only after the agreed
   observation window remains healthy.

## Rollback decision tree

### Application regression

Stop promotion, route traffic to the previously recorded image digest, and verify readiness and the
affected path. Do not rebuild. Keep the failed release and request IDs for diagnosis.

### Dependency outage

If PostgreSQL, Redis or RPC is unhealthy, remove the new instance from readiness and follow that
dependency's runbook. An application rollback does not repair a managed-database outage and must not
trigger wallet transaction resubmission.

### Database migration problem

Migrations are forward-only. Use expand/contract changes so the previous and new application can run
against the expanded schema during rollout. Do not automatically execute a destructive down migration.
If a schema defect escapes, stop writes where necessary and ship a new corrective migration after
backup/restore evidence has been checked.

### Emergency storage rollback

`legacy-cookie` is an explicit degraded application mode, not an automatic fallback. Validate it only
for a declared incident:

```bash
npm run release:preflight -- --allow-legacy-cookie-rollback
```

Users may need to sign in again, durable PostgreSQL Watchlists remain stored but are unavailable in
legacy mode, and individual durable session revocation is lost until `postgres` mode returns. Record
the incident, approver, start/end time and restoration checks.

## Evidence that still requires real infrastructure

Repository tests can prove parsing, fail-closed configuration, standalone output and probe behavior.
They cannot prove DNS/TLS, cloud IAM, environment-secret isolation, image registry retention, database
backup restorability, alert delivery, production capacity or a successful wallet transaction. Keep
those as explicit release evidence instead of marking them complete from configuration alone.
