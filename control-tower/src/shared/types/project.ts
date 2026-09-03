import type { PermissionMode } from './provider'

export interface Project {
  id: string
  name: string
  /** Absolute. Must resolve under settings.projectsRoot — see safety/guards.ts. */
  workdir: string
  /** The user's detailed description of the app they want built. */
  brief: string
  /** Total work time granted, in ms. 10h -> 36_000_000. */
  budgetMs: number
  providerChainOverride?: string[]
  permissionMode: PermissionMode
  /** Deliberate consent to autonomous mode. No run starts without it. */
  autonomousOptIn: boolean
  createdAt: string
  currentRunId?: string
}

export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked'

export interface TaskLine {
  id: string
  status: TaskStatus
  checked: boolean
  title: string
  /** Index in the original TASKS.md, so the app can render in file order. */
  lineNo: number
}

export interface TaskSummary {
  tasks: TaskLine[]
  total: number
  done: number
  blocked: number
  open: number
  /** Lines the parser did not understand. Preserved verbatim, never rewritten. */
  unparsed: number
}
