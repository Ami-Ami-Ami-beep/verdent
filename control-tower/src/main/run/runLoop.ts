import { randomUUID } from 'node:crypto'
import { classify, isProviderFault } from '@shared/classify'
import { closeSegment, elapsedMs, humanDuration, remainingMs, startSegment } from '@shared/budget'
import type { LogEvent } from '@shared/types/log'
import type { Project } from '@shared/types/project'
import type { ProviderRuntimeState, ProviderSpec } from '@shared/types/provider'
import type { Iteration, IterationKind, Run, StopReason } from '@shared/types/run'
import type { Settings } from '@shared/types/settings'
import { commitAll, headSha, tagIteration } from '../git/repo'
import { spawnAgent } from '../exec/spawnAgent'
import { applyOutcome, initialState, markProbe, selectProvider } from '../providers/health'
import { specIsRunnable } from '../providers/argv'
import type { LeasePool } from '../providers/lease'
import { buildPrompt } from './promptBuilder'
import { appendOrchestratorNote, bootstrap, readTower, writeState } from './towerFiles'

export interface RunnerDeps {
  settings: () => Settings
  specs: () => Map<string, ProviderSpec>
  states: () => Map<string, ProviderRuntimeState>
  saveState: (state: ProviderRuntimeState) => Promise<void>
  leases: LeasePool
  log: (event: Omit<LogEvent, 't' | 'runId' | 'projectId'>) => void
  onRunChange: (run: Run) => void
  onIteration: (iteration: Iteration) => void
}

/**
 * Drives one project from its brief to a finished app, one agent invocation at
 * a time, switching provider whenever the current one runs out of quota.
 *
 * The loop deliberately treats provider problems and task problems as different
 * things: a quota outage must never count toward the consecutive-failure limit,
 * otherwise three failovers would end the run — the exact opposite of the point.
 */
export class ProjectRunner {
  private abort: AbortController | null = null
  private stopping: StopReason | null = null
  private pauseRequested = false
  private loopPromise: Promise<void> | null = null
  /** Set when the agent claimed completion; confirmed by one final review pass. */
  private completionClaimed = false
  private forceKind: IterationKind | null = null
  private lastFailureNote: string | undefined

  constructor(
    public readonly project: Project,
    public run: Run,
    private readonly deps: RunnerDeps
  ) {}

  get isActive(): boolean {
    return this.loopPromise !== null
  }

  start(): Promise<void> {
    if (this.loopPromise) return this.loopPromise
    this.stopping = null
    this.pauseRequested = false
    this.loopPromise = this.loop().finally(() => {
      this.loopPromise = null
    })
    return this.loopPromise
  }

  /** Closes the budget clock and lets the current iteration finish. */
  pause(): void {
    this.pauseRequested = true
    this.abort?.abort()
  }

  stop(reason: StopReason = 'user_stop'): void {
    this.stopping = reason
    this.abort?.abort()
  }

  private emit(
    msg: string,
    level: LogEvent['level'] = 'info',
    ch: LogEvent['ch'] = 'sys',
    extra: Partial<LogEvent> = {}
  ): void {
    this.deps.log({ iter: this.run.iterations, ch, level, msg, ...extra })
  }

  private setRun(patch: Partial<Run>): void {
    this.run = { ...this.run, ...patch }
    this.deps.onRunChange(this.run)
  }

  private finishRun(reason: StopReason): void {
    const status: Run['status'] =
      reason === 'all_tasks_done' ? 'completed'
      : reason === 'budget_exhausted' ? 'budget_exhausted'
      : reason === 'user_stop' ? 'stopped_by_user'
      : 'failed'

    this.setRun({
      status,
      stopReason: reason,
      endedAt: new Date().toISOString(),
      clock: { segments: closeSegment(this.run.clock.segments) }
    })
    this.emit(`Run finished: ${reason}`, reason === 'all_tasks_done' ? 'info' : 'warn')
  }

