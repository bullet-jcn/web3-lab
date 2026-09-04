import { assertReleasePreflight } from '../lib/server/deploymentConfig.ts'
import { readBackendConfig } from '../lib/server/backendConfig.ts'

const allowLegacyCookieRollback = process.argv.includes('--allow-legacy-cookie-rollback')

try {
  const result = assertReleasePreflight(process.env, { allowLegacyCookieRollback })
  if (result.storageMode === 'postgres') readBackendConfig(process.env)

  console.info(JSON.stringify({
    status: 'ready',
    environment: result.environment,
    releaseId: result.releaseId,
    appOrigin: result.appOrigin,
    storageMode: result.storageMode,
    observabilityDelivery: result.observabilityDelivery,
    independentRpcFallbacks: result.independentRpcFallbacks,
  }))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Release preflight failed')
  process.exitCode = 1
}
