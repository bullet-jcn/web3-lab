# Dependency and Secret Security

This document defines the repository evidence boundary for third-party code and credentials. Passing these
checks reduces known supply-chain risk; it does not prove that a dependency is bug-free or that no secret has
ever escaped through a system outside this repository.

## Enforced gates

- `npm ci` installs exactly the committed lockfile. Dependency install scripts are denied unless the exact
  package and version appears in `package.json#allowScripts`; `.npmrc` enables strict enforcement.
- `npm run security:audit:prod` rejects moderate-or-higher known vulnerabilities in runtime dependencies.
- `npm run security:audit:all` rejects high-or-critical known vulnerabilities across the full tree.
- pull requests run GitHub Dependency Review and reject newly introduced moderate-or-higher runtime or
  development advisories.
- pushes, pull requests, the weekly schedule and manual runs scan Git history with Gitleaks.
- every third-party GitHub Action is pinned to a full commit SHA. The adjacent version comment is only for
  maintainers and Dependabot; it is not the executable trust boundary.

The production threshold is intentionally stricter because those packages reach the deployed application.
Development advisories still fail at `high` because build and CI dependencies can execute code and access CI
credentials. An audit service outage is a failed check, not a clean result.

## Reviewed install scripts

The current allowlist is exact-version only:

| Package | Reviewed behavior |
| --- | --- |
| `@google/genai@2.12.0` | no-op preinstall |
| `@reown/appkit@1.8.19` | reads installed Reown package versions and prints mismatch guidance |
| `fsevents@2.3.3` | prepares the optional macOS filesystem watcher native module |
| `protobufjs@7.6.5` | checks the consumer's version prefix and may print a compatibility warning |
| `unrs-resolver@1.12.2` | verifies/prepares the platform-specific resolver binary; may fetch its exact optional package if missing |

Any version change must be reviewed before changing this list. Do not use `npm approve-scripts --all` as a
shortcut. Prefer denying scripts that are not required for build, test or runtime behavior.

## Temporary dependency overrides

Three transitive versions are constrained in `package.json#overrides`:

- `@base-org/account@2.5.10` replaces the older version selected by Reown and satisfies the Wagmi connector's
  supported range.
- `@coinbase/cdp-sdk@1.52.0` stays below the release that added optional x402 peer imports which currently
  break this application's production bundle when those unrelated payment modules are absent.
- `axios@1.20.0` replaces the exact older version selected below Coinbase CDP SDK so the known advisory is not
  retained.

These are compatibility workarounds, not permanent ownership of upstream packages. For every WalletConnect,
Wagmi, Reown or Coinbase upgrade, run the complete test/build suite and check whether the upstream tree has
adopted safe versions. Remove an override as soon as the resolved tree remains safe without it.

## Update workflow

Dependabot opens weekly npm and GitHub Actions updates. For every update:

1. inspect the lockfile and newly introduced install scripts;
2. read the upstream release/security notes, especially for Next.js and wallet connectors;
3. run both audits, lint, typecheck, tests and production build;
4. preserve exact Next.js and `eslint-config-next` versions so framework changes are deliberate;
5. merge only after CI and Security workflows pass.

Do not use `npm audit fix --force` merely to make CI green. A breaking upgrade requires an explicit compatibility
change and review. If no safe compatible version exists, document the advisory, exploitability, owner, expiry
date and compensating control in a reviewed exception; never lower the global threshold silently.

## Secret incident response

Gitleaks is a prevention and detection gate, not a secret manager. Real secrets belong in the deployment
platform's encrypted secret store and must not use `NEXT_PUBLIC_*` names. WalletConnect project IDs are public
client identifiers, but are still environment-specific configuration.

If a secret is detected:

1. revoke or rotate it first; deleting a commit does not invalidate an already copied credential;
2. stop deployments and determine the credential's scope and access history;
3. remove it from the current tree and, when justified, rewrite Git history with repository-owner coordination;
4. invalidate affected sessions or tokens and review logs for abuse;
5. record the incident and add a safe regression fixture when possible.

The Gitleaks action works without a license for personal GitHub accounts. If the repository moves to an
organization, configure the required `GITLEAKS_LICENSE` secret or replace the scanner in the same pull request;
do not disable the job. Scanner findings and uploaded artifacts must not expose a complete live secret.

## Evidence and limitations

Local commands demonstrate the checked working tree and lockfile. GitHub checks demonstrate the committed
revision in GitHub's runner environment only after it has been pushed. Branch protection must require both
`CI / verify` and the Security jobs before this becomes an enforced merge policy.

Audits find published advisories, Dependency Review evaluates dependency changes, and Gitleaks detects known
credential patterns. None of them replaces code review, runtime authorization, least-privilege credentials,
provider-side secret scanning, penetration testing or incident response drills.
