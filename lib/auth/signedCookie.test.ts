import { describe, expect, it } from 'vitest'
import { sign, verify } from './signedCookie'

const SECRET = 'test-secret'
const PURPOSE = 'test-purpose'

describe('signedCookie', () => {
  it('round-trips a payload signed and verified with the same purpose/secret', () => {
    const cookie = sign(PURPOSE, { userId: 42 }, 60, SECRET)
    const payload = verify<{ userId: number }>(PURPOSE, cookie, SECRET)
    expect(payload).toEqual({ userId: 42 })
  })

  it('rejects a payload that has been tampered with', () => {
    const cookie = sign(PURPOSE, { userId: 42 }, 60, SECRET)
    const [payloadPart, signaturePart] = cookie.split('.')
    const tamperedPayload = Buffer.from(JSON.stringify({ purpose: PURPOSE, payload: { userId: 999 }, exp: 9999999999 })).toString('base64url')
    const tampered = `${tamperedPayload}.${signaturePart}`
    expect(verify(PURPOSE, tampered, SECRET)).toBeNull()
    // sanity check: the original, untouched cookie still verifies fine
    expect(verify(PURPOSE, `${payloadPart}.${signaturePart}`, SECRET)).not.toBeNull()
  })

  it('rejects a tampered signature', () => {
    const cookie = sign(PURPOSE, { userId: 42 }, 60, SECRET)
    const [payloadPart, signaturePart] = cookie.split('.')
    const flippedChar = signaturePart[0] === 'A' ? 'B' : 'A'
    const tampered = `${payloadPart}.${flippedChar}${signaturePart.slice(1)}`
    expect(verify(PURPOSE, tampered, SECRET)).toBeNull()
  })

  it('rejects an expired cookie', () => {
    const cookie = sign(PURPOSE, { userId: 42 }, -1, SECRET)
    expect(verify(PURPOSE, cookie, SECRET)).toBeNull()
  })

  it('rejects a cookie verified under a different purpose', () => {
    const cookie = sign(PURPOSE, { userId: 42 }, 60, SECRET)
    expect(verify('other-purpose', cookie, SECRET)).toBeNull()
  })

  it('rejects a cookie verified with the wrong secret', () => {
    const cookie = sign(PURPOSE, { userId: 42 }, 60, SECRET)
    expect(verify(PURPOSE, cookie, 'wrong-secret')).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(verify(PURPOSE, undefined, SECRET)).toBeNull()
    expect(verify(PURPOSE, 'not-a-valid-cookie', SECRET)).toBeNull()
    expect(verify(PURPOSE, '', SECRET)).toBeNull()
  })
})
