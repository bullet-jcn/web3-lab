import { createHmac, timingSafeEqual } from 'crypto'

interface SignedEnvelope<T> {
  purpose: string
  payload: T
  exp: number
}

function computeSignature(purpose: string, payloadPart: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`${purpose}:${payloadPart}`).digest()
}

export function sign(purpose: string, payload: object, ttlSeconds: number, secret: string): string {
  const payloadPart = Buffer.from(
    JSON.stringify({ purpose, payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString('base64url')
  const signature = computeSignature(purpose, payloadPart, secret).toString('base64url')
  return `${payloadPart}.${signature}`
}

export function verify<T>(purpose: string, cookieValue: string | undefined, secret: string): T | null {
  if (!cookieValue) return null

  const separatorIndex = cookieValue.lastIndexOf('.')
  if (separatorIndex === -1) return null

  const payloadPart = cookieValue.slice(0, separatorIndex)
  const providedSignature = cookieValue.slice(separatorIndex + 1)

  const expectedSignature = computeSignature(purpose, payloadPart, secret)
  const providedBuffer = Buffer.from(providedSignature, 'base64url')

  // timingSafeEqual throws (rather than returning false) if the two buffers
  // differ in length, so a length mismatch has to be ruled out first.
  if (providedBuffer.length !== expectedSignature.length) return null
  if (!timingSafeEqual(providedBuffer, expectedSignature)) return null

  let envelope: SignedEnvelope<T>
  try {
    envelope = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (envelope.exp < Math.floor(Date.now() / 1000)) return null

  return envelope.payload
}
