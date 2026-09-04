# Observability and incident signals

## Evidence boundary

Every Route Handler emits one JSON `http.request.completed` record with a server-generated request
ID, the fixed route template, method, status, duration and a bounded dependency category. Responses
carry the same `X-Request-Id` and a `Server-Timing` duration. OpenTelemetry adds framework traces and
the same low-cardinality route metrics when an exporter is configured.

Deployed records use `DEPLOYMENT_ENVIRONMENT` (`preview`, `staging`, or `production`) rather than
collapsing every optimized Next.js runtime into `production`, and attach the bounded `RELEASE_ID` so
operators can correlate the first failing version. Neither field contains a user identifier.

The logger intentionally has no generic metadata object. It cannot accept headers, cookies, request
bodies, wallet addresses, transaction hashes, calldata, signatures, upstream response bodies,
exception messages or stacks. Exceptions become only a bounded class name such as `TypeError`.
Automatic outbound fetch instrumentation is disabled because browser-facing RPC credentials can
appear in URL paths. Provider health continues to expose only registered provider IDs and names.

`GET /api/health/live` is the process liveness probe and intentionally does not contact dependencies.
`GET /api/health/ready` is the load-balancer/readiness probe. It first validates the explicit
environment/origin/release identity; in `postgres` mode it then checks PostgreSQL,
Redis and the critical RPC chain; in explicit `legacy-cookie` rollback mode PostgreSQL and Redis are
reported as `not_required`. `GET /api/health/rpc` remains the detailed redacted provider probe. Both
responses are cached briefly and return 503 only when a required component is unhealthy.

Liveness may drive process restart. Readiness should remove an instance from traffic and block
promotion, not restart every instance because an external database or RPC service is unavailable.

## Export and alert activation

Structured JSON is always written to stdout outside tests. A runtime log collector must parse the
top-level fields instead of regexing human text. For remote traces, configure the deployment secret
manager with `OTEL_EXPORTER_OTLP_ENDPOINT` and, when needed, `OTEL_EXPORTER_OTLP_HEADERS`. These are
server secrets and must never use a `NEXT_PUBLIC_` prefix. Vercel may use its configured tracing
integration instead. When the base endpoint or `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` is configured,
the server also installs an OTLP HTTP MetricReader so request counters and duration histograms are
actually exported; without it, alert queries must derive those two signals from the JSON completion
logs rather than pretending the no-op metrics API is a data source.

The provider-neutral source rules live in `ops/alerts/rules.json`. The deployment platform must map
each signal to its query language, attach an on-call destination, and execute a test alert before
promotion. A repository rule is configuration evidence, not proof that PagerDuty, email or another
receiver actually received it. Preserve the delivery-test incident ID in release evidence.

## Triage sequence

1. Confirm whether `/api/health/ready` is reachable and note its `X-Request-Id`.
2. Separate configuration, PostgreSQL, Redis and RPC status; never inspect a user's wallet payload.
3. Filter logs/traces by request ID or trace ID, fixed route, status class and dependency category.
4. Contain with the narrowest documented action: provider failover, application rollback, or
   explicit `legacy-cookie` storage rollback. Never silently fall back inside a request.
5. Verify readiness recovery, exercise the affected path, close the alert, and record timeline,
   impact, action and follow-up without storing private wallet material.

## Alert runbooks

### service-readiness-unhealthy

Treat three failed readiness probes as a page. Inspect component statuses. If PostgreSQL or Redis is
unhealthy, stop promotion and check the managed service before application rollback. If only RPC is
unhealthy, follow the RPC runbook. Do not switch storage mode automatically.

### telemetry-heartbeat-missing

A missing probe can mean application, network, DNS or monitoring failure. Check the deployment and
probe path from a second region, then verify the log/trace collector. Absence of telemetry must not
be interpreted as a healthy service.

### rpc-critical-chain-unhealthy

Inspect `/api/health/rpc` for the registered provider IDs. Confirm the independent fallback is
configured and test a bounded `eth_blockNumber` request. Writes remain wallet-driven; never resend a
transaction because a public observer failed.

### rpc-provider-degraded

A warning means another provider still serves the chain. Check rate limits, latency and provider
status, then restore redundancy before it becomes a single point of failure. Do not page users while
the critical chain remains available unless the operational SLO says otherwise.

### http-server-error-rate

Group 5xx records by fixed route and dependency, then compare the first failing deployment/version.
Roll back only the implicated application release; dependency failure should follow its own runbook.
Never broaden logs to request bodies to diagnose the incident.

### http-p95-latency

Use trace spans to split application time from PostgreSQL, Redis and RPC observation. Check saturation
and timeout budgets before increasing them; longer timeouts can convert a bounded failure into queue
exhaustion.

### risk-explanation-degraded

Gemini degradation does not erase deterministic findings: users receive the deterministic warning.
Check quota and provider health. Escalate only if the deterministic risk path or the overall service
also fails; the AI explanation path must never decide whether a risk exists.
