export interface BackendConfig {
  databaseUrl: string
  redisUrl: string
  databasePoolMax: number
  databaseConnectTimeoutMs: number
  databaseStatementTimeoutMs: number
}

function requireUrl(name: string, value: string | undefined, protocols: string[]): string {
  if (!value) throw new Error(`${name} is required`)

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }

  if (!protocols.includes(url.protocol)) {
    throw new Error(`${name} must use ${protocols.join(' or ')}`)
  }

  return value
}

function readPositiveInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined) return fallback
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer`)

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be between 1 and ${maximum}`)
  }
  return parsed
}

export function readBackendConfig(
  env: Record<string, string | undefined> = process.env,
): BackendConfig {
  return {
    databaseUrl: requireUrl('DATABASE_URL', env.DATABASE_URL, ['postgres:', 'postgresql:']),
    redisUrl: requireUrl('REDIS_URL', env.REDIS_URL, ['redis:', 'rediss:']),
    databasePoolMax: readPositiveInteger('DATABASE_POOL_MAX', env.DATABASE_POOL_MAX, 10, 100),
    databaseConnectTimeoutMs: readPositiveInteger(
      'DATABASE_CONNECT_TIMEOUT_MS',
      env.DATABASE_CONNECT_TIMEOUT_MS,
      5_000,
      60_000,
    ),
    databaseStatementTimeoutMs: readPositiveInteger(
      'DATABASE_STATEMENT_TIMEOUT_MS',
      env.DATABASE_STATEMENT_TIMEOUT_MS,
      10_000,
      120_000,
    ),
  }
}
