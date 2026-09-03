import type { LogEvent } from './log'
import type { Project, TaskSummary } from './project'
import type { ProviderRuntimeState, ProviderSpec } from './provider'
import type { Iteration, Run } from './run'
import type { Settings } from './settings'

export interface ProviderView {
  spec: ProviderSpec
  state: ProviderRuntimeState
}

export interface ProjectView {
  project: Project
  run?: Run
  tasks?: TaskSummary
  iterations: Iteration[]
  lastCommit?: { sha: string; subject: string; at: string }
}

export interface NewProjectInput {
  name: string
  parentDir: string
  brief: string
  budgetMs: number
  permissionMode: Settings['defaultPermissionMode']
  providerChainOverride?: string[]
  autonomousOptIn: boolean
}

export interface VerifyReport {
  ok: boolean
  resolvedPath?: string
  version?: string
  helpText?: string
  dryRunOutput?: string
  error?: string
}

/** The complete surface the renderer is allowed to reach. Nothing else crosses. */
export interface TowerApi {
  listProjects(): Promise<ProjectView[]>
  createProject(input: NewProjectInput): Promise<ProjectView>
  deleteProject(projectId: string): Promise<void>
  startProject(projectId: string): Promise<Run>
  pauseProject(projectId: string): Promise<void>
  stopProject(projectId: string): Promise<void>
  stopAll(): Promise<void>
  projectDetail(projectId: string): Promise<ProjectView & { plan: string; journal: string }>
  recentLogs(runId: string): Promise<LogEvent[]>

  listProviders(): Promise<ProviderView[]>
  saveProvider(spec: ProviderSpec): Promise<ProviderView[]>
  verifyProvider(providerId: string): Promise<VerifyReport>
  /** Settings' "what would this error be classified as?" box. */
  testClassifier(providerId: string, sample: string): Promise<{ cls: string; matched?: string }>

  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<Settings>
  chooseDirectory(): Promise<string | undefined>
  slots(): Promise<{ used: number; total: number }>
  openWorkdir(projectId: string): Promise<void>

  onLogs(cb: (batch: LogEvent[]) => void): () => void
  onRun(cb: (run: Run) => void): () => void
  onIteration(cb: (iteration: Iteration) => void): () => void
  onProviders(cb: (providers: ProviderView[]) => void): () => void
}

export const IPC = {
  listProjects: 'projects:list',
  createProject: 'projects:create',
  deleteProject: 'projects:delete',
  startProject: 'projects:start',
  pauseProject: 'projects:pause',
  stopProject: 'projects:stop',
  stopAll: 'projects:stopAll',
  projectDetail: 'projects:detail',
  recentLogs: 'logs:recent',
  listProviders: 'providers:list',
  saveProvider: 'providers:save',
  verifyProvider: 'providers:verify',
  testClassifier: 'providers:testClassifier',
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  chooseDirectory: 'dialog:chooseDirectory',
  slots: 'scheduler:slots',
  openWorkdir: 'shell:openWorkdir',
  evLogs: 'ev:logs',
  evRun: 'ev:run',
  evIteration: 'ev:iteration',
  evProviders: 'ev:providers'
} as const
