import React from 'react'
import type { ProjectView } from '@shared/types/ipc'
import { BudgetGauge, StatusPill } from '../components/bits'

interface Props {
  projects: ProjectView[]
  loading: boolean
  onOpen: (projectId: string) => void
  onNew: () => void
  onAction: (action: 'start' | 'pause' | 'stop' | 'delete', projectId: string) => void
}

export function ProjectList({ projects, loading, onOpen, onNew, onAction }: Props): JSX.Element {
  if (loading) return <div className="muted">Loading…</div>

  if (projects.length === 0) {
    return (
      <div className="card">
        <h2>No projects yet</h2>
        <p className="muted">
          Create a project, describe the app you want in as much detail as you can, and give it a
          time budget. Control Tower will drive your AI CLIs through it and switch provider whenever
          one runs out of quota.
        </p>
        <button className="primary" onClick={onNew}>
          New project
        </button>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {projects.map(({ project, run, tasks, lastCommit }) => {
        const active = run?.status === 'running' || run?.status === 'queued'
        return (
          <div className="project-row" key={project.id}>
            <div>
              <div className="name" onClick={() => onOpen(project.id)}>
                {project.name}
              </div>
              <div className="small muted mono">{project.workdir}</div>
            </div>

            <StatusPill run={run} />

            <div className="small">
              {run?.lastProviderId ? (
                <span className="chip">{run.lastProviderId}</span>
              ) : (
                <span className="muted">—</span>
              )}
              <div className="muted" style={{ marginTop: 3 }}>
                iteration {run?.iterations ?? 0}
              </div>
            </div>

            <BudgetGauge run={run} budgetMs={project.budgetMs} />

            <div className="small">
              {tasks ? (
                <>
                  {tasks.done}/{tasks.total} done
                  {tasks.blocked > 0 && <div className="muted">{tasks.blocked} blocked</div>}
                </>
              ) : (
                <span className="muted">—</span>
              )}
              {lastCommit && <div className="muted mono small">{lastCommit.sha}</div>}
            </div>

            <div className="row">
              <button onClick={() => onAction('start', project.id)} disabled={active}>
                Start
              </button>
              <button onClick={() => onAction('pause', project.id)} disabled={run?.status !== 'running'}>
                Pause
              </button>
              <button onClick={() => onAction('stop', project.id)} disabled={!active}>
                Stop
              </button>
              <button className="ghost danger" onClick={() => onAction('delete', project.id)}>
                ✕
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
