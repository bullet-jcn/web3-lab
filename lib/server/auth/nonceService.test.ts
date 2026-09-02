import { describe, expect, it } from 'vitest'
import { BackendNonceService, type NonceStore } from './nonceService'

class MemoryNonces implements NonceStore {
  readonly issued: string[] = []
  readonly valid = new Set<string>()
  rejectFirst = false

  async issueNonce(nonce: string) {
    this.issued.push(nonce)
    if (this.rejectFirst && this.issued.length === 1) return false
    this.valid.add(nonce)
    return true
  }

  async consumeNonce(nonce: string) {
    const existed = this.valid.has(nonce)
    this.valid.delete(nonce)
    return existed
  }
}

describe('BackendNonceService', () => {
  it('retries a nonce collision and consumes the issued nonce once', async () => {
    const store = new MemoryNonces()
    store.rejectFirst = true
    const generated = ['collision', 'unique']
    const service = new BackendNonceService(store, 300, () => generated.shift()!)

    await expect(service.issue()).resolves.toBe('unique')
    expect(store.issued).toEqual(['collision', 'unique'])
    await expect(service.consume('unique')).resolves.toBe(true)
    await expect(service.consume('unique')).resolves.toBe(false)
  })

  it('fails after three collisions', async () => {
    const store: NonceStore = {
      issueNonce: async () => false,
      consumeNonce: async () => false,
    }
    const service = new BackendNonceService(store, 300, () => 'collision')
    await expect(service.issue()).rejects.toThrow('Unable to issue a unique SIWE nonce')
  })
})
