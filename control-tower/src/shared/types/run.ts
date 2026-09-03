import type { FailureClass } from './provider'

export type RunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'stopped_by_user'
  | 'completed'
  | 'budget_exhausted'
  | 'failed'

export type StopReason =
  | 'all_tasks_done'
  | 'budget_exhausted'
  | 'user_stop'
  | 'max_consecutive_failures'
  | 'no_provider_available'
  | 'app_shutdown'

export type IterationKind = 'plan' | 'continue' | 'review'

/** Open-ended segment (no `end`) means the clock is currently running. */
export interface ClockSegment {
  start: string
  end?: string
}

export interface Run {
  id: string
  projectId: string
  status: RunStatus
  /** Budget is summed from these, so pauses and queue time are never billed. */
  clock: { segments: ClockSegment[] }
  budgetMs: number
  iterations: number
  consecutiveFailures: number
  lastProviderId?: string
  /** provider id -> native session id, enabling warm resume within a provider. */
  sessionIds: Record<string, string>
  startedAt: string
  endedAt?: string
  stopReason?: StopReason
}

export interface Iteration {
  runId: string
  index: number
  kind: IterationKind
  providerId: string
  /** False when the provider changed or a cold restart was forced. */
  warmResume: boolean
  startedAt: string
  endedAt?: string
  exitCode?: number | null
  outcome: FailureClass
  commitSha?: string
  tasksDoneDelta: number
}
