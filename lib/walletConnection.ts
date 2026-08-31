const WALLETCONNECT_PLACEHOLDER = 'your-walletconnect-project-id'

export function normalizeWalletConnectProjectId(value: string | undefined): string | null {
  const projectId = value?.trim()
  if (!projectId || projectId === WALLETCONNECT_PLACEHOLDER) return null
  return projectId
}

function collectErrorMessages(error: unknown): string {
  const messages: string[] = []
  const seen = new Set<unknown>()
  let current = error

  for (let depth = 0; depth < 5 && current && !seen.has(current); depth += 1) {
    seen.add(current)
    if (current instanceof Error) messages.push(current.message)
    if (typeof current === 'object' && 'cause' in current) {
      current = (current as { cause?: unknown }).cause
    } else {
      break
    }
  }

  return messages.join(' ')
}

export function getWalletConnectionErrorMessage(error: unknown): string {
  const message = collectErrorMessages(error)
  if (/user (rejected|denied)|request rejected|rejected the request|4001/i.test(message)) {
    return '你取消了钱包连接'
  }
  if (/provider not found|no provider|connector not found|not installed/i.test(message)) {
    return '未检测到所选钱包，请先安装或打开钱包后重试'
  }
  if (/walletconnect|pairing|session settlement/i.test(message)) {
    return 'WalletConnect 会话建立失败，请确认移动钱包和网络后重试'
  }
  return '连接钱包失败，请重试'
}
