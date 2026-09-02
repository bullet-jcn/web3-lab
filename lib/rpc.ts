import { fallback, http, type Chain, type Transport } from 'viem'
import { base, baseSepolia, mainnet, sepolia } from 'viem/chains'

export interface RpcProviderDefinition {
  id: string
  name: string
  url: string
}

export interface RpcChainDefinition {
  chain: Chain
  providers: readonly RpcProviderDefinition[]
}

export const RPC_REQUEST_TIMEOUT_MS = 5_000
export const RPC_PROVIDER_RETRY_COUNT = 0

const CHAINS = [sepolia, mainnet, baseSepolia, base] as const

const ALCHEMY_SUBDOMAINS: Record<number, string> = {
  [sepolia.id]: 'eth-sepolia',
  [mainnet.id]: 'eth-mainnet',
  [baseSepolia.id]: 'base-sepolia',
  [base.id]: 'base-mainnet',
}

const FALLBACK_ENV_NAMES: Record<number, string> = {
  [sepolia.id]: 'NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_FALLBACK_URL',
  [mainnet.id]: 'NEXT_PUBLIC_ETHEREUM_MAINNET_RPC_FALLBACK_URL',
  [baseSepolia.id]: 'NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_URL',
  [base.id]: 'NEXT_PUBLIC_BASE_MAINNET_RPC_FALLBACK_URL',
}

function normalizeAlchemyKey(value: string | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized || normalized === 'your-alchemy-api-key' || normalized.length > 256) return null
  return normalized
}

function normalizeRpcUrl(name: string, value: string | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized) return null

  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL`)
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${name} must be a credential-free HTTP(S) URL`)
  }
  return url.toString().replace(/\/$/, '')
}

export function buildRpcProviderRegistry(
  env: Record<string, string | undefined> = process.env,
): ReadonlyMap<number, RpcChainDefinition> {
  const alchemyKey = normalizeAlchemyKey(env.NEXT_PUBLIC_ALCHEMY_API_KEY)
  const registry = new Map<number, RpcChainDefinition>()

  for (const chain of CHAINS) {
    const providers: RpcProviderDefinition[] = []
    if (alchemyKey) {
      providers.push({
        id: 'alchemy',
        name: 'Alchemy',
        url: `https://${ALCHEMY_SUBDOMAINS[chain.id]}.g.alchemy.com/v2/${alchemyKey}`,
      })
    }

    const fallbackEnvName = FALLBACK_ENV_NAMES[chain.id]
    const configuredFallback = normalizeRpcUrl(fallbackEnvName, env[fallbackEnvName])
    if (configuredFallback) {
      providers.push({
        id: 'configured-fallback',
        name: 'Configured fallback',
        url: configuredFallback,
      })
    }

    for (const [index, url] of chain.rpcUrls.default.http.entries()) {
      if (providers.some((provider) => provider.url === url)) continue
      providers.push({
        id: `public-${index + 1}`,
        name: `${chain.name} public RPC ${index + 1}`,
        url,
      })
    }

    if (providers.length === 0) throw new Error(`No RPC provider configured for chain ${chain.id}`)
    registry.set(chain.id, { chain, providers })
  }

  return registry
}

const publicRpcEnvironment = {
  NEXT_PUBLIC_ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
  NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_FALLBACK_URL:
    process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_FALLBACK_URL,
  NEXT_PUBLIC_ETHEREUM_MAINNET_RPC_FALLBACK_URL:
    process.env.NEXT_PUBLIC_ETHEREUM_MAINNET_RPC_FALLBACK_URL,
  NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_URL:
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_URL,
  NEXT_PUBLIC_BASE_MAINNET_RPC_FALLBACK_URL:
    process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_FALLBACK_URL,
}

export const rpcProviderRegistry = buildRpcProviderRegistry(publicRpcEnvironment)

export function getRpcProviders(chainId: number): readonly RpcProviderDefinition[] {
  const definition = rpcProviderRegistry.get(chainId)
  if (!definition) throw new Error(`Unsupported RPC chain: ${chainId}`)
  return definition.providers
}

export function getRpcConnectSources(
  registry: ReadonlyMap<number, RpcChainDefinition> = rpcProviderRegistry,
): string[] {
  return [
    ...new Set(
      [...registry.values()].flatMap(({ providers }) =>
        providers.map((provider) => new URL(provider.url).origin),
      ),
    ),
  ]
}

export function createRpcTransport(
  providers: readonly RpcProviderDefinition[],
  options: { fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Transport {
  if (providers.length === 0) throw new Error('At least one RPC provider is required')
  const timeout = options.timeoutMs ?? RPC_REQUEST_TIMEOUT_MS
  if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 30_000) {
    throw new Error('RPC timeout must be between 100 and 30000 milliseconds')
  }

  return fallback(
    providers.map((provider) =>
      http(provider.url, {
        fetchFn: options.fetchFn,
        key: `rpc-${provider.id}`,
        name: provider.name,
        retryCount: RPC_PROVIDER_RETRY_COUNT,
        timeout,
      }),
    ),
    {
      key: 'rpc-fallback',
      name: 'Bounded RPC fallback',
      rank: false,
      retryCount: 0,
    },
  )
}
