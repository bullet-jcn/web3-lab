import { describe, expect, it } from 'vitest'
import { readBackendConfig } from './backendConfig'

const requiredEnvironment = {
  DATABASE_URL: 'postgresql://app:secret@db.internal:5432/web3_lab',
  REDIS_URL: 'rediss://cache.internal:6380',
}

describe('readBackendConfig', () => {
  it('reads private backend URLs and bounded defaults', () => {
    expect(readBackendConfig(requiredEnvironment)).toEqual({
      databaseUrl: requiredEnvironment.DATABASE_URL,
      redisUrl: requiredEnvironment.REDIS_URL,
      databasePoolMax: 10,
      databaseConnectTimeoutMs: 5_000,
      databaseStatementTimeoutMs: 10_000,
    })
  })

  it('accepts explicit bounded pool and timeout values', () => {
    expect(
      readBackendConfig({
        ...requiredEnvironment,
        DATABASE_POOL_MAX: '20',
        DATABASE_CONNECT_TIMEOUT_MS: '2500',
        DATABASE_STATEMENT_TIMEOUT_MS: '30000',
      }),
    ).toMatchObject({
      databasePoolMax: 20,
      databaseConnectTimeoutMs: 2_500,
      databaseStatementTimeoutMs: 30_000,
    })
  })

  it.each([
    [{ REDIS_URL: requiredEnvironment.REDIS_URL }, 'DATABASE_URL is required'],
    [{ DATABASE_URL: requiredEnvironment.DATABASE_URL }, 'REDIS_URL is required'],
    [{ ...requiredEnvironment, DATABASE_URL: 'https://db.internal' }, 'DATABASE_URL must use'],
    [{ ...requiredEnvironment, REDIS_URL: 'https://cache.internal' }, 'REDIS_URL must use'],
    [{ ...requiredEnvironment, DATABASE_POOL_MAX: '0' }, 'DATABASE_POOL_MAX must be between'],
    [{ ...requiredEnvironment, DATABASE_POOL_MAX: 'lots' }, 'must be a positive integer'],
  ])('rejects invalid configuration %#', (environment, expectedMessage) => {
    expect(() => readBackendConfig(environment)).toThrow(expectedMessage)
  })
})
