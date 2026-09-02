import { randomBytes } from 'node:crypto'
import type { Address } from 'viem'
import { sha256Hex } from '@/lib/server/crypto'
import type {
  SessionRecord,
  SessionRepository,
  WalletIdentity,
} from '@/lib/server/db/repositories'

export interface IdentityRepository {
  findOrCreate(address: Address): Promise<WalletIdentity>
}

export interface SessionRevocationStore {
  isSessionRevoked(tokenHash: string): Promise<boolean>
  markSessionRevoked(tokenHash: string, ttlSeconds: number): Promise<void>
}

export type BackendSession = SessionRecord

export interface CreatedBackendSession {
  token: string
  session: BackendSession
}

const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export class BackendSessionService {
  constructor(
    private readonly identities: IdentityRepository,
    private readonly sessions: SessionRepository,
    private readonly revocations: SessionRevocationStore,
    private readonly ttlSeconds: number,
    private readonly createToken: () => string = () => randomBytes(32).toString('base64url'),
  ) {}

  async create(address: Address, chainId: number, now = new Date()): Promise<CreatedBackendSession> {
    const identity = await this.identities.findOrCreate(address)
    if (identity.userStatus !== 'active') {
      throw new Error('User is not active')
    }

    const token = this.createToken()
    if (!OPAQUE_TOKEN_PATTERN.test(token)) {
      throw new Error('Session token generator returned an invalid token')
    }

    const session = await this.sessions.create({
      userId: identity.userId,
      walletId: identity.walletId,
      chainId,
      address: identity.address,
      tokenHash: sha256Hex(token),
      expiresAt: new Date(now.getTime() + this.ttlSeconds * 1_000),
    })
    return { token, session }
  }

  async get(token: string | undefined, now = new Date()): Promise<BackendSession | null> {
    if (!token || !OPAQUE_TOKEN_PATTERN.test(token)) return null

    const tokenHash = sha256Hex(token)
    if (await this.revocations.isSessionRevoked(tokenHash)) return null
    return this.sessions.findActiveByTokenHash(tokenHash, now)
  }

  async revoke(token: string | undefined, now = new Date()): Promise<boolean> {
    if (!token || !OPAQUE_TOKEN_PATTERN.test(token)) return false

    const tokenHash = sha256Hex(token)
    await this.revocations.markSessionRevoked(tokenHash, this.ttlSeconds)
    const session = await this.sessions.findActiveByTokenHash(tokenHash, now)
    if (!session) return false
    return this.sessions.revoke(session.id, now)
  }
}
