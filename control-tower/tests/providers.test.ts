import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyOutcome, backoffMs, initialState, markProbe, selectProvider } from '../src/main/providers/health'
import { LeasePool } from '../src/main/providers/lease'
import { renderArgv, specIsRunnable } from '../src/main/providers/argv'
import { buildChildEnv, checkWorkdir, isInside } from '../src/main/safety/guards'
import type { ProviderSpec } from '@shared/types/provider'

const spec = (id: string, over: Partial<ProviderSpec> = {}): ProviderSpec => ({
  id,
  label: id,
  enabled: true,
  command: id,
  argvFresh: ['-p', '{{PROMPT}}'],
  promptDelivery: 'argv',
  supportsResume: false,
  supportsStreamJson: false,
  maxConcurrent: 1,
  verified: { at: 'now', version: '1' },
  detection: {
    quotaExitCodes: [],
    quotaPatterns: [],
    authPatterns: [],
    transientPatterns: [],
    resetTimePatterns: [],
    quotaMaxRuntimeMs: 120_000
  },
  ...over
})

describe('provider health', () => {
  const specs = new Map([['claude', spec('claude')], ['gemini', spec('gemini')]])
  const free = { hasFreeLease: () => true }

  it('prefers the head of the chain', () => {
    const states = new Map([['claude', initialState('claude')], ['gemini', initialState('gemini')]])
    expect(selectProvider(['claude', 'gemini'], specs, states, free)).toMatchObject({
      kind: 'ready',
      providerId: 'claude'
    })
  })

  it('skips a cooling provider and takes the next one', () => {
    const now = new Date('2026-09-03T12:00:00Z')
    const cooled = applyOutcome(initialState('claude'), 'quota_exhausted', {}, now)
    const states = new Map([['claude', cooled], ['gemini', initialState('gemini')]])

    expect(cooled.status).toBe('cooling')
    expect(selectProvider(['claude', 'gemini'], specs, states, { ...free, now })).toMatchObject({
      providerId: 'gemini'
    })
  })

  it('honours a provider-reported reset time over the default backoff', () => {
    const now = new Date('2026-09-03T12:00:00Z')
    const resetAt = new Date('2026-09-03T12:05:00Z')
    const cooled = applyOutcome(initialState('claude'), 'quota_exhausted', { resetAt }, now)
    expect(cooled.cooldownUntil).toBe(resetAt.toISOString())
  })

  it('probes a recovered provider once, then fully restores it on success', () => {
    const now = new Date('2026-09-03T12:00:00Z')
    const later = new Date('2026-09-03T14:00:00Z')
    const cooled = applyOutcome(initialState('claude'), 'quota_exhausted', {}, now)
    const states = new Map([['claude', cooled], ['gemini', initialState('gemini')]])

    // The cooldown has expired, so the preferred provider gets one probation run.
    const pick = selectProvider(['claude', 'gemini'], specs, states, { ...free, now: later })
    expect(pick).toMatchObject({ kind: 'ready', providerId: 'claude', probation: true })

    const probed = markProbe(cooled, later)
    const restored = applyOutcome(probed, 'success', {}, later)
    expect(restored.status).toBe('available')
    expect(restored.cooldownUntil).toBeUndefined()
    expect(restored.consecutiveQuotaHits).toBe(0)
  })

  it('does not re-probe a provider that just failed its probe', () => {
    const now = new Date('2026-09-03T14:00:00Z')
    let state = applyOutcome(initialState('claude'), 'quota_exhausted', {}, new Date('2026-09-03T12:00:00Z'))
    state = markProbe(state, now)
    state = applyOutcome(state, 'quota_exhausted', {}, now)
    // Second failure doubles the wait rather than hammering the provider.
    expect(backoffMs(state.consecutiveQuotaHits)).toBe(2 * 60 * 60_000)

    const states = new Map([['claude', { ...state, cooldownUntil: now.toISOString() }], ['gemini', initialState('gemini')]])
    expect(selectProvider(['claude', 'gemini'], specs, states, { ...free, now })).toMatchObject({
      providerId: 'gemini'
    })
  })

  it('caps the backoff at six hours', () => {
    expect(backoffMs(99)).toBe(6 * 60 * 60_000)
  })

  it('disables an auth failure permanently rather than retrying it', () => {
    const state = applyOutcome(initialState('claude'), 'auth_error', {})
    expect(state.status).toBe('disabled')
    const states = new Map([['claude', state], ['gemini', initialState('gemini')]])
    expect(selectProvider(['claude', 'gemini'], specs, states, free)).toMatchObject({ providerId: 'gemini' })
  })

  it('leaves provider health alone after an ordinary task failure', () => {
    const before = initialState('claude')
    expect(applyOutcome(before, 'task_failure', {})).toBe(before)
  })

  it('reports why nothing is available', () => {
    const states = new Map([['claude', applyOutcome(initialState('claude'), 'auth_error', {})]])
    const result = selectProvider(['claude'], specs, states, free)
    expect(result.kind).toBe('none')
    if (result.kind === 'none') expect(result.reason).toContain('re-authentication')
  })
})

