import { sha256Hex } from '@/lib/server/crypto'

export interface RedisExecutor {
  set(
    key: string,
    value: string,
    options: { EX: number; NX: true },
  ): Promise<string | null>
  get(key: string): Promise<string | null>
  getDel(key: string): Promise<string | null>
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>
  ping?(): Promise<void>
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterSeconds: number
}

export type IdempotencyClaim = 'acquired' | 'replay' | 'conflict'

const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
`

function namespacedKey(namespace: string, untrustedIdentifier: string): string {
  return `web3-lab:v1:${namespace}:${sha256Hex(untrustedIdentifier)}`
}

function positiveSeconds(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

export class RedisCoordinator {
  constructor(private readonly redis: RedisExecutor) {}

  async issueNonce(nonce: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(
      namespacedKey('siwe-nonce', nonce),
      'issued',
      { EX: positiveSeconds(ttlSeconds, 'Nonce TTL'), NX: true },
    )
    return result === 'OK'
  }

  async consumeNonce(nonce: string): Promise<boolean> {
    return (await this.redis.getDel(namespacedKey('siwe-nonce', nonce))) === 'issued'
  }

  async markSessionRevoked(tokenHash: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      namespacedKey('session-revoked', tokenHash),
      '1',
      { EX: positiveSeconds(ttlSeconds, 'Session revocation TTL'), NX: true },
    )
  }

  async isSessionRevoked(tokenHash: string): Promise<boolean> {
    return (await this.redis.get(namespacedKey('session-revoked', tokenHash))) === '1'
  }

  async claimIdempotency(
    userId: string,
    idempotencyKey: string,
    requestFingerprint: string,
    ttlSeconds: number,
  ): Promise<IdempotencyClaim> {
    const key = namespacedKey('idempotency', `${userId}\0${idempotencyKey}`)
    const acquired = await this.redis.set(key, requestFingerprint, {
      EX: positiveSeconds(ttlSeconds, 'Idempotency TTL'),
      NX: true,
    })
    if (acquired === 'OK') return 'acquired'
    return (await this.redis.get(key)) === requestFingerprint ? 'replay' : 'conflict'
  }

  async checkRateLimit(
    scope: string,
    subject: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const normalizedLimit = positiveSeconds(limit, 'Rate limit')
    const normalizedWindow = positiveSeconds(windowSeconds, 'Rate-limit window')
    const result = await this.redis.eval(RATE_LIMIT_SCRIPT, {
      keys: [namespacedKey(`rate-limit:${scope}`, subject)],
      arguments: [String(normalizedWindow)],
    })

    if (!Array.isArray(result) || result.length !== 2) {
      throw new Error('Redis returned an invalid rate-limit result')
    }
    const count = Number(result[0])
    const ttl = Number(result[1])
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(ttl)) {
      throw new Error('Redis returned an invalid rate-limit result')
    }

    return {
      allowed: count <= normalizedLimit,
      limit: normalizedLimit,
      remaining: Math.max(0, normalizedLimit - count),
      retryAfterSeconds: count > normalizedLimit ? Math.max(1, ttl) : 0,
    }
  }
}
