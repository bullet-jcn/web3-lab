import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const migrationsDirectory = join(projectRoot, 'migrations')
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run database migrations')
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
})

const client = await pool.connect()

try {
  await client.query('SELECT pg_advisory_lock($1)', [826_421_004])
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => /^\d+_[a-z0-9_]+\.sql$/.test(filename))
    .sort()

  for (const filename of filenames) {
    const sql = await readFile(join(migrationsDirectory, filename), 'utf8')
    const checksum = createHash('sha256').update(sql).digest('hex')
    const existing = await client.query(
      'SELECT checksum FROM schema_migrations WHERE filename = $1',
      [filename],
    )

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration was modified: ${filename}`)
      }
      continue
    }

    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [filename, checksum],
      )
      await client.query('COMMIT')
      console.info(`Applied ${filename}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock($1)', [826_421_004]).catch(() => undefined)
  client.release()
  await pool.end()
}
