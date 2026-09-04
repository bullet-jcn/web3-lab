# Backup and restore operations

PostgreSQL is Web3 Sentinel's durable source of truth. A configured backup is not proof that data
can be restored, so release operations track backup creation and restore-drill evidence separately.
Redis contains disposable coordination state and is rebuilt rather than restored as authoritative
user data.

## Service objectives

| Property | Objective |
| --- | --- |
| Recovery point objective (RPO) | At most 15 minutes of durable PostgreSQL changes |
| Recovery time objective (RTO) | Restore and validate service within 4 hours |
| Backup retention | 35 days in encrypted provider storage |
| Restore drill | At least quarterly and before accepting a new backup provider or topology |

Use managed PostgreSQL point-in-time recovery with encrypted continuous logs and at least one daily
snapshot. Keep backup encryption keys and deletion authority separate from ordinary application
credentials. Enable provider deletion protection for production and document any legal requirement
that changes the 35-day operational retention window.

## Restore drill

1. Select a backup inside the RPO and record its opaque provider backup ID, source release SHA and
   exact recovery target timestamp.
2. Restore into an isolated staging database with staging-only credentials. Never overwrite
   production and never give the restored application production wallet, webhook or email access.
3. Apply the repository's immutable migrations and verify their stored checksums.
4. Compare approved aggregate row counts. Do not copy user rows into tickets or drill evidence.
5. run PostgreSQL foreign-key validation and exercise `/api/health/ready`, SIWE, Watchlist and a
   supported read-only chain path.
6. Measure actual RPO and RTO, record the required booleans and timestamps, then destroy the restored
   database and its temporary credentials.
7. Validate the record before attaching it to the protected release or incident:

   ```bash
   npm run backup:evidence:verify -- /secure/path/restore-evidence.json
   ```

The validator accepts only the documented fields, derives RPO/RTO from canonical timestamps, requires
an isolated staging restore and every check to be true, and rejects missed objectives. Store the evidence in the approved private
operations system, not this public repository. It must contain no database URL, user data, signatures,
cookies or provider credentials.

## Release and incident use

Before a potentially destructive migration, confirm a recent restorable backup and the latest passing
drill. Database schema changes remain forward-only: an application rollback uses the prior image
against a compatible expanded schema, while a data restore is reserved for confirmed corruption or
loss and requires incident approval. A real provider configuration and a passing drill are external
release evidence; repository tests do not claim that either has happened.
