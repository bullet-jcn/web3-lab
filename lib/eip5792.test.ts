import { expect, it, describe } from "vitest"
import { resolveAtomicSupport } from "./eip5792"

describe('resolveAtomicSupport', () => {
  it('returns sequential-fallback undefined status', () => {
    expect(resolveAtomicSupport(undefined)).toBe('sequential-fallback')
  })
  it('returns atomic', () => {
    expect(resolveAtomicSupport('supported')).toBe('atomic')
  })
  it('returns upgrade-then-atomic', () => {
    expect(resolveAtomicSupport('ready')).toBe('upgrade-then-atomic')
  })
  it('returns sequential-fallback for unsupported status', () => {
    expect(resolveAtomicSupport('unsupported')).toBe('sequential-fallback')
  })
})