  private async loop(): Promise<void> {
    await bootstrap(this.project)
    this.setRun({
      status: 'running',
      clock: { segments: startSegment(this.run.clock.segments) }
    })
    this.emit(`Run started with a budget of ${humanDuration(this.run.budgetMs)}`)

    try {
      for (;;) {
        const settings = this.deps.settings()

        if (this.stopping) return this.finishRun(this.stopping)
        if (this.pauseRequested) {
          this.setRun({ status: 'paused', clock: { segments: closeSegment(this.run.clock.segments) } })
          this.emit('Run paused; the budget clock is stopped.')
          return
        }

        const left = remainingMs(this.run.budgetMs, this.run.clock.segments)
        if (left < settings.minIterationMs) return this.finishRun('budget_exhausted')

        if (this.run.consecutiveFailures >= settings.maxConsecutiveFailures) {
          return this.finishRun('max_consecutive_failures')
        }

        const proceed = await this.runIteration(settings, left)
        if (proceed !== 'continue') return this.finishRun(proceed)
      }
    } catch (err) {
      this.emit(`Run crashed: ${(err as Error).message}`, 'error')
      this.finishRun('max_consecutive_failures')
    }
  }

  /** One agent invocation, from provider selection to commit. */
  private async runIteration(settings: Settings, budgetLeftMs: number): Promise<'continue' | StopReason> {
    const specs = this.deps.specs()
    const chain = this.project.providerChainOverride ?? settings.providerChain

    const selection = selectProvider(chain, specs, this.deps.states(), {
      hasFreeLease: (id) => this.deps.leases.hasFree(id)
    })

    let providerId: string
    let probation = false

    if (selection.kind === 'ready') {
      providerId = selection.providerId
      probation = selection.probation
    } else if (settings.providerContention === 'wait') {
      // Every candidate is busy rather than cooling: waiting may still pay off.
      const waited = await this.waitForAnyLease(chain, specs, settings.leaseWaitMs)
      if (!waited) {
        this.emit(`No provider available: ${selection.reason}`, 'warn')
        return 'no_provider_available'
      }
      providerId = waited
    } else {
      this.emit(`No provider available: ${selection.reason}`, 'warn')
      return 'no_provider_available'
    }

    const spec = specs.get(providerId)
    if (!spec) return 'no_provider_available'

    const runnable = specIsRunnable(spec)
    if (!runnable.ok) {
      this.emit(`${runnable.reason}`, 'warn')
      // Treat it like a provider fault so the chain moves on rather than
      // counting it against the project.
      await this.persistState(applyOutcome(this.stateFor(providerId), 'auth_error', { excerpt: runnable.reason ?? '' }))
      return 'continue'
    }

    const release = this.deps.leases.tryAcquire(providerId)
    if (!release) return 'continue' // taken between selection and acquisition

    try {
      return await this.executeIteration(spec, settings, budgetLeftMs, probation)
    } finally {
      release()
    }
  }

