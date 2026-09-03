import type { FailureClass, FailureDetectionSpec } from './types/provider'

/**
 * Deciding "this provider is out of quota" is the highest-risk judgement in the
 * whole app, because an agent that is *building* a rate-limited API will
 * legitimately print the words "rate limit", "quota" and "429". Misreading that
 * as exhaustion would park a perfectly healthy provider for hours.
 *
 * Four layers guard against it:
 *   1. Callers pass only the *error channel* here (structured error events, or
 *      the tail of stderr) — never assistant prose. See exec/streamParse.ts.
 *   2. A pattern hit alone is not enough; it needs a corroborating failure
 *      signal (non-zero exit, or a structured is_error).
 *   3. A run that lasted longer than `quotaMaxRuntimeMs` *and* used tools is
 *      downgraded to a task failure. Quota rejections come back in seconds.
 *   4. Every decision is returned with the pattern that matched, so a wrong
 *      call leaves evidence in the log.
 */

/** Only ever look at the tail; a huge blob is both slow and noisy to match. */
const MAX_ERROR_CHANNEL_BYTES = 8 * 1024

export interface ClassifyInput {
  exitCode: number | null
  signal: NodeJS.Signals | string | null
  /** Structured error events, or the stderr tail. NEVER assistant prose. */
  errorChannelText: string
  ranForMs: number
  hadToolActivity: boolean
  /** Set when a provider reports failure structurally (e.g. stream-json is_error). */
  structuredError?: boolean
  timedOut?: boolean
  killedByUser?: boolean
  spec: FailureDetectionSpec
}

export interface ClassifyResult {
  cls: FailureClass
  /** The regex source that decided it, for the log. */
  matched?: string
  /** Short excerpt around the match, for the log. */
  excerpt?: string
  /** Parsed provider-reported reset time, when one was found. */
  resetAt?: Date
  /** Set when a quota verdict was downgraded by the fail-fast heuristic. */
  downgradedFrom?: FailureClass
}

function compile(patterns: string[]): RegExp[] {
  const out: RegExp[] = []
  for (const p of patterns) {
    try {
      out.push(new RegExp(p, 'i'))
    } catch {
      // A user-edited pattern must never crash a run; skip and carry on.
    }
  }
  return out
}

function firstMatch(text: string, patterns: string[]): { re: RegExp; m: RegExpMatchArray } | null {
  for (const re of compile(patterns)) {
    const m = text.match(re)
    if (m) return { re, m }
  }
  return null
}

function excerptAround(text: string, m: RegExpMatchArray): string {
  const at = m.index ?? 0
  const start = Math.max(0, at - 80)
  return text.slice(start, at + (m[0]?.length ?? 0) + 80).trim()
}

/**
 * Turn a provider-reported reset time into a Date.
 * Handles absolute timestamps ("Resets at 2026-09-03T18:00:00Z") and the
 * relative phrasing CLIs often use ("try again in 42 minutes").
 */
export function parseResetTime(raw: string, now = new Date()): Date | undefined {
  const text = raw.trim()
  if (!text) return undefined

  const absolute = Date.parse(text)
  if (!Number.isNaN(absolute)) return new Date(absolute)

  const relative = text.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|[smhd])\b/i)
  if (relative) {
    const value = Number(relative[1])
    const unit = (relative[2] ?? '').toLowerCase()
    const ms =
      unit.startsWith('s') ? value * 1000
      : unit.startsWith('h') ? value * 3_600_000
      : unit.startsWith('d') ? value * 86_400_000
      : value * 60_000 // minute / min / m
    return new Date(now.getTime() + ms)
  }

  // Bare clock time such as "resets at 15:40".
  const clock = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (clock) {
    const d = new Date(now)
    d.setHours(Number(clock[1]), Number(clock[2]), Number(clock[3] ?? 0), 0)
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
    return d
  }
  return undefined
}

function findResetTime(text: string, patterns: string[], now: Date): Date | undefined {
  for (const re of compile(patterns)) {
    const m = text.match(re)
    if (m && m[1]) {
      const parsed = parseResetTime(m[1], now)
      if (parsed) return parsed
    }
  }
  return undefined
}

export function classify(input: ClassifyInput, now = new Date()): ClassifyResult {
  const { spec } = input

  if (input.killedByUser) return { cls: 'killed' }
  if (input.timedOut) return { cls: 'timeout' }

  const text = input.errorChannelText.slice(-MAX_ERROR_CHANNEL_BYTES)
  const failureSignal = input.exitCode !== 0 || input.structuredError === true

  // An auth failure is permanent until a human fixes it. Checking it before
  // quota matters: retrying a logged-out CLI just burns iterations.
  const auth = firstMatch(text, spec.authPatterns)
  if (auth && failureSignal) {
    return { cls: 'auth_error', matched: auth.re.source, excerpt: excerptAround(text, auth.m) }
  }

  const byExitCode = input.exitCode !== null && spec.quotaExitCodes.includes(input.exitCode)
  const byPattern = firstMatch(text, spec.quotaPatterns)

  if (byExitCode || (byPattern && failureSignal)) {
    const resetAt = findResetTime(text, spec.resetTimePatterns, now)
    const base: ClassifyResult = {
      cls: 'quota_exhausted',
      ...(byPattern ? { matched: byPattern.re.source, excerpt: excerptAround(text, byPattern.m) } : {}),
      ...(resetAt ? { resetAt } : {})
    }

    // Fail-fast heuristic. Only applied to pattern-based verdicts: a dedicated
    // quota exit code is hard evidence and is trusted regardless of runtime.
    if (!byExitCode && input.ranForMs > spec.quotaMaxRuntimeMs && input.hadToolActivity) {
      return { ...base, cls: 'task_failure', downgradedFrom: 'quota_exhausted' }
    }
    return base
  }

  const transient = firstMatch(text, spec.transientPatterns)
  if (transient && failureSignal) {
    return { cls: 'transient', matched: transient.re.source, excerpt: excerptAround(text, transient.m) }
  }

  if (input.signal) return { cls: 'killed' }
  if (input.exitCode === 0 && !input.structuredError) return { cls: 'success' }
  return { cls: 'task_failure' }
}

/** Provider problems must never count toward a run's consecutive-failure limit. */
export function isProviderFault(cls: FailureClass): boolean {
  return cls === 'quota_exhausted' || cls === 'auth_error'
}
