import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'
import { readBackendConfig } from '@/lib/server/backendConfig'

export interface QueryExecutor {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<Pick<QueryResult<Row>, 'rowCount' | 'rows'>>
}

export interface TransactionRunner {
  withTransaction<Result>(operation: (query: QueryExecutor) => Promise<Result>): Promise<Result>
}

class PostgresDatabase implements QueryExecutor, TransactionRunner {
  constructor(private readonly pool: Pool) {}

  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) {
    return this.pool.query<Row>(text, values)
  }

  async withTransaction<Result>(operation: (query: QueryExecutor) => Promise<Result>) {
    const client: PoolClient = await this.pool.connect()
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
  }
}

const globalDatabase = globalThis as typeof globalThis & {
  web3LabDatabase?: PostgresDatabase
}

export function getDatabase(): QueryExecutor & TransactionRunner {
  if (!globalDatabase.web3LabDatabase) {
    const config = readBackendConfig()
    const pool = new Pool({
      connectionString: config.databaseUrl,
      max: config.databasePoolMax,
      connectionTimeoutMillis: config.databaseConnectTimeoutMs,
      statement_timeout: config.databaseStatementTimeoutMs,
      idleTimeoutMillis: 30_000,
    })
    globalDatabase.web3LabDatabase = new PostgresDatabase(pool)
  }
  return globalDatabase.web3LabDatabase
}