  private async executeIteration(
    spec: ProviderSpec,
    settings: Settings,
    budgetLeftMs: number,
    probation: boolean
  ): Promise<'continue' | StopReason> {
    const index = this.run.iterations + 1
    const tower = await readTower(this.project.workdir)

    const kind = this.pickKind(index, tower.tasks.open, settings)
    const previousProvider = this.run.lastProviderId
    const sameProvider = previousProvider === spec.id
    const coldRestartDue = settings.coldRestartEvery > 0 && index % settings.coldRestartEvery === 0
    const storedSession = this.run.sessionIds[spec.id]
    const warmResume = Boolean(sameProvider && storedSession && spec.supportsResume && !coldRestartDue && kind !== 'plan')

    if (previousProvider && !sameProvider) {
      this.deps.log({
        iter: index,
        ch: 'sys',
        level: 'warn',
        provider: spec.id,
        msg: `Provider switch: ${previousProvider} → ${spec.id}${probation ? ' (probation probe)' : ''}`
      })
    }

    const prompt = buildPrompt({
      kind,
      workdir: this.project.workdir,
      iteration: index,
      tasks: tower.tasks,
      journal: tower.journal,
      budgetTotalMs: this.run.budgetMs,
      budgetRemainingMs: budgetLeftMs,
      currentProvider: spec.id,
      ...(previousProvider ? { previousProvider } : {}),
      ...(this.lastFailureNote ? { lastFailure: this.lastFailureNote } : {}),
      warmResume
    })

    const sessionId = warmResume ? (storedSession as string) : randomUUID()
    const startedAt = new Date().toISOString()

    // Publish the current state for the agent to read, then commit everything
    // the orchestrator itself touched. Only after that is HEAD recorded — so
    // "did HEAD move?" measures the agent's work and nothing else.
    await this.writeTowerState(index, spec.id, this.lastFailureNote)
    await commitAll(this.project.workdir, `iter ${index} [${spec.id}] setup`).catch(() => undefined)
    const headBefore = await headSha(this.project.workdir)
    this.deps.log({
      iter: index,
      ch: 'sys',
      level: 'info',
      provider: spec.id,
      msg: `Iteration ${index} (${kind}${warmResume ? ', resumed' : ', fresh'}) on ${spec.label}`
    })

    if (probation) await this.persistState(markProbe(this.stateFor(spec.id)))

    this.abort = new AbortController()
    const timeout = Math.min(settings.iterationTimeoutMs, budgetLeftMs)
    const result = await spawnAgent({
      spec,
      timeoutMs: timeout,
      signal: this.abort.signal,
      ctx: {
        prompt,
        workdir: this.project.workdir,
        sessionId,
        permissionMode: this.project.permissionMode,
        resume: warmResume,
        ...(spec.model ? { model: spec.model } : {})
      },
      onLine: (channel, line) => {
        this.deps.log({ iter: index, ch: channel, level: channel === 'err' ? 'warn' : 'debug', provider: spec.id, msg: line })
      }
    })
    this.abort = null

    if (result.spawnError) {
      this.emit(`Could not start ${spec.command}: ${result.spawnError}`, 'error')
    }

    const verdict = classify({
      exitCode: result.exitCode,
      signal: result.signal,
      errorChannelText: result.spawnError
        ? `${result.spawnError}\n${result.stream.errorChannel}`
        : result.stream.errorChannel,
      ranForMs: result.ranForMs,
      hadToolActivity: result.stream.hadToolActivity,
      structuredError: result.stream.structuredError,
      timedOut: result.timedOut,
      killedByUser: result.killedByUser && !this.pauseRequested,
      spec: spec.detection
    })

    // Every classification leaves evidence, so a wrong call is diagnosable.
    this.deps.log({
      iter: index,
      ch: 'sys',
      level: verdict.cls === 'success' ? 'info' : 'warn',
      provider: spec.id,
      msg:
        `Outcome: ${verdict.cls}` +
        (verdict.matched ? ` (matched /${verdict.matched}/)` : '') +
        (verdict.downgradedFrom ? ` — downgraded from ${verdict.downgradedFrom}` : '') +
        (verdict.resetAt ? ` — provider says it resets at ${verdict.resetAt.toISOString()}` : ''),
      ...(verdict.excerpt ? { data: { excerpt: verdict.excerpt } } : {})
    })

    if (result.stream.sessionId) {
      this.setRun({ sessionIds: { ...this.run.sessionIds, [spec.id]: result.stream.sessionId } })
    }

    await this.persistState(
      applyOutcome(this.stateFor(spec.id), verdict.cls, {
        ...(verdict.resetAt ? { resetAt: verdict.resetAt } : {}),
        ...(verdict.excerpt ? { excerpt: verdict.excerpt } : {})
      })
    )

    // A provider fault costs nothing but the attempt: do not commit, do not
    // count it, do not advance the iteration number. Just take the next one.
    if (isProviderFault(verdict.cls)) {
      this.emit(`${spec.label} is unavailable (${verdict.cls}); moving down the chain.`, 'warn')
      return this.stopping ?? 'continue'
    }

    let outcome = verdict.cls

    // A well-behaved agent commits its own work — the prompt demands it. So the
    // question is not "did we commit?" but "did HEAD move?". Anything the agent
    // left uncommitted is swept up here so the next one inherits a clean tree.
    const sweptSha = await commitAll(
      this.project.workdir,
      `iter ${index} [${spec.id}] ${kind} (uncommitted leftovers)`
    ).catch((err: Error) => {
      this.emit(`git commit failed: ${err.message}`, 'error')
      return undefined
    })
    const headAfter = await headSha(this.project.workdir)
    let commitSha = headAfter && headAfter !== headBefore ? (sweptSha ?? headAfter) : undefined

    // Work that is not committed does not exist — enforce the rule the prompt
    // states, otherwise the next agent inherits an invisible half-change.
    if (!commitSha && outcome === 'success') {
      outcome = 'task_failure'
      this.emit('The agent reported success but committed nothing; counting it as a failure.', 'warn')
    }
    if (commitSha) await tagIteration(this.project.workdir, index)

    const after = await readTower(this.project.workdir)
    const iteration: Iteration = {
      runId: this.run.id,
      index,
      kind,
      providerId: spec.id,
      warmResume,
      startedAt,
      endedAt: new Date().toISOString(),
      exitCode: result.exitCode,
      outcome,
      tasksDoneDelta: after.tasks.done - tower.tasks.done,
      ...(commitSha ? { commitSha } : {})
    }
    this.deps.onIteration(iteration)

    const failed = outcome !== 'success'
    if (failed) {
      this.lastFailureNote = `${outcome}${verdict.excerpt ? `: ${verdict.excerpt.slice(0, 300)}` : ''}`
      await appendOrchestratorNote(this.project.workdir, {
        iteration: index,
        provider: spec.id,
        outcome,
        detail: verdict.excerpt ?? result.stream.errorChannel
      })
      // A repeated failure means the tree is probably broken; stop adding to it
      // and repair instead.
      this.forceKind = 'review'
    } else {
      this.lastFailureNote = undefined
      this.forceKind = null
    }

    this.setRun({
      iterations: index,
      lastProviderId: spec.id,
      consecutiveFailures: failed ? this.run.consecutiveFailures + 1 : 0
    })

    if (verdict.cls === 'transient' && !failed) this.emit('Transient provider error; retrying.', 'warn')

    if (this.stopping) return this.stopping

    // Completion needs confirming: agents routinely declare victory early, so a
    // claim only ends the run once a review iteration has also seen it through.
    if (result.stream.projectComplete && after.tasks.open === 0) {
      if (this.completionClaimed && kind === 'review') return 'all_tasks_done'
      this.completionClaimed = true
      this.forceKind = 'review'
      this.emit('The agent reports the project is complete; running a final review to verify.')
    } else if (after.tasks.open === 0 && after.tasks.total > 0 && kind !== 'review') {
      this.forceKind = 'review'
    }

    return 'continue'
  }

