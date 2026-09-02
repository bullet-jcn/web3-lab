import alertRules from '@/ops/alerts/rules.json'
import { describe, expect, it } from 'vitest'

describe('operational alert rules', () => {
  it('keeps unique, bounded, actionable rules under a versioned schema', () => {
    expect(alertRules.schemaVersion).toBe(1)
    expect(alertRules.rules.length).toBeGreaterThanOrEqual(6)
    expect(new Set(alertRules.rules.map((rule) => rule.id)).size).toBe(alertRules.rules.length)

    for (const rule of alertRules.rules) {
      expect(rule.id).toMatch(/^[a-z0-9-]+$/)
      expect(['warning', 'critical']).toContain(rule.severity)
      expect(rule.windowSeconds).toBeGreaterThan(0)
      expect(rule.windowSeconds).toBeLessThanOrEqual(3_600)
      expect(rule.minimumEvents).toBeGreaterThan(0)
      expect(rule.condition.length).toBeGreaterThan(0)
      expect(rule.runbook).toMatch(/^docs\/OBSERVABILITY\.md#[a-z0-9-]+$/)
      expect(rule.runbook.endsWith(`#${rule.id}`)).toBe(true)
    }
  })

  it('covers availability, missing telemetry, errors, latency, and degraded dependencies', () => {
    const ids = new Set(alertRules.rules.map((rule) => rule.id))
    expect(ids).toEqual(new Set([
      'service-readiness-unhealthy',
      'telemetry-heartbeat-missing',
      'rpc-critical-chain-unhealthy',
      'rpc-provider-degraded',
      'http-server-error-rate',
      'http-p95-latency',
      'risk-explanation-degraded',
    ]))
  })
})
