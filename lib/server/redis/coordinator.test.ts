import { describe, expect, it } from 'vitest'
import { RedisCoordinator, type RedisExecutor } from './coordinator'

class MemoryRedis implements RedisExecutor {
  readonly values = new Map<string, string>()
  readonly setCalls: Array<{ key: string; value: string; options: { EX: number; NX: true } }> = []
  evalResult: unknown = [1, 60]
  evalCall: { script: string; options: { keys: string[]; arguments: string[] } } | null = null

  async set(key: string, value: string, options: { EX: number; NX: true }) {
    this.setCalls.push({ key, value, options })
    if (this.values.has(key)) return null
    this.values.set(key, value)
    return 'OK'
  }

  async get(key: string) {
    return this.values.get(key) ?? null
  }

  async getDel(key: string) {
    const value = this.values.get(key) ?? null
    this.values.delete(key)
    return value
  }

  async eval(script: string, options: { keys: string[]; arguments: string[] }) {
    this.evalCall = { script, options }
    return this.evalResult
  }
}

describe('RedisCoordinator', () => {
  it('issues and atomically consumes a nonce only once', async () => {
    const redis = new MemoryRedis()
    const coordinator = new RedisCoordinator(redis)

    await expect(coordinator.issueNonce('public-nonce', 300)).resolves.toBe(true)
    await expect(coordinator.consumeNonce('public-nonce')).resolves.toBe(true)
    await expect(coordinator.consumeNonce('public-nonce')).resolves.toBe(false)
    expect(redis.setCalls[0].key).not.toContain('public-nonce')
    expect(redis.setCalls[0].options).toEqual({ EX: 300, NX: true })
  })

  it('distinguishes a new idempotency claim, replay, and conflicting reuse', async () => {
    const redis = new MemoryRedis()
    const coordinator = new RedisCoordinator(redis)

    await expect(coordinator.claimIdempotency('user-1', 'request-1', 'aaa', 900)).resolves.toBe(
      'acquired',
    )
    await expect(coordinator.claimIdempotency('user-1', 'request-1', 'aaa', 900)).resolves.toBe(
      'replay',
    )
    await expect(coordinator.claimIdempotency('user-1', 'request-1', 'bbb', 900)).resolves.toBe(
      'conflict',
    )
    expect(redis.setCalls[0].key).not.toContain('user-1')
    expect(redis.setCalls[0].key).not.toContain('request-1')
  })

  it('stores session revocation with a bounded lifetime', async () => {
    const redis = new MemoryRedis()
    const coordinator = new RedisCoordinator(redis)

    await coordinator.markSessionRevoked('token-hash', 120)
    await expect(coordinator.isSessionRevoked('token-hash')).resolves.toBe(true)
    expect(redis.setCalls[0].options.EX).toBe(120)
  })

  it('uses one atomic script for fixed-window rate limits', async () => {
    const redis = new MemoryRedis()
    redis.evalResult = [4, 42]
    const coordinator = new RedisCoordinator(redis)

    await expect(coordinator.checkRateLimit('risk-copilot', 'subject', 3, 60)).resolves.toEqual({
      allowed: false,
      limit: 3,
      remaining: 0,
      retryAfterSeconds: 42,
    })
    expect(redis.evalCall?.script).toContain("redis.call('INCR'")
    expect(redis.evalCall?.script).toContain("redis.call('EXPIRE'")
    expect(redis.evalCall?.options.arguments).toEqual(['60'])
    expect(redis.evalCall?.options.keys[0]).not.toContain('subject')
  })

  it('fails closed on invalid limits or malformed Redis responses', async () => {
    const redis = new MemoryRedis()
    const coordinator = new RedisCoordinator(redis)

    await expect(coordinator.checkRateLimit('api', 'subject', 0, 60)).rejects.toThrow(
      'Rate limit must be a positive integer',
    )
    redis.evalResult = 'invalid'
    await expect(coordinator.checkRateLimit('api', 'subject', 1, 60)).rejects.toThrow(
      'invalid rate-limit result',
    )
  })
})
