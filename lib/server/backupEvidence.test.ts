import { describe, expect, it } from 'vitest'
import {
  BACKUP_RPO_OBJECTIVE_SECONDS,
  BACKUP_RTO_OBJECTIVE_SECONDS,
  parseBackupRestoreEvidence,
} from './backupEvidence'

const validEvidence = {
  version: 1,
  sourceEnvironment: 'production',
  restoreEnvironment: 'staging',
  backupId: 'managed-pitr:2026-09-04T00.00.00Z',
  sourceReleaseId: 'f77e285',
  backupCreatedAt: '2026-09-04T00:00:00.000Z',
  recoveryTargetAt: '2026-09-04T00:10:00.000Z',
  restoreStartedAt: '2026-09-04T00:10:00.000Z',
  restoreCompletedAt: '2026-09-04T00:40:00.000Z',
  destroyedAt: '2026-09-04T01:00:00.000Z',
  encrypted: true,
  isolatedRestore: true,
  migrationChecksumsVerified: true,
  aggregateCountsVerified: true,
  foreignKeysVerified: true,
  readinessVerified: true,
  rpoSeconds: 10 * 60,
  rtoSeconds: 30 * 60,
} as const

describe('backup restore evidence', () => {
  it('accepts complete isolated restore evidence within the objectives', () => {
    expect(parseBackupRestoreEvidence(validEvidence)).toEqual(validEvidence)
  })

  it('rejects incomplete verification instead of treating a backup as restored', () => {
    expect(() => parseBackupRestoreEvidence({
      ...validEvidence,
      readinessVerified: false,
    })).toThrow('readinessVerified must be true')
  })

  it('rejects production restores and out-of-order evidence', () => {
    expect(() => parseBackupRestoreEvidence({
      ...validEvidence,
      restoreEnvironment: 'production',
    })).toThrow('isolated staging')
    expect(() => parseBackupRestoreEvidence({
      ...validEvidence,
      restoreCompletedAt: '2026-09-04T00:05:00.000Z',
    })).toThrow('chronological')
  })

  it('rejects objectives that were missed and unrecognized fields', () => {
    expect(() => parseBackupRestoreEvidence({
      ...validEvidence,
      recoveryTargetAt: '2026-09-04T00:15:01.000Z',
      restoreStartedAt: '2026-09-04T00:16:00.000Z',
      restoreCompletedAt: '2026-09-04T00:46:00.000Z',
      rpoSeconds: BACKUP_RPO_OBJECTIVE_SECONDS + 1,
    })).toThrow('rpoSeconds exceeds')
    expect(() => parseBackupRestoreEvidence({
      ...validEvidence,
      notes: 'could accidentally contain user data',
    })).toThrow('unsupported fields')
  })

  it('does not accept self-reported recovery times that contradict timestamps', () => {
    expect(() => parseBackupRestoreEvidence({
      ...validEvidence,
      rtoSeconds: BACKUP_RTO_OBJECTIVE_SECONDS,
    })).toThrow('must match the evidence timestamps')
  })
})
