import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Project } from '@shared/types/project'
import type { ProviderSpec } from '@shared/types/provider'
import type { Run } from '@shared/types/run'
import { DEFAULT_SETTINGS } from '@shared/types/settings'
import { Orchestrator } from '../src/main/run/orchestrator'
import { ProviderRegistry, type ProvidersFile } from '../src/main/providers/registry'
import { createRepos } from '../src/main/store/repos'

const MOCK = resolve(__dirname, '../tools/mock-agent/mock-agent.js')

function mockSpec(id: string, scenarioPath: string, maxConcurrent = 1): ProviderSpec {
  return {
    id,
    label: `Mock ${id}`,
    enabled: true,
    command: process.execPath,
    argvFresh: [MOCK, '--prompt', '{{PROMPT}}', '--workdir', '{{WORKDIR}}', '--scenario', scenarioPath],
    promptDelivery: 'argv',
    supportsResume: false,
    supportsStreamJson: false,
    maxConcurrent,
    verified: { at: new Date().toISOString(), version: 'mock' },
    detection: {
      quotaExitCodes: [],
      quotaPatterns: ['usage limit reached'],
      authPatterns: ['invalid api key'],
      transientPatterns: [],
      resetTimePatterns: ['resets? at ([^\\n\\.]+)'],
      quotaMaxRuntimeMs: 120_000
    }
  }
}

const dirs: string[] = []
afterEach(async () => {
  for (const dir of dirs) {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }).catch(() => undefined)
  }
  dirs.length = 0
})

async function makeWorkdir(root: string, name: string): Promise<string> {
  const workdir = join(root, name)
  await mkdir(workdir, { recursive: true })
  execFileSync('git', ['init', '-q'], { cwd: workdir })
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: workdir })
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: workdir })
  return workdir
}

function project(id: string, workdir: string): Project {
  return {
    id,
    name: id,
    workdir,
    brief: 'Build a very small thing.',
    budgetMs: 5 * 60_000,
    permissionMode: 'allowlist',
    autonomousOptIn: true,
    createdAt: new Date().toISOString()
  }
}

async function setup(
  scenario: object,
  opts: { maxParallelProjects?: number; maxConcurrent?: number; chain?: string[] } = {}
) {
  const userData = await mkdtemp(join(tmpdir(), 'tower-ud-'))
  const root = await mkdtemp(join(tmpdir(), 'tower-projects-'))
  const control = await mkdtemp(join(tmpdir(), 'tower-ctl-'))
  dirs.push(userData, root, control)

  const scenarioPath = join(control, 'scenario.json')
  await writeFile(scenarioPath, JSON.stringify(scenario), 'utf8')

  const repos = createRepos(userData, root)
  await repos.settings.write({
    ...DEFAULT_SETTINGS,
    projectsRoot: root,
    providerChain: opts.chain ?? ['mock-a', 'mock-b'],
    maxParallelProjects: opts.maxParallelProjects ?? 2,
    minIterationMs: 500,
    iterationTimeoutMs: 20_000
  })

  const seed: ProvidersFile = {
    schema: 1,
    providers: [
      mockSpec('mock-a', scenarioPath, opts.maxConcurrent ?? 1),
      mockSpec('mock-b', scenarioPath, opts.maxConcurrent ?? 1)
    ]
  }
  const registry = new ProviderRegistry(join(userData, 'providers.json'), seed)
  const orchestrator = new Orchestrator(repos, registry, userData)
  await orchestrator.init()

  return { orchestrator, repos, root, userData }
}

function waitForRun(orchestrator: Orchestrator, projectId: string, timeoutMs = 60_000): Promise<Run> {
  return new Promise((resolvePromise, reject) => {
    const deadline = Date.now() + timeoutMs
    const tick = setInterval(() => {
      const run = orchestrator.runFor(projectId)
      const terminal = run && !['queued', 'running'].includes(run.status)
      if (terminal) {
        clearInterval(tick)
        resolvePromise(run)
      } else if (Date.now() > deadline) {
        clearInterval(tick)
        reject(new Error(`run for ${projectId} did not finish; status=${run?.status}`))
      }
    }, 100)
  })
}

