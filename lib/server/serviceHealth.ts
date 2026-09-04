import { getDatabase } from '@/lib/server/db/client'
import { getRedis } from '@/lib/server/redis/client'
import { getRpcHealthReport, type RpcHealthStatus } from '@/lib/server/rpcHealth'
import {
  readDeploymentConfig,
  type DeploymentConfig,
  type DeploymentEnvironment,
} from '@/lib/server/deploymentConfig'
import { readBackendStorageMode, type BackendStorageMode } from '@/lib/server/storageMode'

export type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy'
export type ServiceCheckStatus = ServiceHealthStatus | 'not_required'

export interface ServiceCheck {
  id: 'configuration' | 'postgres' | 'redis' | 'rpc'
  status: ServiceCheckStatus
  latencyMs?: number
}

export interface ServiceReadinessReport {
  status: ServiceHealthStatus
  checkedAt: string
  environment?: DeploymentEnvironment
  releaseId?: string
  storageMode?: BackendStorageMode
  timeoutMs: number
  checks: ServiceCheck[]
}

interface ReadinessOptions {
  deploymentConfig?: () => DeploymentConfig
  storageMode?: () => BackendStorageMode
  databaseCheck?: () => Promise<void>
  redisCheck?: () => Promise<void>
  rpcCheck?: () => Promise<RpcHealthStatus>
  timeoutMs?: number
  now?: () => number
  checkedAt?: Date
}

const DEFAULT_CHECK_TIMEOUT_MS = 6_000

async function boundedCheck(
  id: ServiceCheck['id'],
  operation: () => Promise<void>,
  timeoutMs: number,
  now: () => number,
): Promise<ServiceCheck> {
  const startedAt = now()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('health check timed out')), timeoutMs)
      }),
    ])
    return { id, status: 'healthy', latencyMs: Math.max(0, Math.round(now() - startedAt)) }
  } catch {
    return { id, status: 'unhealthy', latencyMs: Math.max(0, Math.round(now() - startedAt)) }
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function boundedRpcCheck(
  operation: () => Promise<RpcHealthStatus>,
  timeoutMs: number,
  now: () => number,
): Promise<ServiceCheck> {
  const startedAt = now()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const status = await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('health check timed out')), timeoutMs)
      }),
    ])
    return { id: 'rpc', status, latencyMs: Math.max(0, Math.round(now() - startedAt)) }
  } catch {
    return { id: 'rpc', status: 'unhealthy', latencyMs: Math.max(0, Math.round(now() - startedAt)) }
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function defaultDatabaseCheck(): Promise<void> {
  await getDatabase().query('SELECT 1')
}

async function defaultRedisCheck(): Promise<void> {
  const redis = await getRedis()
  if (!redis.ping) throw new Error('Redis health operation is unavailable')
  await redis.ping()
}

export async function probeServiceReadiness(
  options: ReadinessOptions = {},
): Promise<ServiceReadinessReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS
  const now = options.now ?? performance.now.bind(performance)
  const checkedAt = (options.checkedAt ?? new Date()).toISOString()

  let storageMode: BackendStorageMode
  let deployment: DeploymentConfig | undefined
  try {
    if (options.deploymentConfig || !options.storageMode) {
      deployment = (options.deploymentConfig ?? readDeploymentConfig)()
    }
    storageMode = options.storageMode
      ? options.storageMode()
      : deployment?.storageMode ?? readBackendStorageMode()
  } catch {
    return {
      status: 'unhealthy',
      checkedAt,
      timeoutMs,
      checks: [{ id: 'configuration', status: 'unhealthy' }],
    }
  }

  const persistenceChecksPromise: Promise<ServiceCheck[]> = storageMode === 'postgres'
    ? Promise.all([
        boundedCheck('postgres', options.databaseCheck ?? defaultDatabaseCheck, timeoutMs, now),
        boundedCheck('redis', options.redisCheck ?? defaultRedisCheck, timeoutMs, now),
      ])
    : Promise.resolve([
        { id: 'postgres', status: 'not_required' },
        { id: 'redis', status: 'not_required' },
      ])

  const [persistenceChecks, rpcStatus] = await Promise.all([
    persistenceChecksPromise,
    boundedRpcCheck(
      options.rpcCheck ?? (async () => (await getRpcHealthReport()).status),
      timeoutMs,
      now,
    ),
  ])

  const checks = [...persistenceChecks, rpcStatus]
  const status: ServiceHealthStatus = checks.some((check) => check.status === 'unhealthy')
    ? 'unhealthy'
    : checks.some((check) => check.status === 'degraded')
      ? 'degraded'
      : 'healthy'

  return {
    status,
    checkedAt,
    environment: deployment?.environment,
    releaseId: deployment?.releaseId,
    storageMode,
    timeoutMs,
    checks,
  }
}

const READINESS_CACHE_MS = 5_000
let cachedReport: { report: ServiceReadinessReport; expiresAt: number } | undefined
let inFlightReport: Promise<ServiceReadinessReport> | undefined

export async function getServiceReadinessReport(now = Date.now()): Promise<ServiceReadinessReport> {
  if (cachedReport && cachedReport.expiresAt > now) return cachedReport.report
  if (inFlightReport) return inFlightReport

  inFlightReport = probeServiceReadiness()
    .then((report) => {
      cachedReport = { report, expiresAt: Date.now() + READINESS_CACHE_MS }
      return report
    })
    .finally(() => {
      inFlightReport = undefined
    })
  return inFlightReport
}
