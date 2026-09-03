import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import type { LogEvent } from '@shared/types/log'
import type { Project } from '@shared/types/project'
import type { ProviderRuntimeState } from '@shared/types/provider'
import type { Iteration, Run } from '@shared/types/run'
import type { Settings } from '@shared/types/settings'
import { initialState } from '../providers/health'
import { LeasePool } from '../providers/lease'
import type { ProviderRegistry } from '../providers/registry'
import type { Repos } from '../store/repos'
import { RunLogWriter } from '../logs/logWriter'
import { LogTailer } from '../logs/logTailer'
import { ProjectRunner } from './runLoop'
import { Scheduler } from './scheduler'

/**
 * Owns every active run: which projects hold a parallel slot, which provider
 * each is on, and the global kill switch. Everything the UI can do to a run
 * goes through here.
 */
export class Orchestrator extends EventEmitter {
  private runners = new Map<string, ProjectRunner>()
  private writers = new Map<string, RunLogWriter>()
  private iterationsByRun = new Map<string, Iteration[]>()
  private scheduler: Scheduler
  private leases = new LeasePool(new Map())
  private specCache = new Map<string, import('@shared/types/provider').ProviderSpec>()
  private stateCache = new Map<string, ProviderRuntimeState>()
  private settingsCache!: Settings

  readonly tailer: LogTailer

  constructor(
    private readonly repos: Repos,
    private readonly registry: ProviderRegistry,
    private readonly userDataDir: string
  ) {
    super()
    this.scheduler = new Scheduler(2)
    this.tailer = new LogTailer((batch) => this.emit('log', batch))
  }

  async init(): Promise<void> {
    this.settingsCache = await this.repos.settings.read()
    this.scheduler.setLimit(this.settingsCache.maxParallelProjects)
    await this.refreshProviders()
  }

  async refreshProviders(): Promise<void> {
    this.specCache = await this.registry.map()
    this.leases.setLimits(new Map([...this.specCache].map(([id, spec]) => [id, spec.maxConcurrent])))

    const stored = await this.repos.providerState.read()
    this.stateCache = new Map(stored.states.map((s) => [s.providerId, s]))
    for (const id of this.specCache.keys()) {
      if (!this.stateCache.has(id)) this.stateCache.set(id, initialState(id))
    }
    this.emit('providers', this.providerView())
  }

  async reloadSettings(): Promise<Settings> {
    this.settingsCache = await this.repos.settings.read()
    this.scheduler.setLimit(this.settingsCache.maxParallelProjects)
    return this.settingsCache
  }

  providerView(): Array<{ spec: import('@shared/types/provider').ProviderSpec; state: ProviderRuntimeState }> {
    return [...this.specCache.values()].map((spec) => ({
      spec,
      state: this.stateCache.get(spec.id) ?? initialState(spec.id)
    }))
  }

  slots(): { used: number; total: number } {
    return this.scheduler.slots
  }

  runFor(projectId: string): Run | undefined {
    return this.runners.get(projectId)?.run
  }

  iterations(runId: string): Iteration[] {
    return this.iterationsByRun.get(runId) ?? []
  }

  /** Starts a project, or queues it when every parallel slot is taken. */
  async start(project: Project): Promise<Run> {
    if (!project.autonomousOptIn) {
      throw new Error('This project has not been granted autonomous mode. Enable it in the project settings first.')
    }

    const existing = this.runners.get(project.id)
    if (existing?.isActive) return existing.run

    const run = existing?.run ?? (await this.createRun(project))
    const runner =
      existing ?? new ProjectRunner(project, run, this.runnerDeps(project.id, run.id))
    this.runners.set(project.id, runner)

    if (!this.scheduler.request(project.id)) {
      runner.run = { ...runner.run, status: 'queued' }
      await this.persistRun(runner.run)
      this.emit('run', runner.run)
      return runner.run
    }

    void runner
      .start()
      .catch((err: Error) => this.emit('error', err))
      .finally(() => void this.onRunnerFinished(project.id))

    return runner.run
  }

  pause(projectId: string): void {
    this.runners.get(projectId)?.pause()
  }

  stop(projectId: string): void {
    const runner = this.runners.get(projectId)
    if (runner) runner.stop('user_stop')
    else this.scheduler.cancel(projectId)
  }

  /** The global kill switch: every run halted, every process tree reaped. */
  stopAll(reason: 'user_stop' | 'app_shutdown' = 'user_stop'): void {
    for (const runner of this.runners.values()) runner.stop(reason)
  }

  private async onRunnerFinished(projectId: string): Promise<void> {
    const runner = this.runners.get(projectId)
    if (runner) {
      await this.persistRun(runner.run)
      await this.writers.get(runner.run.id)?.close()
      this.writers.delete(runner.run.id)
    }
    const next = this.scheduler.release(projectId)
    if (!next) return

    const queued = this.runners.get(next)
    if (!queued) return
    void queued
      .start()
      .catch((err: Error) => this.emit('error', err))
      .finally(() => void this.onRunnerFinished(next))
  }

  private async createRun(project: Project): Promise<Run> {
    const run: Run = {
      id: randomUUID(),
      projectId: project.id,
      status: 'queued',
      clock: { segments: [] },
      budgetMs: project.budgetMs,
      iterations: 0,
      consecutiveFailures: 0,
      sessionIds: {},
      startedAt: new Date().toISOString()
    }
    await this.repos.projects.update((file) => ({
      ...file,
      runs: [...file.runs, run],
      projects: file.projects.map((p) => (p.id === project.id ? { ...p, currentRunId: run.id } : p))
    }))
    return run
  }

  private async persistRun(run: Run): Promise<void> {
    await this.repos.projects.update((file) => ({
      ...file,
      runs: file.runs.some((r) => r.id === run.id)
        ? file.runs.map((r) => (r.id === run.id ? run : r))
        : [...file.runs, run]
    }))
  }

  private logWriter(projectId: string, runId: string): RunLogWriter {
    const existing = this.writers.get(runId)
    if (existing) return existing
    const writer = new RunLogWriter(
      join(this.userDataDir, 'projects', projectId, 'runs', runId, 'log.jsonl')
    )
    this.writers.set(runId, writer)
    return writer
  }

  private runnerDeps(projectId: string, runId: string) {
    return {
      settings: () => this.settingsCache,
      specs: () => this.specCache,
      states: () => this.stateCache,
      leases: this.leases,
      saveState: async (state: ProviderRuntimeState) => {
        this.stateCache.set(state.providerId, state)
        await this.repos.providerState.write({
          schema: 1,
          states: [...this.stateCache.values()]
        })
        this.emit('providers', this.providerView())
      },
      log: (event: Omit<LogEvent, 't' | 'runId' | 'projectId'>) => {
        const full: LogEvent = { ...event, t: new Date().toISOString(), runId, projectId }
        this.tailer.push(full)
        void this.logWriter(projectId, runId).append(full)
      },
      onRunChange: (run: Run) => {
        void this.persistRun(run)
        this.emit('run', run)
      },
      onIteration: (iteration: Iteration) => {
        const list = this.iterationsByRun.get(iteration.runId) ?? []
        list.push(iteration)
        this.iterationsByRun.set(iteration.runId, list)
        this.emit('iteration', iteration)
      }
    }
  }
}
