export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; response: Response }

export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') {
    return {
      ok: false,
      response: Response.json({ error: 'Content-Type 必须是 application/json' }, { status: 415 }),
    }
  }

  const declaredLength = request.headers.get('content-length')
  if (declaredLength !== null && Number(declaredLength) > maxBytes) {
    return { ok: false, response: Response.json({ error: '请求体过大' }, { status: 413 }) }
  }

  const reader = request.body?.getReader()
  const decoder = new TextDecoder()
  let receivedBytes = 0
  let rawBody = ''

  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        receivedBytes += value.byteLength
        if (receivedBytes > maxBytes) {
          await reader.cancel()
          return { ok: false, response: Response.json({ error: '请求体过大' }, { status: 413 }) }
        }
        rawBody += decoder.decode(value, { stream: true })
      }
      rawBody += decoder.decode()
    }
  } catch {
    return { ok: false, response: Response.json({ error: '读取请求体失败' }, { status: 400 }) }
  }

  try {
    return { ok: true, value: JSON.parse(rawBody) }
  } catch {
    return { ok: false, response: Response.json({ error: '请求体不是合法 JSON' }, { status: 400 }) }
  }
}
