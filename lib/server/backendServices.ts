import { NONCE_TTL_SECONDS, SESSION_TTL_SECONDS } from '@/lib/auth/constants'
import { BackendNonceService } from './auth/nonceService'
import { BackendSessionService } from './auth/sessionService'
import { getDatabase } from './db/client'
import {
  PostgresIdentityRepository,
  PostgresSessionRepository,
  PostgresWatchlistRepository,
} from './db/repositories'
import { PostgresDataLifecycleRepository } from './dataLifecycle'
import { getRedis } from './redis/client'
import { RedisCoordinator } from './redis/coordinator'

async function dependencies() {
  const database = getDatabase()
  const redis = new RedisCoordinator(await getRedis())
  return { database, redis }
}

export async function getBackendNonceService(): Promise<BackendNonceService> {
  const { redis } = await dependencies()
  return new BackendNonceService(redis, NONCE_TTL_SECONDS)
}

export async function getBackendSessionService(): Promise<BackendSessionService> {
  const { database, redis } = await dependencies()
  return new BackendSessionService(
    new PostgresIdentityRepository(database, database),
    new PostgresSessionRepository(database),
    redis,
    SESSION_TTL_SECONDS,
  )
}

export async function getBackendWatchlistRepository(): Promise<PostgresWatchlistRepository> {
  const { database } = await dependencies()
  return new PostgresWatchlistRepository(database, database)
}

export async function getBackendDataLifecycleRepository(): Promise<PostgresDataLifecycleRepository> {
  const { database } = await dependencies()
  return new PostgresDataLifecycleRepository(database, database)
}
