import React from 'react'
import type { ProviderView } from '@shared/types/ipc'
import type { Run } from '@shared/types/run'
import { humanDuration } from '@shared/budget'

export { humanDuration }

export function elapsedOf(run: Run | undefined): number {
  if (!run) return 0
  const now = Date.now()
  return run.clock.segments.reduce((total, seg) => {
    const start = Date.parse(seg.start)
    if (Number.isNaN(start)) return total
    const end = seg.end ? Date.parse(seg.end) : now
    return end > start ? total + (end - start) : total
  }, 0)
}

export function StatusPill({ run }: { run?: Run }): JSX.Element {
  const status = run?.status ?? 'idle'
  return <span className={`pill ${status}`}>{status.replace(/_/g, ' ')}</span>
}

export function BudgetGauge({ run, budgetMs }: { run?: Run; budgetMs: number }): JSX.Element {
  const used = elapsedOf(run)
  const pct = Math.min(100, (used / Math.max(1, budgetMs)) * 100)
  return (
    <div>
      <div className={`gauge ${pct > 85 ? 'warn' : ''}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="small muted" style={{ marginTop: 3 }}>
        {humanDuration(used)} of {humanDuration(budgetMs)} · {humanDuration(Math.max(0, budgetMs - used))} left
      </div>
    </div>
  )
}

/**
 * One place decides how a provider's readiness is shown, because "can this run?"
 * is not the same question as "is it cooling?" — a provider that is switched off
 * or was never verified cannot take work either, and must never wear the green
 * dot that says it can.
 */
export function providerDisplay(view: ProviderView): { dot: string; text: string } {
  const { spec, state } = view

  if (!spec.enabled) return { dot: 'off', text: 'off' }
  if (!spec.verified) return { dot: 'off', text: 'not verified' }

  switch (state.status) {
    case 'cooling':
      return {
        dot: 'cooling',
        text: state.cooldownUntil
          ? `out of quota until ${new Date(state.cooldownUntil).toLocaleTimeString()}`
          : 'out of quota'
      }
    case 'disabled':
      return { dot: 'disabled', text: 'needs login' }
    case 'probation':
      return { dot: 'probation', text: 'retrying' }
    default:
      return { dot: 'available', text: 'ready' }
  }
}

export function ProviderChip({ view }: { view: ProviderView }): JSX.Element {
  const { dot, text } = providerDisplay(view)
  return (
    <span className="chip" title={view.state.lastFailure?.excerpt ?? view.spec.label}>
      <i className={`dot ${dot}`} />
      {view.spec.label}
      <span className="muted"> · {text}</span>
    </span>
  )
}
