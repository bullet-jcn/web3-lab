import { describe, expect, it } from 'vitest'
import { GET } from './route'

describe('service liveness route', () => {
  it('proves only that the application process can answer HTTP', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
    expect(await response.json()).toEqual({ status: 'alive' })
  })
})
