import { describe, expect, it } from 'vitest'
import { readJsonBody } from './json'

function request(body: string, contentType = 'application/json') {
  return new Request('https://sentinel.example/api/example', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  })
}

describe('readJsonBody', () => {
  it('reads valid JSON within the byte limit', async () => {
    expect(await readJsonBody(request('{"ok":true}'), 32)).toEqual({ ok: true, value: { ok: true } })
  })

  it('rejects non-JSON content types', async () => {
    const result = await readJsonBody(request('{}', 'text/plain'), 32)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(415)
  })

  it('rejects malformed JSON', async () => {
    const result = await readJsonBody(request('{'), 32)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })

  it('measures UTF-8 bytes instead of JavaScript characters', async () => {
    const result = await readJsonBody(request('"安全"'), 5)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(413)
  })
})
