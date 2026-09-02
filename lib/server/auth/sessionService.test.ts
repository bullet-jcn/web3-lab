import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'
import type { SessionRecord, SessionRepository, WalletIdentity } from '../db/repositories'
import { sha256Hex } from '../crypto'
import {
  BackendSessionService,
  type IdentityRepository,
  type SessionRevocationStore,
} from './sessionService'

const address = '0x1234567890123456789012345678901234567890' as Address
const token = 'a'.repeat(43)

class MemorySessions implements SessionRepository {
  record: SessionRecord | null = null
  revokedId: string | null = null

  async create(input: Omit<SessionRecord, 'id' | 'revokedAt'>) {
    this.record = { id: 'session-id', ...input, revokedAt: null }
    return this.record
  }

  async findActiveByTokenHash(tokenHash: string, now = new Date()) {
    if (
      !this.record ||
      this.record.tokenHash !== tokenHash ||
      this.record.revokedAt ||
      this.record.expiresAt <= now
    ) {
      return null
    }
    return this.record
  }

  async revoke(id: string, revokedAt = new Date()) {
    if (!this.record || this.record.id !== id || this.record.revokedAt) return false
    this.record.revokedAt = revokedAt
    this.revokedId = id
    return true
  }
}

class MemoryRevocations implements SessionRevocationStore {
  readonly revoked = new Set<string>()
  ttl: number | null = null

  async isSessionRevoked(tokenHash: string) {
    return this.revoked.has(tokenHash)
  }

  async markSessionRevoked(tokenHash: string, ttlSeconds: number) {
    this.revoked.add(tokenHash)
    this.ttl = ttlSeconds
  }
}

const activeIdentity: WalletIdentity = {
  userId: 'user-id',
  walletId: 'wallet-id',
  address,
  userStatus: 'active',
}

function createService(identity = activeIdentity) {
  const identities: IdentityRepository = { findOrCreate: async () => identity }
  const sessions = new MemorySessions()
  const revocations = new MemoryRevocations()
  const service = new BackendSessionService(identities, sessions, revocations, 60, () => token)
  return { service, sessions, revocations }
}

describe('BackendSessionService', () => {
  it('returns the opaque token but persists only its hash', async () => {
    const { service, sessions } = createService()
    const now = new Date('2026-01-01T00:00:00Z')

    await expect(service.create(address, 11_155_111, now)).resolves.toMatchObject({ token })
    expect(sessions.record).toMatchObject({
      address,
      chainId: 11_155_111,
      tokenHash: sha256Hex(token),
      expiresAt: new Date('2026-01-01T00:01:00Z'),
    })
    expect(JSON.stringify(sessions.record)).not.toContain(token)
  })

  it('loads only a non-revoked, unexpired token', async () => {
    const { service, revocations } = createService()
    const now = new Date('2026-01-01T00:00:00Z')
    await service.create(address, 11_155_111, now)

    await expect(service.get(token, now)).resolves.toMatchObject({ address })
    revocations.revoked.add(sha256Hex(token))
    await expect(service.get(token, now)).resolves.toBeNull()
    await expect(service.get('not-a-token', now)).resolves.toBeNull()
  })

  it('marks the fast revocation path before the durable session record', async () => {
    const { service, sessions, revocations } = createService()
    const now = new Date('2026-01-01T00:00:00Z')
    await service.create(address, 11_155_111, now)

    await expect(service.revoke(token, now)).resolves.toBe(true)
    expect(revocations.revoked).toContain(sha256Hex(token))
    expect(revocations.ttl).toBe(60)
    expect(sessions.revokedId).toBe('session-id')
  })

  it('rejects disabled identities and invalid generated tokens', async () => {
    const disabled = createService({ ...activeIdentity, userStatus: 'disabled' })
    await expect(disabled.service.create(address, 1)).rejects.toThrow('User is not active')

    const invalid = new BackendSessionService(
      { findOrCreate: async () => activeIdentity },
      new MemorySessions(),
      new MemoryRevocations(),
      60,
      () => 'short',
    )
    await expect(invalid.create(address, 1)).rejects.toThrow('invalid token')
  })
})
