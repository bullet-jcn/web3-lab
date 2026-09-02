export type BackendStorageMode = 'legacy-cookie' | 'postgres'

export function readBackendStorageMode(
  env: Record<string, string | undefined> = process.env,
): BackendStorageMode {
  const configured = env.BACKEND_STORAGE_MODE
  if (configured === 'legacy-cookie' || configured === 'postgres') return configured

  if (configured !== undefined) {
    throw new Error('BACKEND_STORAGE_MODE must be legacy-cookie or postgres')
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('BACKEND_STORAGE_MODE is required in production')
  }

  return 'legacy-cookie'
}
