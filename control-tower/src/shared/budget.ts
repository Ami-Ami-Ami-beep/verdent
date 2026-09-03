import type { ClockSegment } from './types/run'

/**
 * "You have 10 hours" means ten hours of *work*, not ten hours on the wall
 * clock. Only time spent actually running counts: pauses, and time queued
 * behind another project or a busy provider, are never billed.
 */
export function elapsedMs(segments: ClockSegment[], now = Date.now()): number {
  let total = 0
  for (const seg of segments) {
    const start = Date.parse(seg.start)
    if (Number.isNaN(start)) continue
    const end = seg.end ? Date.parse(seg.end) : now
    if (Number.isNaN(end) || end <= start) continue
    total += end - start
  }
  return total
}

export function remainingMs(budgetMs: number, segments: ClockSegment[], now = Date.now()): number {
  return Math.max(0, budgetMs - elapsedMs(segments, now))
}

export function startSegment(segments: ClockSegment[], now = new Date()): ClockSegment[] {
  if (segments.some((s) => !s.end)) return segments // already running
  return [...segments, { start: now.toISOString() }]
}

export function closeSegment(segments: ClockSegment[], now = new Date()): ClockSegment[] {
  return segments.map((s) => (s.end ? s : { ...s, end: now.toISOString() }))
}

/** "7h 27m" — for STATE.json and the prompt, where a raw ms count is useless. */
export function humanDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return `${total}s`
}
