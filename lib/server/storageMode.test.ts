import { describe, expect, it } from 'vitest'
import { readBackendStorageMode } from './storageMode'

describe('readBackendStorageMode', () => {
  it.each(['legacy-cookie', 'postgres'] as const)('accepts the explicit %s mode', (mode) => {
    expect(readBackendStorageMode({ BACKEND_STORAGE_MODE: mode, NODE_ENV: 'production' })).toBe(mode)
  })

  it('keeps legacy mode as a local and test default', () => {
    expect(readBackendStorageMode({ NODE_ENV: 'test' })).toBe('legacy-cookie')
  })

  it('requires an explicit production decision', () => {
    expect(() => readBackendStorageMode({ NODE_ENV: 'production' })).toThrow(
      'BACKEND_STORAGE_MODE is required in production',
    )
  })

  it('rejects unknown modes instead of silently falling back', () => {
    expect(() => readBackendStorageMode({ BACKEND_STORAGE_MODE: 'auto' })).toThrow(
      'BACKEND_STORAGE_MODE must be legacy-cookie or postgres',
    )
  })
})