describe('lease pool', () => {
  it('serialises a subscription CLI across projects', () => {
    const pool = new LeasePool(new Map([['claude', 1]]))
    const first = pool.tryAcquire('claude')
    expect(first).not.toBeNull()
    expect(pool.tryAcquire('claude')).toBeNull()
    first?.()
    expect(pool.tryAcquire('claude')).not.toBeNull()
  })

  it('hands a waiting caller the slot when it is released', async () => {
    const pool = new LeasePool(new Map([['claude', 1]]))
    const held = pool.tryAcquire('claude')!
    const waiting = pool.acquire('claude', 2_000)
    setTimeout(() => held(), 20)
    expect(await waiting).not.toBeNull()
  })

  it('gives up after the wait expires instead of blocking a run forever', async () => {
    const pool = new LeasePool(new Map([['claude', 1]]))
    pool.tryAcquire('claude')
    expect(await pool.acquire('claude', 50)).toBeNull()
  })

  it('releasing twice does not conjure an extra slot', () => {
    const pool = new LeasePool(new Map([['claude', 1]]))
    const release = pool.tryAcquire('claude')!
    release()
    release()
    expect(pool.activeCount('claude')).toBe(0)
  })
})

describe('argv rendering', () => {
  it('substitutes placeholders as whole argv entries, never a shell string', () => {
    const rendered = renderArgv(spec('claude'), {
      prompt: 'a prompt with "quotes" and\nnewlines; rm -rf /',
      workdir: '/tmp/x',
      sessionId: 'abc',
      permissionMode: 'allowlist',
      resume: false
    })
    expect(rendered.args).toEqual(['-p', 'a prompt with "quotes" and\nnewlines; rm -rf /'])
  })

  it('appends the argv for the chosen permission mode', () => {
    const s = spec('claude', {
      allowedToolsArgs: ['--allowedTools', 'Read'],
      fullAutoArgs: ['--permission-mode', 'acceptEdits']
    })
    const ctx = { prompt: 'p', workdir: '/tmp', sessionId: 's', resume: false } as const
    expect(renderArgv(s, { ...ctx, permissionMode: 'allowlist' }).args).toContain('--allowedTools')
    expect(renderArgv(s, { ...ctx, permissionMode: 'full' }).args).toContain('acceptEdits')
  })

  it('uses the resume template only when the provider supports it', () => {
    const s = spec('claude', { supportsResume: true, argvResume: ['-p', '{{PROMPT}}', '--resume', '{{SESSION_ID}}'] })
    const ctx = { prompt: 'p', workdir: '/tmp', sessionId: 'sess', permissionMode: 'allowlist' } as const
    expect(renderArgv(s, { ...ctx, resume: true }).args).toEqual(['-p', 'p', '--resume', 'sess'])
    expect(renderArgv(spec('x'), { ...ctx, resume: true }).usedResume).toBe(false)
  })

  it('sends the prompt on stdin when the spec says so', () => {
    const s = spec('x', { promptDelivery: 'stdin' })
    const r = renderArgv(s, { prompt: 'hello', workdir: '/tmp', sessionId: 's', permissionMode: 'allowlist', resume: false })
    expect(r.args).toEqual(['-p'])
    expect(r.stdinInput).toBe('hello')
  })

  it('refuses to run an unverified or template-less spec', () => {
    expect(specIsRunnable(spec('x', { verified: null })).ok).toBe(false)
    expect(specIsRunnable(spec('x', { argvFresh: [] })).ok).toBe(false)
    expect(specIsRunnable(spec('x', { enabled: false })).ok).toBe(false)
    expect(specIsRunnable(spec('x')).ok).toBe(true)
  })
})

