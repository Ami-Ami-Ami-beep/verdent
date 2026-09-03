import React from 'react'
import type { ProviderView } from '@shared/types/ipc'
import type { Run } from '@shared/types/run'

export function humanDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${total}s`
}

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

export function ProviderChip({ view }: { view: ProviderView }): JSX.Element {
  const { spec, state } = view
  const detail =
    state.status === 'cooling' && state.cooldownUntil
      ? ` · back ${new Date(state.cooldownUntil).toLocaleTimeString()}`
      : state.status === 'disabled'
        ? ' · needs login'
        : ''
  return (
    <span className="chip" title={state.lastFailure?.excerpt ?? spec.label}>
      <i className={`dot ${state.status}`} />
      {spec.label}
      {!spec.verified && <span className="muted"> · unverified</span>}
      <span className="muted">{detail}</span>
    </span>
  )
}
