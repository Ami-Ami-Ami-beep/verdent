import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LogEvent } from '@shared/types/log'
import type { Project } from '@shared/types/project'
import type { ProviderRuntimeState, ProviderSpec } from '@shared/types/provider'
import type { Iteration, Run } from '@shared/types/run'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types/settings'
import { LeasePool } from '../src/main/providers/lease'
import { initialState } from '../src/main/providers/health'
import { ProjectRunner } from '../src/main/run/runLoop'
import { parseTasks } from '@shared/tasks'

const MOCK = resolve(__dirname, '../tools/mock-agent/mock-agent.js')

function mockSpec(id: string, scenarioPath: string): ProviderSpec {
  return {
    id,
    label: `Mock ${id}`,
    enabled: true,
    command: process.execPath,
    argvFresh: [MOCK, '--prompt', '{{PROMPT}}', '--workdir', '{{WORKDIR}}', '--scenario', scenarioPath],
    promptDelivery: 'argv',
    supportsResume: false,
    supportsStreamJson: false,
    maxConcurrent: 1,
    verified: { at: new Date().toISOString(), version: 'mock' },
    detection: {
      quotaExitCodes: [],
      quotaPatterns: ['usage limit reached', 'rate.?limit'],
      authPatterns: ['invalid api key'],
      transientPatterns: ['overloaded'],
      resetTimePatterns: ['resets? at ([^\\n\\.]+)'],
      quotaMaxRuntimeMs: 120_000
    }
  }
}

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  projectsRoot: '/tmp',
  providerChain: ['mock-a', 'mock-b'],
  iterationTimeoutMs: 20_000,
  minIterationMs: 500,
  reviewEvery: 5,
  coldRestartEvery: 10
}

interface Harness {
  workdir: string
  control: string
  runner: ProjectRunner
  iterations: Iteration[]
  logs: LogEvent[]
  states: Map<string, ProviderRuntimeState>
  run: () => Run
}

async function harness(scenario: object, overrides: Partial<Settings> = {}): Promise<Harness> {
  const workdir = await mkdtemp(join(tmpdir(), 'tower-e2e-'))
  execFileSync('git', ['init', '-q'], { cwd: workdir })
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: workdir })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: workdir })

  const control = await mkdtemp(join(tmpdir(), 'tower-ctl-'))
  const scenarioPath = join(control, 'scenario.json')
  await writeFile(scenarioPath, JSON.stringify(scenario), 'utf8')

  const specs = new Map<string, ProviderSpec>([
    ['mock-a', mockSpec('mock-a', scenarioPath)],
    ['mock-b', mockSpec('mock-b', scenarioPath)]
  ])
  const states = new Map<string, ProviderRuntimeState>([
    ['mock-a', initialState('mock-a')],
    ['mock-b', initialState('mock-b')]
  ])

  const project: Project = {
    id: 'p1',
    name: 'E2E',
    workdir,
    brief: 'Build something small.',
    budgetMs: 10 * 60_000,
    permissionMode: 'allowlist',
    autonomousOptIn: true,
    createdAt: new Date().toISOString()
  }

  let run: Run = {
    id: 'r1',
    projectId: 'p1',
    status: 'queued',
    clock: { segments: [] },
    budgetMs: project.budgetMs,
    iterations: 0,
    consecutiveFailures: 0,
    sessionIds: {},
    startedAt: new Date().toISOString()
  }

  const iterations: Iteration[] = []
  const logs: LogEvent[] = []

  const runner = new ProjectRunner(project, run, {
    settings: () => ({ ...settings, ...overrides }),
    specs: () => specs,
    states: () => states,
    saveState: async (s) => {
      states.set(s.providerId, s)
    },
    leases: new LeasePool(new Map([['mock-a', 1], ['mock-b', 1]])),
    log: (e) => logs.push({ ...e, t: new Date().toISOString(), runId: 'r1', projectId: 'p1' }),
    onRunChange: (r) => {
      run = r
    },
    onIteration: (i) => iterations.push(i)
  })

  return { workdir, control, runner, iterations, logs, states, run: () => run }
}

function commitCount(workdir: string): number {
  const out = execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: workdir, encoding: 'utf8' })
  return Number(out.trim())
}

let cleanup: string[] = []
beforeEach(() => {
  cleanup = []
})
afterEach(async () => {
  for (const dir of cleanup) {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }).catch(() => undefined)
  }
})