describe('Orchestrator', () => {
  it('runs a project to completion and persists the run and its log', async () => {
    const { orchestrator, repos, root, userData } = await setup({
      iterations: [{ behave: 'work', durationMs: 10 }, { behave: 'complete' }]
    })
    const p = project('p1', await makeWorkdir(root, 'p1'))
    await repos.projects.update((f) => ({ ...f, projects: [p] }))

    await orchestrator.start(p)
    const run = await waitForRun(orchestrator, 'p1')

    expect(run.status).toBe('completed')
    expect(run.stopReason).toBe('all_tasks_done')

    // The run survived to disk, and so did its log.
    const stored = await repos.projects.read()
    expect(stored.runs.find((r) => r.id === run.id)?.status).toBe('completed')

    const logFile = join(userData, 'projects', 'p1', 'runs', run.id, 'log.jsonl')
    expect(existsSync(logFile)).toBe(true)
    const events = readFileSync(logFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    expect(events.length).toBeGreaterThan(0)
    expect(events.some((e) => e.msg.includes('Run started'))).toBe(true)
  }, 90_000)

  it('refuses to start a project that has not been granted autonomous mode', async () => {
    const { orchestrator, root } = await setup({ iterations: [{ behave: 'complete' }] })
    const p = { ...project('p1', await makeWorkdir(root, 'p1')), autonomousOptIn: false }
    await expect(orchestrator.start(p)).rejects.toThrow(/autonomous/i)
  }, 30_000)

  it('queues a second project when every parallel slot is taken, then runs it', async () => {
    const { orchestrator, repos, root } = await setup(
      { iterations: [{ behave: 'work', durationMs: 200 }, { behave: 'complete' }] },
      { maxParallelProjects: 1 }
    )
    const a = project('pa', await makeWorkdir(root, 'pa'))
    const b = project('pb', await makeWorkdir(root, 'pb'))
    await repos.projects.update((f) => ({ ...f, projects: [a, b] }))

    await orchestrator.start(a)
    const queued = await orchestrator.start(b)
    expect(queued.status).toBe('queued')
    expect(orchestrator.slots()).toEqual({ used: 1, total: 1 })

    // The queued project must actually start once the slot frees up.
    expect((await waitForRun(orchestrator, 'pa')).status).toBe('completed')
    expect((await waitForRun(orchestrator, 'pb')).status).toBe('completed')
  }, 120_000)

  it('never lets two projects use one subscription CLI at the same time', async () => {
    const { orchestrator, repos, root } = await setup(
      { iterations: [{ behave: 'work', durationMs: 250 }, { behave: 'complete' }] },
      { maxParallelProjects: 2, maxConcurrent: 1, chain: ['mock-a'] }
    )
    const a = project('pa', await makeWorkdir(root, 'pa'))
    const b = project('pb', await makeWorkdir(root, 'pb'))
    await repos.projects.update((f) => ({ ...f, projects: [a, b] }))

    const spans: Array<{ start: number; end: number }> = []
    orchestrator.on('iteration', (it) => {
      if (it.providerId !== 'mock-a' || !it.endedAt) return
      spans.push({ start: Date.parse(it.startedAt), end: Date.parse(it.endedAt) })
    })

    await orchestrator.start(a)
    await orchestrator.start(b)
    await waitForRun(orchestrator, 'pa')
    await waitForRun(orchestrator, 'pb')

    expect(spans.length).toBeGreaterThanOrEqual(2)
    const sorted = [...spans].sort((x, y) => x.start - y.start)
    for (let i = 1; i < sorted.length; i++) {
      // Each run on the leased provider starts only after the previous one ended.
      expect(sorted[i]!.start).toBeGreaterThanOrEqual(sorted[i - 1]!.end - 50)
    }
  }, 120_000)

  it('stops everything when the kill switch is pulled', async () => {
    const { orchestrator, repos, root } = await setup({ iterations: [{ behave: 'hang' }] })
    const p = project('p1', await makeWorkdir(root, 'p1'))
    await repos.projects.update((f) => ({ ...f, projects: [p] }))

    await orchestrator.start(p)
    await new Promise((r) => setTimeout(r, 600))
    orchestrator.stopAll()

    const run = await waitForRun(orchestrator, 'p1', 20_000)
    expect(run.status).toBe('stopped_by_user')
  }, 60_000)
})
