import type { FailureClass, ProviderRuntimeState, ProviderSpec } from '@shared/types/provider'

/**
 * Tracks which providers are usable right now, and brings a recovered one back.
 *
 * Cooldowns are persisted by the caller because a subscription window is hours
 * long — forgetting it on restart would send every run straight back into the
 * provider that is still rate-limited.
 */

const DEFAULT_COOLDOWN_MS = 60 * 60_000
const MAX_COOLDOWN_MS = 6 * 60 * 60_000
/** A hard-limited provider must not be re-probed on every single iteration. */
const PROBE_INTERVAL_MS = 15 * 60_000

export function initialState(providerId: string): ProviderRuntimeState {
  return { providerId, status: 'available', consecutiveQuotaHits: 0, activeLeases: 0 }
}

export function backoffMs(consecutiveQuotaHits: number): number {
  const hits = Math.max(1, consecutiveQuotaHits)
  return Math.min(DEFAULT_COOLDOWN_MS * 2 ** (hits - 1), MAX_COOLDOWN_MS)
}

export function applyOutcome(
  state: ProviderRuntimeState,
  cls: FailureClass,
  detail: { resetAt?: Date; excerpt?: string },
  now = new Date()
): ProviderRuntimeState {
  const at = now.toISOString()

  if (cls === 'quota_exhausted') {
    const hits = state.consecutiveQuotaHits + 1
    // Trust a provider-reported reset time; fall back to exponential backoff.
    const until = detail.resetAt && detail.resetAt > now
      ? detail.resetAt
      : new Date(now.getTime() + backoffMs(hits))
    return {
      ...state,
      status: 'cooling',
      consecutiveQuotaHits: hits,
      cooldownUntil: until.toISOString(),
      lastFailure: { class: cls, at, excerpt: detail.excerpt ?? '' }
    }
  }

  if (cls === 'auth_error') {
    // Never auto-retried: an auth failure is permanent until a human fixes it,
    // and retrying it only burns iterations.
    return {
      ...state,
      status: 'disabled',
      lastFailure: { class: cls, at, excerpt: detail.excerpt ?? '' }
    }
  }

  if (cls === 'success') {
    const next = { ...state, status: 'available' as const, consecutiveQuotaHits: 0 }
    delete next.cooldownUntil
    return next
  }

  // A task failure says nothing about the provider's health.
  return state
}

export type Selection =
  | { kind: 'ready'; providerId: string; probation: boolean }
  | { kind: 'none'; reason: string }

/**
 * Walks the chain in priority order. A cooling provider whose window has
 * expired is promoted to `probation` and picked for exactly one iteration; if
 * it fails again it drops back with a doubled backoff, and if it succeeds it is
 * fully restored. That is what makes the app return to Claude on its own.
 */
export function selectProvider(
  chain: string[],
  specs: Map<string, ProviderSpec>,
  states: Map<string, ProviderRuntimeState>,
  opts: { hasFreeLease: (id: string) => boolean; now?: Date }
): Selection {
  const now = opts.now ?? new Date()
  const reasons: string[] = []

  for (const id of chain) {
    const spec = specs.get(id)
    if (!spec || !spec.enabled) {
      reasons.push(`${id}: disabled`)
      continue
    }
    const state = states.get(id) ?? initialState(id)

    if (state.status === 'disabled') {
      reasons.push(`${id}: needs re-authentication`)
      continue
    }

    if (state.status === 'cooling') {
      const until = state.cooldownUntil ? Date.parse(state.cooldownUntil) : 0
      if (Number.isFinite(until) && until > now.getTime()) {
        reasons.push(`${id}: cooling until ${state.cooldownUntil}`)
        continue
      }
      const lastProbe = state.lastProbeAt ? Date.parse(state.lastProbeAt) : 0
      if (now.getTime() - lastProbe < PROBE_INTERVAL_MS) {
        reasons.push(`${id}: probe rate-limited`)
        continue
      }
      if (!opts.hasFreeLease(id)) {
        reasons.push(`${id}: busy`)
        continue
      }
      return { kind: 'ready', providerId: id, probation: true }
    }

    if (!opts.hasFreeLease(id)) {
      reasons.push(`${id}: busy`)
      continue
    }
    return { kind: 'ready', providerId: id, probation: state.status === 'probation' }
  }

  return { kind: 'none', reason: reasons.join('; ') || 'no providers configured' }
}

export function markProbe(state: ProviderRuntimeState, now = new Date()): ProviderRuntimeState {
  return { ...state, status: 'probation', lastProbeAt: now.toISOString() }
}
