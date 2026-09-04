export interface PublicServiceConfig {
  operatorName: string
  supportEmail: string | null
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function readPublicServiceConfig(
  env: Record<string, string | undefined> = process.env,
): PublicServiceConfig {
  const operatorName = env.NEXT_PUBLIC_OPERATOR_NAME?.trim() || 'Web3 Sentinel'
  if (operatorName.length > 100 || /[\u0000-\u001f\u007f]/u.test(operatorName)) {
    throw new Error('NEXT_PUBLIC_OPERATOR_NAME must be a bounded display name')
  }

  const supportEmail = env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null
  if (supportEmail && (supportEmail.length > 254 || !EMAIL.test(supportEmail))) {
    throw new Error('NEXT_PUBLIC_SUPPORT_EMAIL must be a valid email address')
  }
  return { operatorName, supportEmail }
}