  private pickKind(index: number, openTaskCount: number, settings: Settings): IterationKind {
    if (index === 1) return 'plan'
    if (this.forceKind) return this.forceKind
    if (openTaskCount === 0) return 'review'
    if (settings.reviewEvery > 0 && index % settings.reviewEvery === 0) return 'review'
    return 'continue'
  }

  private stateFor(providerId: string): ProviderRuntimeState {
    return this.deps.states().get(providerId) ?? initialState(providerId)
  }

  private async persistState(state: ProviderRuntimeState): Promise<void> {
    await this.deps.saveState(state)
  }

  private async waitForAnyLease(
    chain: string[],
    specs: Map<string, ProviderSpec>,
    timeoutMs: number
  ): Promise<string | null> {
    const candidates = chain.filter((id) => {
      const spec = specs.get(id)
      const state = this.deps.states().get(id)
      return spec?.enabled && state?.status !== 'disabled' && state?.status !== 'cooling'
    })
    if (candidates.length === 0) return null

    const first = candidates[0] as string
    const release = await this.deps.leases.acquire(first, timeoutMs)
    if (!release) return null
    release() // hand the slot straight back; the caller re-acquires it properly
    return first
  }

  private async writeTowerState(iteration: number, providerId: string, lastOutcome?: string): Promise<void> {
    const used = elapsedMs(this.run.clock.segments)
    await writeState(this.project.workdir, {
      schema: 1,
      runId: this.run.id,
      iteration,
      lastProvider: providerId,
      ...(lastOutcome ? { lastOutcome } : {}),
      budget: {
        totalMs: this.run.budgetMs,
        usedMs: used,
        remainingMs: Math.max(0, this.run.budgetMs - used),
        remainingHuman: humanDuration(Math.max(0, this.run.budgetMs - used))
      },
      consecutiveFailures: this.run.consecutiveFailures,
      updatedAt: new Date().toISOString()
    }).catch(() => undefined)
  }
}
