import { sepolia } from 'viem/chains'
import {
  RPC_REQUEST_TIMEOUT_MS,
  rpcProviderRegistry,
  type RpcChainDefinition,
  type RpcProviderDefinition,
} from '@/lib/rpc'

export type RpcHealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface RpcProviderHealth {
  id: string
  name: string
  status: 'healthy' | 'unhealthy'
  latencyMs: number
  blockNumber?: string
}

export interface RpcChainHealth {
  chainId: number
  name: string
  status: RpcHealthStatus
  providers: RpcProviderHealth[]
}

export interface RpcHealthReport {
  status: RpcHealthStatus
  checkedAt: string
  timeoutMs: number
  chains: RpcChainHealth[]
}

interface RpcResponse {
  jsonrpc?: unknown
  id?: unknown
  result?: unknown
  error?: unknown
}

export async function probeRpcProvider(
  provider: RpcProviderDefinition,
  options: {
    fetchFn?: typeof fetch
    timeoutMs?: number
    now?: () => number
  } = {},
): Promise<RpcProviderHealth> {
  const fetchFn = options.fetchFn ?? fetch
  const timeoutMs = options.timeoutMs ?? RPC_REQUEST_TIMEOUT_MS
  const now = options.now ?? performance.now.bind(performance)
  const startedAt = now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchFn(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('RPC HTTP request failed')
    const rawBody = await response.text()
    if (rawBody.length > 4_096) throw new Error('RPC health response was too large')

    const body = JSON.parse(rawBody) as RpcResponse
    if (
      body.jsonrpc !== '2.0' ||
      body.id !== 1 ||
      typeof body.result !== 'string' ||
      !/^0x[0-9a-f]+$/i.test(body.result) ||
      body.error !== undefined
    ) {
      throw new Error('RPC health response was invalid')
    }

    return {
      id: provider.id,
      name: provider.name,
      status: 'healthy',
      latencyMs: Math.max(0, Math.round(now() - startedAt)),
      blockNumber: BigInt(body.result).toString(),
    }
  } catch {
    return {
      id: provider.id,
      name: provider.name,
      status: 'unhealthy',
      latencyMs: Math.max(0, Math.round(now() - startedAt)),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function probeRpcHealth(options: {
  probe?: (provider: RpcProviderDefinition) => Promise<RpcProviderHealth>
  checkedAt?: Date
  criticalChainIds?: readonly number[]
  registry?: ReadonlyMap<number, RpcChainDefinition>
} = {}): Promise<RpcHealthReport> {
  const probe = options.probe ?? ((provider) => probeRpcProvider(provider))
  const criticalChainIds = options.criticalChainIds ?? [sepolia.id]
  const registry = options.registry ?? rpcProviderRegistry
  const chains = await Promise.all(
    [...registry.values()].map(async ({ chain, providers }) => {
      const providerHealth = await Promise.all(providers.map(probe))
      const healthyCount = providerHealth.filter((provider) => provider.status === 'healthy').length
      const status: RpcHealthStatus =
        healthyCount === providerHealth.length
          ? 'healthy'
          : healthyCount > 0
            ? 'degraded'
            : 'unhealthy'
      return {
        chainId: chain.id,
        name: chain.name,
        status,
        providers: providerHealth,
      }
    }),
  )

  const criticalUnavailable = chains.some(
    (chain) => criticalChainIds.includes(chain.chainId) && chain.status === 'unhealthy',
  )
  const status: RpcHealthStatus = criticalUnavailable
    ? 'unhealthy'
    : chains.every((chain) => chain.status === 'healthy')
      ? 'healthy'
      : 'degraded'

  return {
    status,
    checkedAt: (options.checkedAt ?? new Date()).toISOString(),
    timeoutMs: RPC_REQUEST_TIMEOUT_MS,
    chains,
  }
}

const HEALTH_CACHE_MS = 10_000
let cachedReport: { report: RpcHealthReport; expiresAt: number } | undefined
let inFlightReport: Promise<RpcHealthReport> | undefined

export async function getRpcHealthReport(now = Date.now()): Promise<RpcHealthReport> {
  if (cachedReport && cachedReport.expiresAt > now) return cachedReport.report
  if (inFlightReport) return inFlightReport

  inFlightReport = probeRpcHealth()
    .then((report) => {
      cachedReport = { report, expiresAt: Date.now() + HEALTH_CACHE_MS }
      return report
    })
    .finally(() => {
      inFlightReport = undefined
    })
  return inFlightReport
}
