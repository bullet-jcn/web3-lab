interface OriginValidationOptions {
  appOrigin?: string
  trustProxyHeaders?: boolean
}

export type OriginValidationResult =
  | { ok: true }
  | { ok: false; status: 403 | 500; error: string }

function parseOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    if ((url.protocol !== 'http:' && url.protocol !== 'https:')
      || url.username
      || url.password
      || (url.pathname !== '/' && url.pathname !== '')
      || url.search
      || url.hash) return null
    return url.origin
  } catch {
    return null
  }
}

function firstForwardedValue(value: string | null): string | null {
  return value?.split(',', 1)[0]?.trim() || null
}

function expectedRequestOrigin(request: Request, trustProxyHeaders: boolean): string | null {
  if (trustProxyHeaders) {
    const forwardedHost = firstForwardedValue(request.headers.get('x-forwarded-host'))
    const forwardedProto = firstForwardedValue(request.headers.get('x-forwarded-proto'))
    if (forwardedHost && forwardedProto) return parseOrigin(`${forwardedProto}://${forwardedHost}`)
  }
  return parseOrigin(new URL(request.url).origin)
}

export function validateRequestOrigin(
  request: Request,
  options: OriginValidationOptions = {},
): OriginValidationResult {
  const requestOrigin = request.headers.get('origin')
  const parsedRequestOrigin = requestOrigin ? parseOrigin(requestOrigin) : null
  if (!parsedRequestOrigin) {
    return { ok: false, status: 403, error: '请求来源缺失或不受信任' }
  }

  const configuredOrigin = options.appOrigin ?? process.env.APP_ORIGIN
  const expectedOrigin = configuredOrigin
    ? parseOrigin(configuredOrigin)
    : expectedRequestOrigin(
        request,
        options.trustProxyHeaders ?? process.env.TRUST_PROXY_HEADERS === 'true',
      )

  if (!expectedOrigin) {
    return { ok: false, status: 500, error: '服务端 Origin 配置无效' }
  }
  if (parsedRequestOrigin !== expectedOrigin) {
    return { ok: false, status: 403, error: '请求来源不受信任' }
  }
  return { ok: true }
}

export function enforceSameOrigin(request: Request): Response | null {
  const result = validateRequestOrigin(request)
  return result.ok ? null : Response.json({ error: result.error }, { status: result.status })
}
