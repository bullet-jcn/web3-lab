import { generateSiweNonce } from 'viem/siwe'

export interface NonceStore {
  issueNonce(nonce: string, ttlSeconds: number): Promise<boolean>
  consumeNonce(nonce: string): Promise<boolean>
}

export class BackendNonceService {
  constructor(
    private readonly store: NonceStore,
    private readonly ttlSeconds: number,
    private readonly createNonce: () => string = generateSiweNonce,
  ) {}

  async issue(): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const nonce = this.createNonce()
      if (await this.store.issueNonce(nonce, this.ttlSeconds)) return nonce
    }
    throw new Error('Unable to issue a unique SIWE nonce')
  }

  consume(nonce: string): Promise<boolean> {
    return this.store.consumeNonce(nonce)
  }
}