describe('workdir guards', () => {
  const root = mkdtempSync(join(tmpdir(), 'tower-root-'))
  const userData = mkdtempSync(join(tmpdir(), 'tower-data-'))
  const opts = { projectsRoot: root, userDataDir: userData, createdByApp: true }

  it('accepts a fresh folder inside the projects root', () => {
    expect(checkWorkdir(join(root, 'app'), opts).ok).toBe(true)
  })

  it('refuses anything outside the projects root', () => {
    expect(checkWorkdir('/etc/passwd', opts).ok).toBe(false)
    expect(checkWorkdir(join(userData, 'x'), opts).ok).toBe(false)
  })

  // The case that protects the user's real work — including the unrelated
  // TodoApp that lives in this very repository.
  it('refuses an existing git repository the app did not create', () => {
    const existing = join(root, 'someones-repo')
    mkdirSync(join(existing, '.git'), { recursive: true })
    const result = checkWorkdir(existing, { ...opts, createdByApp: false })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('already a git repository')
  })

  it('refuses relative paths and traversal', () => {
    expect(checkWorkdir('relative/path', opts).ok).toBe(false)
    expect(checkWorkdir(join(root, '..', 'escape'), opts).ok).toBe(false)
  })

  it('isInside is not fooled by a shared prefix', () => {
    expect(isInside('/a/b', '/a/bc')).toBe(false)
    expect(isInside('/a/b', '/a/b/c')).toBe(true)
  })
})

describe('child environment', () => {
  it('passes through only allowlisted variables', () => {
    process.env.TOWER_SECRET_TOKEN = 'do-not-leak'
    const env = buildChildEnv()
    expect(env.TOWER_SECRET_TOKEN).toBeUndefined()
    expect(env.PATH).toBeDefined()
    delete process.env.TOWER_SECRET_TOKEN
  })

  it('stops long runs stalling on a pager or a credential prompt', () => {
    const env = buildChildEnv()
    expect(env.GIT_PAGER).toBe('cat')
    expect(env.GIT_TERMINAL_PROMPT).toBe('0')
  })
})

describe('git repository ownership', () => {
  it('refuses a workdir that is only a subdirectory of someone else s repository', async () => {
    const { assertOwnRepo, initRepo } = await import('../src/main/git/repo')
    const outer = mkdtempSync(join(tmpdir(), 'tower-outer-'))
    execFileSync('git', ['init', '-q'], { cwd: outer })
    const inner = join(outer, 'nested')
    mkdirSync(inner, { recursive: true })

    // A bare subdirectory belongs to the outer repository — using it would make
    // `git add -A` sweep up everything around it.
    await expect(assertOwnRepo(inner)).rejects.toThrow(/not the root of its own git repository/)

    // initRepo makes it its own root, which is exactly what the app always does.
    await initRepo(inner)
    await expect(assertOwnRepo(inner)).resolves.toBeUndefined()
  })
})
