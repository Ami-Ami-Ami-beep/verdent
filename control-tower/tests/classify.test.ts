import { describe, expect, it } from 'vitest'
import { classify, isProviderFault, parseResetTime } from '@shared/classify'
import type { FailureDetectionSpec } from '@shared/types/provider'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const defaults = JSON.parse(
  readFileSync(resolve(__dirname, '../resources/providers.default.json'), 'utf8')
) as { providers: Array<{ id: string; detection: FailureDetectionSpec }> }

const spec = defaults.providers.find((p) => p.id === 'claude')!.detection

const base = {
  exitCode: 0 as number | null,
  signal: null,
  errorChannelText: '',
  ranForMs: 5_000,
  hadToolActivity: false,
  spec
}

describe('classify', () => {
  it('treats a clean exit as success', () => {
    expect(classify({ ...base }).cls).toBe('success')
  })

  it('detects quota exhaustion from the error channel', () => {
    const r = classify({
      ...base,
      exitCode: 1,
      errorChannelText: 'Error: usage limit reached. Resets at 2026-09-03T18:00:00Z'
    })
    expect(r.cls).toBe('quota_exhausted')
    expect(r.resetAt?.toISOString()).toBe('2026-09-03T18:00:00.000Z')
  })

  it('parses a relative reset time', () => {
    const now = new Date('2026-09-03T12:00:00Z')
    const r = classify(
      { ...base, exitCode: 1, errorChannelText: 'rate limited; try again in 30 minutes' },
      now
    )
    expect(r.cls).toBe('quota_exhausted')
    expect(r.resetAt?.toISOString()).toBe('2026-09-03T12:30:00.000Z')
  })

  // The regression test the whole design exists for: an agent that BUILDS a
  // rate-limited API prints these words while working perfectly.
  it('does not call it quota when the words appear in successful output', () => {
    const r = classify({
      ...base,
      exitCode: 0,
      errorChannelText: '',
      ranForMs: 240_000,
      hadToolActivity: true
    })
    expect(r.cls).toBe('success')
  })

  it('requires a failure signal alongside a pattern hit', () => {
    const r = classify({
      ...base,
      exitCode: 0,
      errorChannelText: 'Implemented rate limit handling; 429 responses now retry.'
    })
    expect(r.cls).toBe('success')
  })

  it('downgrades a long tool-using run to a task failure', () => {
    const r = classify({
      ...base,
      exitCode: 1,
      errorChannelText: 'quota exceeded somewhere deep in the build output',
      ranForMs: 8 * 60_000,
      hadToolActivity: true
    })
    expect(r.cls).toBe('task_failure')
    expect(r.downgradedFrom).toBe('quota_exhausted')
  })

  it('trusts an explicit quota exit code even on a long run', () => {
    const r = classify({
      ...base,
      exitCode: 77,
      errorChannelText: '',
      ranForMs: 8 * 60_000,
      hadToolActivity: true,
      spec: { ...spec, quotaExitCodes: [77] }
    })
    expect(r.cls).toBe('quota_exhausted')
  })

  it('classifies auth errors before quota, and never retries them', () => {
    const r = classify({
      ...base,
      exitCode: 1,
      errorChannelText: 'Invalid API key. Also: rate limit info follows.'
    })
    expect(r.cls).toBe('auth_error')
    expect(isProviderFault(r.cls)).toBe(true)
  })

  it('recognises transient overload', () => {
    const r = classify({ ...base, exitCode: 1, errorChannelText: 'API Error 503: overloaded' })
    expect(r.cls).toBe('transient')
  })

  it('reports timeout and user kill without looking at output', () => {
    expect(classify({ ...base, timedOut: true }).cls).toBe('timeout')
    expect(classify({ ...base, killedByUser: true }).cls).toBe('killed')
  })

  it('falls back to task_failure on an unexplained non-zero exit', () => {
    const r = classify({ ...base, exitCode: 2, errorChannelText: 'tsc: 4 type errors' })
    expect(r.cls).toBe('task_failure')
  })

  it('honours a structured error even when the exit code is 0', () => {
    const r = classify({
      ...base,
      exitCode: 0,
      structuredError: true,
      errorChannelText: 'usage limit reached'
    })
    expect(r.cls).toBe('quota_exhausted')
  })

  it('survives a malformed user-supplied pattern', () => {
    const r = classify({
      ...base,
      exitCode: 1,
      errorChannelText: 'usage limit reached',
      spec: { ...spec, quotaPatterns: ['([unclosed', ...spec.quotaPatterns] }
    })
    expect(r.cls).toBe('quota_exhausted')
  })

  it('only counts provider faults as provider faults', () => {
    expect(isProviderFault('task_failure')).toBe(false)
    expect(isProviderFault('timeout')).toBe(false)
    expect(isProviderFault('quota_exhausted')).toBe(true)
  })
})

describe('parseResetTime', () => {
  const now = new Date('2026-09-03T12:00:00Z')
  it('parses absolute, relative and bare clock times', () => {
    expect(parseResetTime('2026-09-03T18:00:00Z', now)?.toISOString()).toBe('2026-09-03T18:00:00.000Z')
    expect(parseResetTime('2 hours', now)?.toISOString()).toBe('2026-09-03T14:00:00.000Z')
    expect(parseResetTime('45 min', now)?.toISOString()).toBe('2026-09-03T12:45:00.000Z')
    expect(parseResetTime('nonsense', now)).toBeUndefined()
  })
})
