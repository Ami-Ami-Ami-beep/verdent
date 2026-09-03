import React, { useEffect, useState } from 'react'
import type { ProjectView } from '@shared/types/ipc'
import type { Iteration } from '@shared/types/run'
import { BudgetGauge, StatusPill } from '../components/bits'
import { LogView } from '../components/LogView'
import { useRunLog } from '../store/useTower'

type Detail = ProjectView & { plan: string; journal: string }

export function ProjectDetail({
  projectId,
  onBack,
  onAction
}: {
  projectId: string
  onBack: () => void
  onAction: (action: 'start' | 'pause' | 'stop', projectId: string) => void
}): JSX.Element {
  const [detail, setDetail] = useState<Detail | null>(null)
  const lines = useRunLog(detail?.run?.id)

  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      const next = (await window.tower.projectDetail(projectId)) as Detail
      if (alive) setDetail(next)
    }
    void load()
    const timer = setInterval(() => void load(), 3_000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [projectId])

  if (!detail) return <div className="muted">Loading…</div>

  const { project, run, tasks, iterations } = detail
  const active = run?.status === 'running' || run?.status === 'queued'

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="ghost" onClick={onBack}>
          ← All projects
        </button>
        <h2 style={{ margin: 0, fontSize: 15 }}>{project.name}</h2>
        <StatusPill run={run} />
        <span className="spacer" />
        <button onClick={() => onAction('start', project.id)} disabled={active}>
          Start
        </button>
        <button onClick={() => onAction('pause', project.id)} disabled={run?.status !== 'running'}>
          Pause
        </button>
        <button className="danger" onClick={() => onAction('stop', project.id)} disabled={!active}>
          Stop
        </button>
        <button className="ghost" onClick={() => void window.tower.openWorkdir(project.id)}>
          Open folder
        </button>
      </div>

      {run?.stopReason && run.stopReason !== 'all_tasks_done' && (
        <div className={`banner ${run.stopReason === 'budget_exhausted' ? '' : 'bad'}`}>
          Run ended: {run.stopReason.replace(/_/g, ' ')}
        </div>
      )}

      <div className="detail">
        <div>
          <div className="card">
            <h2>Budget</h2>
            <BudgetGauge run={run} budgetMs={project.budgetMs} />
          </div>

          <div className="card">
            <h2>Tasks {tasks ? `(${tasks.done}/${tasks.total})` : ''}</h2>
            {tasks && tasks.total > 0 ? (
              <ul className="tasklist">
                {tasks.tasks.map((t) => (
                  <li key={t.id} className={t.status}>
                    <span className="mono muted small">{t.id}</span>
                    <span>{t.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">
                No task list yet — the planning iteration writes <span className="mono">.tower/TASKS.md</span>.
              </p>
            )}
            {tasks && tasks.unparsed > 0 && (
              <p className="small muted">
                {tasks.unparsed} checkbox line(s) did not match the required format and are ignored.
              </p>
            )}
          </div>
        </div>

        <div>
          <LogView lines={lines} />
        </div>

        <div>
          <div className="card">
            <h2>Iterations</h2>
            {iterations.length === 0 ? (
              <p className="muted small">Nothing has run yet.</p>
            ) : (
              <ul className="timeline">
                {iterations
                  .slice()
                  .reverse()
                  .map((it) => (
                    <IterationRow key={it.index} iteration={it} previous={iterations[it.index - 2]} />
                  ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2>Plan</h2>
            <pre className="help">{detail.plan.trim() || 'Not written yet.'}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

function IterationRow({ iteration, previous }: { iteration: Iteration; previous?: Iteration }): JSX.Element {
  const switched = previous && previous.providerId !== iteration.providerId
  const duration =
    iteration.endedAt ? Math.round((Date.parse(iteration.endedAt) - Date.parse(iteration.startedAt)) / 1000) : 0
  return (
    <li>
      <div className="row">
        <strong>#{iteration.index}</strong>
        <span className="chip">{iteration.providerId}</span>
        <span className="muted small">{iteration.kind}</span>
        <span className="spacer" />
        <span className={iteration.outcome === 'success' ? 'muted' : 'pill failed'}>{iteration.outcome}</span>
      </div>
      <div className="small muted">
        {duration}s
        {iteration.commitSha ? ` · ${iteration.commitSha.slice(0, 7)}` : ' · no commit'}
        {iteration.warmResume ? ' · resumed' : ''}
        {iteration.tasksDoneDelta > 0 ? ` · +${iteration.tasksDoneDelta} task` : ''}
      </div>
      {switched && (
        <div className="small switch">
          provider switch: {previous?.providerId} → {iteration.providerId}
        </div>
      )}
    </li>
  )
}
