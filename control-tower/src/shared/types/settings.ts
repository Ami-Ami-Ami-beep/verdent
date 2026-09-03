import type { PermissionMode } from './provider'

export interface Settings {
  schema: number
  /** Every project workdir must live under this directory. */
  projectsRoot: string
  /** Ordered provider chain. Index 0 is preferred. */
  providerChain: string[]
  maxParallelProjects: number
  /** What to do when a provider's concurrency lease is taken. */
  providerContention: 'failover' | 'wait'
  leaseWaitMs: number
  iterationTimeoutMs: number
  /** Refuse to start an iteration with less budget left than this. */
  minIterationMs: number
  maxConsecutiveFailures: number
  /** Force a cold (non-resumed) iteration every N iterations. */
  coldRestartEvery: number
  /** Run a 'review' iteration every N iterations. */
  reviewEvery: number
  defaultPermissionMode: PermissionMode
}

export const DEFAULT_SETTINGS: Omit<Settings, 'projectsRoot'> = {
  schema: 1,
  providerChain: ['claude', 'gemini', 'codex'],
  maxParallelProjects: 2,
  providerContention: 'failover',
  leaseWaitMs: 90_000,
  iterationTimeoutMs: 30 * 60_000,
  minIterationMs: 3 * 60_000,
  maxConsecutiveFailures: 3,
  coldRestartEvery: 10,
  reviewEvery: 5,
  defaultPermissionMode: 'allowlist'
}
