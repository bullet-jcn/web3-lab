import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { assertReleasePreflight, readDeploymentConfig } from './deploymentConfig'

const strongSecret = Buffer.alloc(32, 7).toString('base64')
const releaseId = 'a'.repeat(40)

function deployedEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'production',
    DEPLOYMENT_ENVIRONMENT: 'staging',
    RELEASE_ID: releaseId,
    NEXT_DEPLOYMENT_ID: releaseId,
    APP_ORIGIN: 'https://staging.example.com',
    AUTH_COOKIE_SECRET: strongSecret,
    BACKEND_STORAGE_MODE: 'postgres',
    NEXT_PUBLIC_ALCHEMY_API_KEY: 'alchemy-public-identifier',
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: 'walletconnect-public-identifier',
    NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_FALLBACK_URL: 'https://rpc-1.example.com/key',
    NEXT_PUBLIC_ETHEREUM_MAINNET_RPC_FALLBACK_URL: 'https://rpc-2.example.com/key',
    NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_URL: 'https://rpc-3.example.com/key',
    NEXT_PUBLIC_BASE_MAINNET_RPC_FALLBACK_URL: 'https://rpc-4.example.com/key',
    OBSERVABILITY_DELIVERY: 'platform',
    ...overrides,
  }
}

describe('deployment configuration', () => {
  it('uses explicit safe defaults only for local development', () => {
    expect(readDeploymentConfig({ NODE_ENV: 'development' })).toEqual({
      environment: 'local',
      releaseId: 'local',
      appOrigin: 'http://localhost:3000',
      nextDeploymentId: undefined,
      storageMode: 'legacy-cookie',
    })
  })

  it('binds a deployed environment to one origin and immutable release', () => {
    expect(readDeploymentConfig(deployedEnvironment())).toMatchObject({
      environment: 'staging',
      releaseId,
      appOrigin: 'https://staging.example.com',
      nextDeploymentId: releaseId,
      storageMode: 'postgres',
    })
  })

  it.each([
    [{ NODE_ENV: 'production' }, 'DEPLOYMENT_ENVIRONMENT is required'],
    [deployedEnvironment({ NODE_ENV: 'development' }), 'require NODE_ENV=production'],
    [deployedEnvironment({ APP_ORIGIN: 'http://staging.example.com' }), 'must use HTTPS'],
    [deployedEnvironment({ NEXT_DEPLOYMENT_ID: 'b'.repeat(40) }), 'must exactly match'],
    [deployedEnvironment({ AUTH_COOKIE_SECRET: Buffer.alloc(16).toString('base64') }), 'at least 32'],
  ])('rejects an unsafe deployed configuration', (env, message) => {
    expect(() => readDeploymentConfig(env)).toThrow(message)
  })
})

describe('release preflight', () => {
  it('requires all supported-chain fallbacks in staging and production', () => {
    expect(() => assertReleasePreflight(deployedEnvironment({
      NEXT_PUBLIC_BASE_MAINNET_RPC_FALLBACK_URL: undefined,
    }))).toThrow('independent RPC fallback for every supported chain')
  })

  it('returns only non-secret release evidence', () => {
    const result = assertReleasePreflight(deployedEnvironment())

    expect(result).toEqual({
      environment: 'staging',
      releaseId,
      appOrigin: 'https://staging.example.com',
      nextDeploymentId: releaseId,
      storageMode: 'postgres',
      observabilityDelivery: 'platform',
      independentRpcFallbacks: 4,
    })
    expect(JSON.stringify(result)).not.toContain(strongSecret)
    expect(JSON.stringify(result)).not.toContain('alchemy-public-identifier')
  })

  it('allows legacy storage only for an explicit emergency rollback preflight', () => {
    const env = deployedEnvironment({ BACKEND_STORAGE_MODE: 'legacy-cookie' })
    expect(() => assertReleasePreflight(env)).toThrow('requires BACKEND_STORAGE_MODE=postgres')
    expect(assertReleasePreflight(env, { allowLegacyCookieRollback: true }).storageMode)
      .toBe('legacy-cookie')
  })

  it('requires a real observability delivery mode', () => {
    expect(() => assertReleasePreflight(deployedEnvironment({
      OBSERVABILITY_DELIVERY: undefined,
    }))).toThrow('OBSERVABILITY_DELIVERY must be platform or otlp')
  })
})