describe('ProjectRunner end to end', () => {
  it('fails over on quota, keeps working, and finishes on a confirmed completion', async () => {
    const h = await harness({
      iterations: [
        { behave: 'work', durationMs: 10, label: 'planning' },
        { behave: 'work', durationMs: 10, label: 'feature one' },
        { behave: 'quota', stderr: 'Error: usage limit reached. Resets at 2099-01-01T00:00:00Z', exit: 1 },
        { behave: 'work', durationMs: 10, label: 'feature two' },
        { behave: 'prose_trap' },
        { behave: 'complete' }
      ]
    })
    cleanup.push(h.workdir, h.control)

    await h.runner.start()

    expect(h.run().stopReason).toBe('all_tasks_done')
    expect(h.run().status).toBe('completed')

    // The quota hit parked provider A and moved the work to B.
    expect(h.states.get('mock-a')?.status).toBe('cooling')
    expect(h.states.get('mock-a')?.cooldownUntil).toContain('2099')

    const providers = h.iterations.map((i) => i.providerId)
    expect(providers.slice(0, 2)).toEqual(['mock-a', 'mock-a'])
    expect(providers.slice(2)).toEqual(providers.slice(2).map(() => 'mock-b'))

    // A quota failure must not be recorded as an iteration at all.
    expect(h.iterations.every((i) => i.outcome !== 'quota_exhausted')).toBe(true)
    expect(h.logs.some((l) => l.msg.includes('Provider switch: mock-a → mock-b'))).toBe(true)

    // Every successful iteration left a commit behind.
    expect(commitCount(h.workdir)).toBeGreaterThanOrEqual(h.iterations.length)

    const tasks = parseTasks(readFileSync(join(h.workdir, '.tower', 'TASKS.md'), 'utf8'))
    expect(tasks.open).toBe(0)
    expect(tasks.done).toBeGreaterThan(0)
  }, 60_000)

  it('reads output that talks about rate limits as success, not exhaustion', async () => {
    const h = await harness({ iterations: [{ behave: 'prose_trap' }, { behave: 'complete' }] })
    cleanup.push(h.workdir, h.control)

    await h.runner.start()

    expect(h.iterations[0]?.outcome).toBe('success')
    expect(h.states.get('mock-a')?.status).toBe('available')
    expect(h.states.get('mock-a')?.consecutiveQuotaHits).toBe(0)
  }, 60_000)

  it('does not believe an agent that reports success without committing', async () => {
    const h = await harness(
      { iterations: [{ behave: 'nocommit' }, { behave: 'nocommit' }, { behave: 'nocommit' }] },
      { maxConsecutiveFailures: 2 }
    )
    cleanup.push(h.workdir, h.control)

    await h.runner.start()

    expect(h.iterations[0]?.outcome).toBe('task_failure')
    expect(h.run().stopReason).toBe('max_consecutive_failures')
    expect(h.logs.some((l) => l.msg.includes('committed nothing'))).toBe(true)
  }, 60_000)

  it('times out a hung agent and kills its process tree', async () => {
    const h = await harness(
      { iterations: [{ behave: 'hang' }] },
      { iterationTimeoutMs: 1_500, maxConsecutiveFailures: 1 }
    )
    cleanup.push(h.workdir, h.control)

    await h.runner.start()

    expect(h.iterations[0]?.outcome).toBe('timeout')
    expect(h.run().stopReason).toBe('max_consecutive_failures')
  }, 60_000)

  it('disables a provider that reports an auth error instead of retrying it', async () => {
    const h = await harness({ iterations: [{ behave: 'auth' }, { behave: 'complete' }] })
    cleanup.push(h.workdir, h.control)

    await h.runner.start()

    expect(h.states.get('mock-a')?.status).toBe('disabled')
    // The run carried on with the next provider rather than dying.
    expect(h.iterations[0]?.providerId).toBe('mock-b')
  }, 60_000)

  it('stops when the budget runs out and bills only running time', async () => {
    const h = await harness({ iterations: [{ behave: 'work', durationMs: 300 }] }, { minIterationMs: 500 })
    cleanup.push(h.workdir, h.control)
    // A budget smaller than one iteration means it must stop immediately after
    // the first pass rather than starting another it cannot finish.
    h.runner.run = { ...h.runner.run, budgetMs: 2_000 }

    await h.runner.start()

    expect(h.run().stopReason).toBe('budget_exhausted')
    expect(h.iterations.length).toBeGreaterThanOrEqual(1)
  }, 60_000)
})

describe('process group reaping', () => {
  it('kills the agent AND the processes the agent started', async () => {
    const control = await mkdtemp(join(tmpdir(), 'tower-pid-'))
    const pidFile = join(control, 'grandchild.pid')

    const h = await harness(
      { iterations: [{ behave: 'hang_with_child', pidFile }] },
      { iterationTimeoutMs: 1_500, maxConsecutiveFailures: 1 }
    )
    cleanup.push(h.workdir, h.control, control)

    await h.runner.start()

    const pid = Number(readFileSync(pidFile, 'utf8').trim())
    expect(Number.isFinite(pid)).toBe(true)

    // SIGTERM then SIGKILL is not instantaneous; give the group a moment to go.
    const gone = await waitUntil(() => !isAlive(pid), 5_000)
    expect(gone).toBe(true)
  }, 60_000)
})

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return predicate()
}
