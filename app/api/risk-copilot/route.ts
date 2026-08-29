import { getSession } from '@/lib/auth/session'
import { formatDeterministicRiskWarning, parseRiskFindingsRequest } from '@/lib/riskCheck'
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai'
import { NextResponse } from 'next/server'

const NO_RISK_MESSAGE = '没有检测到已知的风险模式，但这不代表绝对安全，请仍然核对交易细节后再确认。'
export const MAX_RISK_REQUEST_BYTES = 16 * 1024

const SYSTEM_PROMPT = `你是一个 web3 钱包的安全助手。你会收到一份 JSON 数组，是已经通过确定性代码逻辑分析出来的风险检测结果（severity/code/detail 字段），这些结果本身不是你需要判断或验证的对象。

你唯一的任务：把这些已经确定的风险，用简短、清晰的中文讲给一个可能不太懂区块链技术的用户听，并给出一句具体建议。

规则：
1. 只能基于给定的 JSON 数据描述风险，不允许提到清单之外的任何风险，不允许编造原因或后果。
2. 不要有寒暄、不要复述"我收到了这些数据"这类话，直接给结论。
3. 总共不超过 3 句话。`

export async function POST(request: Request): Promise<Response> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') {
    return NextResponse.json({ error: 'Content-Type 必须是 application/json' }, { status: 415 })
  }

  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RISK_REQUEST_BYTES) {
    return NextResponse.json({ error: '请求体过大' }, { status: 413 })
  }

  let rawBody = ''
  try {
    const reader = request.body?.getReader()
    if (reader) {
      const decoder = new TextDecoder()
      let receivedBytes = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        receivedBytes += value.byteLength
        if (receivedBytes > MAX_RISK_REQUEST_BYTES) {
          await reader.cancel()
          return NextResponse.json({ error: '请求体过大' }, { status: 413 })
        }
        rawBody += decoder.decode(value, { stream: true })
      }
      rawBody += decoder.decode()
    }
  } catch {
    return NextResponse.json({ error: '读取请求体失败' }, { status: 400 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 })
  }

  const parsed = parseRiskFindingsRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.reason }, { status: 400 })
  const { findings } = parsed

  if (findings.length === 0) {
    return NextResponse.json({ warning: NO_RISK_MESSAGE, degraded: false })
  }

  const client = new GoogleGenAI({})

  let response: GenerateContentResponse
  try {
    response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: JSON.stringify(findings),
      config: { systemInstruction: SYSTEM_PROMPT },
    })
  } catch (err) {
    console.error('risk-copilot: Gemini API call failed', err)
    return NextResponse.json({
      warning: `AI 解释服务暂时不可用。${formatDeterministicRiskWarning(findings)}`,
      degraded: true,
    })
  }

  const warning = response.text?.trim()
  if (!warning) {
    return NextResponse.json({
      warning: `AI 未返回解释。${formatDeterministicRiskWarning(findings)}`,
      degraded: true,
    })
  }

  return NextResponse.json({ warning, degraded: false })
}
