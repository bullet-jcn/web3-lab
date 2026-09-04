export const BACKUP_RPO_OBJECTIVE_SECONDS = 15 * 60
export const BACKUP_RTO_OBJECTIVE_SECONDS = 4 * 60 * 60

export interface BackupRestoreEvidence {
  version: 1
  sourceEnvironment: 'staging' | 'production'
  restoreEnvironment: 'staging'
  backupId: string
  sourceReleaseId: string
  backupCreatedAt: string
  recoveryTargetAt: string
  restoreStartedAt: string
  restoreCompletedAt: string
  destroyedAt: string
  encrypted: true
  isolatedRestore: true
  migrationChecksumsVerified: true
  aggregateCountsVerified: true
  foreignKeysVerified: true
  readinessVerified: true
  rpoSeconds: number
  rtoSeconds: number
}

const EVIDENCE_KEYS = [
  'aggregateCountsVerified',
  'backupCreatedAt',
  'backupId',
  'destroyedAt',
  'encrypted',
  'foreignKeysVerified',
  'isolatedRestore',
  'migrationChecksumsVerified',
  'readinessVerified',
  'recoveryTargetAt',
  'restoreCompletedAt',
  'restoreEnvironment',
  'restoreStartedAt',
  'rpoSeconds',
  'rtoSeconds',
  'sourceEnvironment',
  'sourceReleaseId',
  'version',
] as const

const RELEASE_ID = /^[0-9a-f]{7,64}$/
const BACKUP_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Backup evidence must be a JSON object')
  }
  return value as Record<string, unknown>
}

function requireExactKeys(record: Record<string, unknown>): void {
  const actual = Object.keys(record).sort()
  const expected = [...EVIDENCE_KEYS].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error('Backup evidence has missing or unsupported fields')
  }
}

function requireIsoTimestamp(name: string, value: unknown): string {
  if (typeof value !== 'string') throw new Error(`${name} must be an ISO timestamp`)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`${name} must be a canonical UTC ISO timestamp`)
  }
  return value
}

function requireVerified(record: Record<string, unknown>, name: string): true {
  if (record[name] !== true) throw new Error(`${name} must be true`)
  return true
}

function requireBoundedSeconds(name: string, value: unknown, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new Error(`${name} exceeds the documented objective`)
  }
  return value as number
}

export function parseBackupRestoreEvidence(value: unknown): BackupRestoreEvidence {
  const record = requireRecord(value)
  requireExactKeys(record)

  if (record.version !== 1) throw new Error('Unsupported backup evidence version')
  if (record.sourceEnvironment !== 'staging' && record.sourceEnvironment !== 'production') {
    throw new Error('sourceEnvironment must be staging or production')
  }
  if (record.restoreEnvironment !== 'staging') {
    throw new Error('Restore drills must use an isolated staging environment')
  }
  if (typeof record.backupId !== 'string' || !BACKUP_ID.test(record.backupId)) {
    throw new Error('backupId must be a bounded opaque identifier')
  }
  if (typeof record.sourceReleaseId !== 'string' || !RELEASE_ID.test(record.sourceReleaseId)) {
    throw new Error('sourceReleaseId must be an immutable Git commit SHA')
  }

  const backupCreatedAt = requireIsoTimestamp('backupCreatedAt', record.backupCreatedAt)
  const recoveryTargetAt = requireIsoTimestamp('recoveryTargetAt', record.recoveryTargetAt)
  const restoreStartedAt = requireIsoTimestamp('restoreStartedAt', record.restoreStartedAt)
  const restoreCompletedAt = requireIsoTimestamp('restoreCompletedAt', record.restoreCompletedAt)
  const destroyedAt = requireIsoTimestamp('destroyedAt', record.destroyedAt)
  const times = [
    backupCreatedAt,
    recoveryTargetAt,
    restoreStartedAt,
    restoreCompletedAt,
    destroyedAt,
  ]
    .map((timestamp) => new Date(timestamp).getTime())
  if (times.some((time, index) => index > 0 && time < times[index - 1])) {
    throw new Error('Backup evidence timestamps must be chronological')
  }

  const measuredRpoSeconds = Math.ceil((times[1] - times[0]) / 1_000)
  const measuredRtoSeconds = Math.ceil((times[3] - times[2]) / 1_000)
  if (record.rpoSeconds !== measuredRpoSeconds || record.rtoSeconds !== measuredRtoSeconds) {
    throw new Error('RPO and RTO values must match the evidence timestamps')
  }

  return {
    version: 1,
    sourceEnvironment: record.sourceEnvironment,
    restoreEnvironment: 'staging',
    backupId: record.backupId,
    sourceReleaseId: record.sourceReleaseId,
    backupCreatedAt,
    recoveryTargetAt,
    restoreStartedAt,
    restoreCompletedAt,
    destroyedAt,
    encrypted: requireVerified(record, 'encrypted'),
    isolatedRestore: requireVerified(record, 'isolatedRestore'),
    migrationChecksumsVerified: requireVerified(record, 'migrationChecksumsVerified'),
    aggregateCountsVerified: requireVerified(record, 'aggregateCountsVerified'),
    foreignKeysVerified: requireVerified(record, 'foreignKeysVerified'),
    readinessVerified: requireVerified(record, 'readinessVerified'),
    rpoSeconds: requireBoundedSeconds(
      'rpoSeconds',
      record.rpoSeconds,
      BACKUP_RPO_OBJECTIVE_SECONDS,
    ),
    rtoSeconds: requireBoundedSeconds(
      'rtoSeconds',
      record.rtoSeconds,
      BACKUP_RTO_OBJECTIVE_SECONDS,
    ),
  }
}
