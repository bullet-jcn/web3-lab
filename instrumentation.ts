import type { Instrumentation } from 'next'
import { emitStructuredLog } from '@/lib/server/observability/logger'

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { registerOTel } = await import('@vercel/otel')
  let metricReaders
  if (
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ) {
    const [{ OTLPMetricExporter }, { PeriodicExportingMetricReader }] = await Promise.all([
      import('@opentelemetry/exporter-metrics-otlp-http'),
      import('@opentelemetry/sdk-metrics'),
    ])
    metricReaders = [new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
    })]
  }

  registerOTel({
    serviceName: 'web3-lab',
    // RPC credentials can appear in URL paths. Keep framework/custom spans but do
    // not auto-capture arbitrary outbound fetch URLs or propagate trace context.
    instrumentations: [],
    propagators: ['tracecontext'],
    metricReaders,
  })
}

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest = error instanceof Error && 'digest' in error && typeof error.digest === 'string'
    ? error.digest
    : undefined
  emitStructuredLog({
    level: 'error',
    event: 'next.request.error',
    route: context.routePath,
    method: request.method,
    statusCode: 500,
    outcome: 'server_error',
    error,
    errorDigest: digest,
  })
}
