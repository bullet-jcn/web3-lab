import { readFile } from 'node:fs/promises'
import { parseBackupRestoreEvidence } from '../lib/server/backupEvidence.ts'

try {
  const evidencePath = process.argv[2]
  if (!evidencePath || process.argv.length !== 3) {
    throw new Error('Usage: npm run backup:evidence:verify -- <evidence.json>')
  }

  const evidence = parseBackupRestoreEvidence(JSON.parse(await readFile(evidencePath, 'utf8')))
  console.info(JSON.stringify({
    status: 'verified',
    sourceEnvironment: evidence.sourceEnvironment,
    restoreEnvironment: evidence.restoreEnvironment,
    sourceReleaseId: evidence.sourceReleaseId,
    rpoSeconds: evidence.rpoSeconds,
    rtoSeconds: evidence.rtoSeconds,
  }))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Backup evidence verification failed')
  process.exitCode = 1
}
