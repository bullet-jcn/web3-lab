import { createClient, type RedisClientType } from 'redis'
import { readBackendConfig } from '@/lib/server/backendConfig'
import type { RedisExecutor } from './coordinator'
import { emitStructuredLog } from '@/lib/server/observability/logger'

class NodeRedisExecutor implements RedisExecutor {
  constructor(private readonly client: RedisClientType) {}

  set(key: string, value: string, options: { EX: number; NX: true }) {
    return this.client.set(key, value, options)
  }

  get(key: string) {
    return this.client.get(key)
  }

  getDel(key: string) {
    return this.client.getDel(key)
  }

  eval(script: string, options: { keys: string[]; arguments: string[] }) {
    return this.client.eval(script, options)
  }

  async ping(): Promise<void> {
    await this.client.ping()
  }
}

const globalRedis = globalThis as typeof globalThis & {
  web3LabRedisClient?: RedisClientType
  web3LabRedisExecutor?: NodeRedisExecutor
}

export async function getRedis(): Promise<RedisExecutor> {
  if (!globalRedis.web3LabRedisClient) {
    const { redisUrl } = readBackendConfig()
    const client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5_000,
        reconnectStrategy(retries) {
          return retries >= 5 ? false : Math.min(100 * 2 ** retries, 2_000)
        },
      },
    })
    client.on('error', (error) => {
      emitStructuredLog({
        level: 'error',
        event: 'dependency.connection_error',
        outcome: 'unhealthy',
        dependency: 'redis',
        error,
      })
    })
    globalRedis.web3LabRedisClient = client
    globalRedis.web3LabRedisExecutor = new NodeRedisExecutor(client)
  }

  if (!globalRedis.web3LabRedisClient.isOpen) {
    await globalRedis.web3LabRedisClient.connect()
  }
  return globalRedis.web3LabRedisExecutor!
}
