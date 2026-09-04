export type DeploymentEnvironment = 'local' | 'preview' | 'staging' | 'production'
export type DeploymentStorageMode = 'legacy-cookie' | 'postgres'
export type ObservabilityDelivery = 'platform' | 'otlp'

export interface DeploymentConfig {
  environment: DeploymentEnvironment
  releaseId: string
  appOrigin: string
  nextDeploymentId?: string
  storageMode: DeploymentStorageMode
}

export interface ReleasePreflightResult extends DeploymentConfig {
  observabilityDelivery: ObservabilityDelivery
  independentRpcFallbacks: number
}

interface ReleasePreflightOptions {
  allowLegacyCookieRollback?: boolean
}

const RELEASE_ID = /^[0-9a-f]{7,64}$/
const DEPLOYED_ENVIRONMENTS = new Set<DeploymentEnvironment>([
  'preview',
  'staging',
  'production',
])
const FALLBACK_RPC_ENV_NAMES = [
  'NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_FALLBACK_URL',
  'NEXT_PUBLIC_ETHEREUM_MAINNET_RPC_FALLBACK_URL',
  'NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_URL',
  'NEXT_PUBLIC_BASE_MAINNET_RPC_FALLBACK_URL',
] as const

function readEnvironment(value: string | undefined, nodeEnv: string | undefined): DeploymentEnvironment {
  if (value === 'local' || value === 'preview' || value === 'staging' || value === 'production') {
    return value
  }
  if (value !== undefined) {
    throw new Error('DEPLOYMENT_ENVIRONMENT must be local, preview, staging, or production')
  }
  if (nodeEnv === 'production') {
    throw new Error('DEPLOYMENT_ENVIRONMENT is required in production')
  }
  return 'local'
}

function readStorageMode(value: string | undefined, nodeEnv: string | undefined): DeploymentStorageMode {
  if (value === 'legacy-cookie' || value === 'postgres') return value
  if (value !== undefined) throw new Error('BACKEND_STORAGE_MODE must be legacy-cookie or postgres')
  if (nodeEnv === 'production') throw new Error('BACKEND_STORAGE_MODE is required in production')
  return 'legacy-cookie'
}

function readOrigin(
  value: string | undefined,
  environment: DeploymentEnvironment,
): string {
  if (!value && environment === 'local') return 'http://localhost:3000'
  if (!value) throw new Error('APP_ORIGIN is required for deployed environments')

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('APP_ORIGIN must be a valid origin')
  }

  if (
    url.username
    || url.password
    || (url.pathname !== '/' && url.pathname !== '')
    || url.search
    || url.hash
  ) {
    throw new Error('APP_ORIGIN must not contain credentials, a path, query, or fragment')
  }
  if (environment !== 'local' && url.protocol !== 'https:') {
    throw new Error('APP_ORIGIN must use HTTPS outside local development')
  }
  if (environment === 'local' && url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('APP_ORIGIN must use HTTP or HTTPS')
  }
  return url.origin
}

function readReleaseId(value: string | undefined, environment: DeploymentEnvironment): string {
  if (!value && environment === 'local') return 'local'
  if (!value || !RELEASE_ID.test(value)) {
    throw new Error('RELEASE_ID must be an immutable 7-64 character lowercase Git commit SHA')
  }
  return value
}

function assertStrongAuthSecret(value: string | undefined): void {
  if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('AUTH_COOKIE_SECRET must be a base64-encoded random secret')
  }
  const bytes = Buffer.from(value, 'base64')
  if (bytes.byteLength < 32) {
    throw new Error('AUTH_COOKIE_SECRET must contain at least 32 random bytes')
  }
}

function requirePublicIdentifier(name: string, value: string | undefined): void {
  const normalized = value?.trim()
  if (!normalized || normalized.startsWith('your-') || normalized.length > 256) {
    throw new Error(`${name} must be configured for release`)
  }
}

function requireHttpsUrl(name: string, value: string | undefined): void {
  if (!value) throw new Error(`${name} must be configured for release`)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL`)
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${name} must be a credential-free HTTPS URL`)
  }
}

function readObservabilityDelivery(env: Record<string, string | undefined>): ObservabilityDelivery {
  const value = env.OBSERVABILITY_DELIVERY
  if (value !== 'platform' && value !== 'otlp') {
    throw new Error('OBSERVABILITY_DELIVERY must be platform or otlp')
  }
  if (value === 'otlp') {
    requireHttpsUrl(
      'OTEL_EXPORTER_OTLP_ENDPOINT',
      env.OTEL_EXPORTER_OTLP_ENDPOINT ?? env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
    )
  }
  return value
}

export function readDeploymentConfig(
  env: Record<string, string | undefined> = process.env,
): DeploymentConfig {
  const environment = readEnvironment(env.DEPLOYMENT_ENVIRONMENT, env.NODE_ENV)
  if (DEPLOYED_ENVIRONMENTS.has(environment) && env.NODE_ENV !== 'production') {
    throw new Error('Deployed environments require NODE_ENV=production')
  }

  const releaseId = readReleaseId(env.RELEASE_ID, environment)
  const nextDeploymentId = env.NEXT_DEPLOYMENT_ID?.trim() || undefined
  if (environment !== 'local' && nextDeploymentId !== releaseId) {
    throw new Error('NEXT_DEPLOYMENT_ID must exactly match RELEASE_ID')
  }

  if (environment !== 'local') assertStrongAuthSecret(env.AUTH_COOKIE_SECRET)

  return {
    environment,
    releaseId,
    appOrigin: readOrigin(env.APP_ORIGIN, environment),
    nextDeploymentId,
    storageMode: readStorageMode(env.BACKEND_STORAGE_MODE, env.NODE_ENV),
  }
}

export function assertReleasePreflight(
  env: Record<string, string | undefined> = process.env,
  options: ReleasePreflightOptions = {},
): ReleasePreflightResult {
  const config = readDeploymentConfig(env)
  if (config.environment === 'local') {
    throw new Error('Release preflight cannot target the local environment')
  }
  if (config.storageMode !== 'postgres' && !options.allowLegacyCookieRollback) {
    throw new Error('Release requires BACKEND_STORAGE_MODE=postgres')
  }

  requirePublicIdentifier('NEXT_PUBLIC_ALCHEMY_API_KEY', env.NEXT_PUBLIC_ALCHEMY_API_KEY)
  requirePublicIdentifier(
    'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
    env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  )

  let independentRpcFallbacks = 0
  for (const name of FALLBACK_RPC_ENV_NAMES) {
    const value = env[name]
    if (value) {
      requireHttpsUrl(name, value)
      independentRpcFallbacks += 1
    }
  }
  if (
    (config.environment === 'staging' || config.environment === 'production')
    && independentRpcFallbacks !== FALLBACK_RPC_ENV_NAMES.length
  ) {
    throw new Error('Staging and production require an independent RPC fallback for every supported chain')
  }

  return {
    ...config,
    observabilityDelivery: readObservabilityDelivery(env),
    independentRpcFallbacks,
  }
}
