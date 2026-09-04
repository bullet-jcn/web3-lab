import { describe, expect, it } from 'vitest'
import { readPublicServiceConfig } from './publicServiceConfig'

describe('public service configuration', () => {
  it('uses an honest local fallback without inventing a support address', () => {
    expect(readPublicServiceConfig({})).toEqual({
      operatorName: 'Web3 Sentinel',
      supportEmail: null,
    })
  })

  it('accepts bounded deployment contact details', () => {
    expect(readPublicServiceConfig({
      NEXT_PUBLIC_OPERATOR_NAME: 'Sentinel Labs Pte. Ltd.',
      NEXT_PUBLIC_SUPPORT_EMAIL: 'support@example.com',
    })).toEqual({
      operatorName: 'Sentinel Labs Pte. Ltd.',
      supportEmail: 'support@example.com',
    })
  })

  it('rejects malformed public contact configuration', () => {
    expect(() => readPublicServiceConfig({ NEXT_PUBLIC_SUPPORT_EMAIL: 'not-an-email' }))
      .toThrow('valid email address')
  })
})
