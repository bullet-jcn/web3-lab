import { getSession } from '@/lib/auth/session'
import type { RiskFinding } from '@/lib/riskCheck'
import { GoogleGenAI, type GenerateContentResponse } from '@google/genai'
import { NextResponse } from 'next/server'

const NO_RISK_MESSAGE = '没有检测到已知的风险模式，但这不代表绝对安全，请仍然核对交易细节后再确认。'

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

  let findings: RiskFinding[]
  try {
    const body = await request.json()
    findings = body.findings
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 })
  }

  if (!Array.isArray(findings)) {
    return NextResponse.json({ error: 'findings 缺失或格式不对' }, { status: 400 })
  }

  if (findings.length === 0) {
    return NextResponse.json({ warning: NO_RISK_MESSAGE })
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
    return NextResponse.json({ error: 'AI 风险提示服务暂时不可用，请谨慎核对交易细节后再决定' }, { status: 502 })
  }

  const warning = response.text ?? '无法生成风险提示，请谨慎核对交易细节。'

  return NextResponse.json({ warning })
}
