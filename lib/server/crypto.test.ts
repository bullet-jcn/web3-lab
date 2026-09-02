import { describe, expect, it } from 'vitest'
import { sha256Hex } from './crypto'

describe('sha256Hex', () => {
  it('creates a stable lowercase digest without retaining the input', () => {
    const digest = sha256Hex('opaque-session-token')
    expect(digest).toBe('00f5c39025967a24e513257fc3a8572166ddddaa08809f00fd260414df28ba9f')
    expect(digest).not.toContain('opaque-session-token')
  })
})
