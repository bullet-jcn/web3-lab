import pg from 'pg'
import { readBackendConfig } from '../lib/server/backendConfig.ts'
import {
  createRetentionCutoffs,
  PostgresDataLifecycleRepository,
} from '../lib/server/dataLifecycle.ts'

const { Pool } = pg
let pool

const closePool = async () => {
  if (pool) await pool.end()
}

process.once('SIGINT', async () => {
  await closePool()
  process.exit(130)
})
process.once('SIGTERM', async () => {
  await closePool()
  process.exit(143)
})

try {
  const environment = process.env.DEPLOYMENT_ENVIRONMENT
  const apply = process.argv.includes('--apply')
  const confirmation = process.argv
    .find((argument) => argument.startsWith('--confirm-environment='))
    ?.slice('--confirm-environment='.length)

  if (!['preview', 'staging', 'production'].includes(environment)) {
    throw new Error('DEPLOYMENT_ENVIRONMENT must be preview, staging, or production')
  }
  if (apply && confirmation !== environment) {
    throw new Error(`Apply mode requires --confirm-environment=${environment}`)
  }

  const config = readBackendConfig(process.env)
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 1,
    connectionTimeoutMillis: config.databaseConnectTimeoutMs,
    statement_timeout: config.databaseStatementTimeoutMs,
  })
  const transactions = {
    async withTransaction(operation) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await operation(client)
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
  }
  const cutoffs = createRetentionCutoffs()
  const repository = new PostgresDataLifecycleRepository(pool, transactions)
  const counts = apply
    ? await repository.applyRetention(cutoffs)
    : await repository.previewRetention(cutoffs)

  console.info(JSON.stringify({
    mode: apply ? 'applied' : 'preview',
    environment,
    cutoffs: {
      sessionsBefore: cutoffs.sessionsBefore.toISOString(),
      abandonedIntentsBefore: cutoffs.abandonedIntentsBefore.toISOString(),
      historyBefore: cutoffs.historyBefore.toISOString(),
    },
    counts,
  }))
} catch (error) {
  const errorType = error instanceof Error ? error.name : 'UnknownError'
  console.error(`Data retention failed (${errorType})`)
  process.exitCode = 1
} finally {
  await closePool()
}
