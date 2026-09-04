import { trace } from '@opentelemetry/api'

export type LogLevel = 'info' | 'warn' | 'error'

export type ObservabilityEvent =
  | 'dependency.degraded'
  | 'dependency.connection_error'
  | 'http.request.completed'
  | 'next.request.error'
  | 'service.readiness'

export interface SafeLogInput {
  level: LogLevel
  event: ObservabilityEvent
  requestId?: string
  route?: string
  method?: string
  statusCode?: number
  durationMs?: number
  outcome?: 'success' | 'client_error' | 'server_error' | 'degraded' | 'unhealthy'
  dependency?: 'postgres' | 'redis' | 'rpc' | 'gemini'
  error?: unknown
  errorDigest?: string
  chainId?: number
  providerId?: string
}

export interface StructuredLogRecord {
  timestamp: string
  level: LogLevel
  service: 'web3-lab'
  environment: 'local' | 'development' | 'test' | 'preview' | 'staging' | 'production' | 'unknown'
  event: ObservabilityEvent
  release_id?: string
  trace_id?: string
  request_id?: string
  route?: string
  method?: string
  status_code?: number
  duration_ms?: number
  outcome?: SafeLogInput['outcome']
  dependency?: SafeLogInput['dependency']
  error_type?: string
  error_digest?: string
  chain_id?: number
  provider_id?: string
}

export type StructuredLogWriter = (record: Readonly<StructuredLogRecord>) => void

const SAFE_TOKEN = /^[A-Za-z0-9._:/[\]-]+$/

function boundedToken(value: string | undefined, maximum: number): string | undefined {
  if (!value || value.length > maximum || !SAFE_TOKEN.test(value)) return undefined
  return value
}

function errorType(error: unknown): string {
  if (!(error instanceof Error)) return 'UnknownError'
  return boundedToken(error.name, 80) ?? 'Error'
}

function environment(): StructuredLogRecord['environment'] {
  const deployedEnvironment = process.env.DEPLOYMENT_ENVIRONMENT
  if (
    deployedEnvironment === 'local'
    || deployedEnvironment === 'preview'
    || deployedEnvironment === 'staging'
    || deployedEnvironment === 'production'
  ) return deployedEnvironment
  if (process.env.NODE_ENV === 'development') return 'development'
  if (process.env.NODE_ENV === 'test') return 'test'
  if (process.env.NODE_ENV === 'production') return 'production'
  return 'unknown'
}

function defaultWriter(record: Readonly<StructuredLogRecord>): void {
  if (process.env.NODE_ENV === 'test') return
  const line = JSON.stringify(record)
  if (record.level === 'error') console.error(line)
  else if (record.level === 'warn') console.warn(line)
  else console.info(line)
}

export function buildStructuredLog(
  input: SafeLogInput,
  now: Date = new Date(),
): StructuredLogRecord {
  const activeSpan = trace.getActiveSpan()
  const traceId = activeSpan?.spanContext().traceId
  const record: StructuredLogRecord = {
    timestamp: now.toISOString(),
    level: input.level,
    service: 'web3-lab',
    environment: environment(),
    event: input.event,
  }

  const safeReleaseId = boundedToken(process.env.RELEASE_ID, 64)
  if (safeReleaseId) record.release_id = safeReleaseId

  const safeTraceId = boundedToken(traceId, 32)
  const safeRequestId = boundedToken(input.requestId, 64)
  const safeRoute = boundedToken(input.route, 160)
  const safeMethod = boundedToken(input.method?.toUpperCase(), 16)
  const safeDigest = boundedToken(input.errorDigest, 128)
  const safeProviderId = boundedToken(input.providerId, 80)

  if (safeTraceId) record.trace_id = safeTraceId
  if (safeRequestId) record.request_id = safeRequestId
  if (safeRoute) record.route = safeRoute
  if (safeMethod) record.method = safeMethod
  if (Number.isInteger(input.statusCode) && input.statusCode! >= 100 && input.statusCode! <= 599) {
    record.status_code = input.statusCode
  }
  if (Number.isFinite(input.durationMs) && input.durationMs! >= 0) {
    record.duration_ms = Math.round(input.durationMs! * 10) / 10
  }
  if (input.outcome) record.outcome = input.outcome
  if (input.dependency) record.dependency = input.dependency
  if (input.error !== undefined) record.error_type = errorType(input.error)
  if (safeDigest) record.error_digest = safeDigest
  if (Number.isSafeInteger(input.chainId) && input.chainId! > 0) record.chain_id = input.chainId
  if (safeProviderId) record.provider_id = safeProviderId

  return record
}

export function emitStructuredLog(
  input: SafeLogInput,
  writer: StructuredLogWriter = defaultWriter,
): void {
  writer(buildStructuredLog(input))
}
