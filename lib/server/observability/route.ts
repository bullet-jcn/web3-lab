import { metrics, SpanStatusCode, trace } from '@opentelemetry/api'
import { emitStructuredLog, type StructuredLogWriter } from './logger'

type RouteHandler<Arguments extends unknown[]> = (...args: Arguments) => Response | Promise<Response>

export interface ObservedRouteOptions {
  route: string
  method: string
  dependency?: 'postgres' | 'redis' | 'rpc' | 'gemini'
}

interface ObservedRouteDependencies {
  now?: () => number
  randomUUID?: () => string
  writer?: StructuredLogWriter
}

const meter = metrics.getMeter('web3-lab.http')
const requestCount = meter.createCounter('web3_lab.http.server.requests', {
  description: 'Completed HTTP Route Handler requests',
})
const requestDuration = meter.createHistogram('web3_lab.http.server.duration', {
  description: 'Route Handler duration',
  unit: 'ms',
})

function statusOutcome(statusCode: number) {
  if (statusCode >= 500) return 'server_error' as const
  if (statusCode >= 400) return 'client_error' as const
  return 'success' as const
}

function recordTelemetry(
  options: ObservedRouteOptions,
  requestId: string,
  statusCode: number,
  durationMs: number,
): void {
  const attributes = {
    'http.request.method': options.method,
    'http.route': options.route,
    'http.response.status_code': statusCode,
    'web3_lab.request_id': requestId,
  }
  requestCount.add(1, {
    'http.request.method': options.method,
    'http.route': options.route,
    'http.response.status_class': `${Math.floor(statusCode / 100)}xx`,
  })
  requestDuration.record(durationMs, {
    'http.request.method': options.method,
    'http.route': options.route,
  })

  const span = trace.getActiveSpan()
  span?.setAttributes(attributes)
  if (statusCode >= 500) span?.setStatus({ code: SpanStatusCode.ERROR })
}

export function observeRoute<Arguments extends unknown[]>(
  options: ObservedRouteOptions,
  handler: RouteHandler<Arguments>,
  dependencies: ObservedRouteDependencies = {},
): RouteHandler<Arguments> {
  return async (...args: Arguments): Promise<Response> => {
    const now = dependencies.now ?? performance.now.bind(performance)
    const createRequestId = dependencies.randomUUID ?? crypto.randomUUID.bind(crypto)
    const requestId = createRequestId()
    const startedAt = now()
    let response: Response | undefined

    try {
      response = await handler(...args)
      return response
    } finally {
      const durationMs = Math.max(0, now() - startedAt)
      const statusCode = response?.status ?? 500
      const outcome = statusOutcome(statusCode)
      recordTelemetry(options, requestId, statusCode, durationMs)
      emitStructuredLog({
        level: statusCode >= 500 ? 'error' : 'info',
        event: 'http.request.completed',
        requestId,
        route: options.route,
        method: options.method,
        statusCode,
        durationMs,
        outcome,
        dependency: statusCode >= 500 ? options.dependency : undefined,
      }, dependencies.writer)

      if (response) {
        response.headers.set('X-Request-Id', requestId)
        response.headers.set('Server-Timing', `app;dur=${durationMs.toFixed(1)}`)
      }
    }
  }
}
