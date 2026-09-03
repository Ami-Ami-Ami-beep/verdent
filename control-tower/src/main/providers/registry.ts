import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { ProviderSpec } from '@shared/types/provider'
import { JsonStore } from '../store/jsonStore'
import { buildChildEnv } from '../safety/guards'
import { spawnAgent } from '../exec/spawnAgent'

const run = promisify(execFile)

export interface ProvidersFile {
  schema: number
  providers: ProviderSpec[]
}

export class ProviderRegistry {
  private store: JsonStore<ProvidersFile>

  constructor(file: string, private readonly seed: ProvidersFile) {
    this.store = new JsonStore<ProvidersFile>(file, () => structuredClone(this.seed))
  }

  async all(): Promise<ProviderSpec[]> {
    const file = await this.store.read()
    return file.providers
  }

  async map(): Promise<Map<string, ProviderSpec>> {
    return new Map((await this.all()).map((p) => [p.id, p]))
  }

  async get(id: string): Promise<ProviderSpec | undefined> {
    return (await this.all()).find((p) => p.id === id)
  }

  async upsert(spec: ProviderSpec): Promise<ProviderSpec[]> {
    const file = await this.store.update((current) => {
      const providers = current.providers.some((p) => p.id === spec.id)
        ? current.providers.map((p) => (p.id === spec.id ? spec : p))
        : [...current.providers, spec]
      return { ...current, providers }
    })
    return file.providers
  }

  async remove(id: string): Promise<ProviderSpec[]> {
    const file = await this.store.update((current) => ({
      ...current,
      providers: current.providers.filter((p) => p.id !== id)
    }))
    return file.providers
  }
}

export interface VerifyReport {
  ok: boolean
  resolvedPath?: string
  version?: string
  helpText?: string
  dryRunOutput?: string
  error?: string
}

/**
 * Verification is a contract test, not flag-scraping. Reading `--help` tells the
 * user what the CLI accepts; only actually invoking the configured argv proves
 * the app can drive it. An unverified spec is refused at run time on purpose —
 * discovering a wrong flag ten hours into a budget is the failure this prevents.
 */
export async function verifyProvider(spec: ProviderSpec): Promise<VerifyReport> {
  const resolved = await which(spec.command)
  if (!resolved) {
    return { ok: false, error: `${spec.command} was not found on PATH.` }
  }

  const version = await capture(spec.command, ['--version']).catch(() => undefined)
  const helpText = await capture(spec.command, ['--help']).catch(() => undefined)

  if (spec.argvFresh.length === 0) {
    return {
      ok: false,
      resolvedPath: resolved,
      ...(version ? { version } : {}),
      ...(helpText ? { helpText } : {}),
      error: 'No argv template is configured yet. Fill it in using the help output shown here.'
    }
  }

  const scratch = await mkdtemp(join(tmpdir(), 'control-tower-verify-'))
  try {
    const result = await spawnAgent({
      spec,
      timeoutMs: 120_000,
      ctx: {
        prompt: 'Reply with exactly: OK. Do not create, modify or read any files.',
        workdir: scratch,
        sessionId: '00000000-0000-4000-8000-000000000000',
        permissionMode: 'allowlist',
        resume: false
      }
    })
    const output = [...result.stream.pretty].join('\n')
    const saidOk = /\bOK\b/.test(output)
    if (result.exitCode !== 0 || !saidOk) {
      return {
        ok: false,
        resolvedPath: resolved,
        ...(version ? { version } : {}),
        ...(helpText ? { helpText } : {}),
        dryRunOutput: output.slice(-4_000),
        error:
          result.spawnError ??
          `The dry run exited with code ${result.exitCode} and did not answer "OK". Check the argv template.`
      }
    }
    return {
      ok: true,
      resolvedPath: resolved,
      ...(version ? { version } : {}),
      ...(helpText ? { helpText } : {}),
      dryRunOutput: output.slice(-4_000)
    }
  } finally {
    await rm(scratch, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function which(command: string): Promise<string | undefined> {
  if (command.includes('/') || command.includes('\\')) return command
  const finder = process.platform === 'win32' ? 'where' : 'which'
  try {
    const { stdout } = await run(finder, [command], { env: buildChildEnv() })
    return stdout.trim().split('\n')[0]?.trim() || undefined
  } catch {
    return undefined
  }
}

async function capture(command: string, args: string[]): Promise<string> {
  const { stdout, stderr } = await run(command, args, {
    env: buildChildEnv(),
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024
  })
  return (stdout || stderr).trim()
}
