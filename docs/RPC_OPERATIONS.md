# RPC resilience and health operations

## Provider order

Each supported chain builds a deterministic provider list:

1. Alchemy, only when `NEXT_PUBLIC_ALCHEMY_API_KEY` is a real configured value.
2. A chain-specific `NEXT_PUBLIC_*_RPC_FALLBACK_URL`, when configured.
3. The public RPC declared by the installed Viem chain definition as an emergency last resort.

Production should configure the second entry to an infrastructure provider independent from
Alchemy. Public endpoints can be rate-limited and are not a commercial capacity guarantee.

Provider URLs are validated as credential-free HTTP(S) URLs. API keys may exist in URL paths because
these transports execute in the browser and are already public identifiers; health responses and CSP
headers expose only provider names/origins, never full paths or keys.

## Attempt and timeout budget

- Every HTTP provider has a hard 5-second request timeout.
- A provider gets zero same-provider transport retries.
- Fallback attempts each configured provider at most once, in declared order.
- Deterministic execution reverts are returned immediately and do not try another provider.
- Viem receipt polling remains an observation loop for an already-public transaction Hash; it is not
  a wallet submission retry.

This budget applies to public RPC reads, simulations, estimates, and receipt observation. Wallet
signing/submission continues through the selected connector. The application never resends a wallet
write request merely because a public RPC provider timed out.

## Health endpoint

`GET /api/health/rpc` probes every configured provider in parallel with `eth_blockNumber`. Results are
cached in-process for 10 seconds so monitoring traffic cannot multiply provider usage without bound.

The response includes only chain ID/name, provider ID/name, status, latency, and observed block number:

- `healthy`: every configured provider for the chain responded with valid JSON-RPC evidence.
- `degraded`: at least one provider failed but another provider preserved service.
- `unhealthy`: no provider for that chain responded.

The overall endpoint returns HTTP 503 when the current critical write chain (Ethereum Sepolia) is
unhealthy; otherwise it returns HTTP 200 with `healthy` or `degraded` in the body. Provider URLs,
upstream error bodies, credentials, and stack traces are never returned.

## Browser CSP boundary

`connect-src` is derived from the validated provider registry. Only provider origins are inserted, so
fallback works in the browser without copying API-key paths into response headers. Adding a new
browser RPC provider therefore requires configuration and a new build; arbitrary runtime origins are
not silently permitted.

## Operator checks

Before promoting an environment:

1. Configure an independent fallback for every commercially supported chain.
2. Confirm `/api/health/rpc` reports the expected provider order without URL secrets.
3. Exercise primary failure and verify the result is `degraded`, not an outage.
4. Confirm a reverted `eth_call` is surfaced as a deterministic failure, not hidden by fallback.
5. Alert on `unhealthy` immediately and sustained `degraded` status within the chosen operational SLO.

Alert delivery and historical metrics are intentionally deferred to the next observability batch;
this batch establishes the bounded probe and machine-readable evidence they will consume.
