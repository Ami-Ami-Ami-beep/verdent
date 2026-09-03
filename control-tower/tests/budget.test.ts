import { describe, expect, it } from 'vitest'
import { closeSegment, elapsedMs, humanDuration, remainingMs, startSegment } from '@shared/budget'

describe('budget clock', () => {
  const t0 = '2026-09-03T12:00:00.000Z'
  const t1 = '2026-09-03T12:30:00.000Z'
  const t2 = '2026-09-03T13:00:00.000Z'

  it('sums only closed and running segments', () => {
    expect(elapsedMs([{ start: t0, end: t1 }])).toBe(30 * 60_000)
  })

  it('does not bill the gap between segments — pauses are free', () => {
    const segments = [
      { start: t0, end: t1 },
      { start: t2, end: '2026-09-03T13:15:00.000Z' }
    ]
    expect(elapsedMs(segments)).toBe(45 * 60_000)
  })

  it('counts an open segment up to now', () => {
    const now = Date.parse(t1)
    expect(elapsedMs([{ start: t0 }], now)).toBe(30 * 60_000)
  })

  it('computes remaining budget and never goes negative', () => {
    expect(remainingMs(60 * 60_000, [{ start: t0, end: t1 }])).toBe(30 * 60_000)
    expect(remainingMs(10 * 60_000, [{ start: t0, end: t1 }])).toBe(0)
  })

  it('start is idempotent while already running', () => {
    const open = [{ start: t0 }]
    expect(startSegment(open)).toBe(open)
  })

  it('closing then starting produces a new segment', () => {
    const closed = closeSegment([{ start: t0 }], new Date(t1))
    expect(closed[0]?.end).toBe(t1)
    expect(startSegment(closed, new Date(t2))).toHaveLength(2)
  })

  it('ignores malformed timestamps rather than producing NaN', () => {
    expect(elapsedMs([{ start: 'not-a-date', end: t1 }])).toBe(0)
  })

  it('formats durations for humans', () => {
    expect(humanDuration(7 * 3_600_000 + 27 * 60_000)).toBe('7h 27m')
    expect(humanDuration(90_000)).toBe('1m')
  })
})
