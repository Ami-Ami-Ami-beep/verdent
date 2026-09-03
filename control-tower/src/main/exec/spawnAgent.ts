import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ProviderSpec } from '@shared/types/provider'
import { buildChildEnv } from '../safety/guards'
import { killTree } from './killTree'
import { createStreamParser, type ParsedStream } from './streamParse'
import { pidRegistry } from './pidRegistry'
import { renderArgv, type ArgvContext } from '../providers/argv'

export interface SpawnOptions {
  spec: ProviderSpec
  ctx: ArgvContext
  timeoutMs: number
  /** Called for every line of output, for live streaming into the UI. */
  onLine?: (channel: 'out' | 'err', line: string) => void
  /** Resolves when the caller wants the run cancelled. */
  signal?: AbortSignal
}

export interface SpawnResult {
  exitCode: number | null
  signal: NodeJS.Signals | null
  ranForMs: number
  timedOut: boolean
  killedByUser: boolean
  stream: ParsedStream
  /** Populated when the binary itself could not be started. */
  spawnError?: string
  argv: string[]
  usedResume: boolean
}

/**
 * Runs one agent iteration. The child is its own process-group leader so the
 * entire tree can be reaped later; see killTree.ts for why that matters.
 */
export async function spawnAgent(opts: SpawnOptions): Promise<SpawnResult> {
  const { spec, ctx, timeoutMs } = opts

  let promptFile: string | undefined
  if (spec.promptDelivery === 'file') {
    promptFile = join(tmpdir(), `control-tower-prompt-${randomUUID()}.txt`)
    await writeFile(promptFile, ctx.prompt, 'utf8')
  }

  const invocation = renderArgv(spec, ctx, promptFile)
  const parser = createStreamParser(spec.supportsStreamJson)
  const startedAt = Date.now()

  return await new Promise<SpawnResult>((resolvePromise) => {
    let settled = false
    let timedOut = false
    let killedByUser = false

    const child = spawn(spec.command, invocation.args, {
      cwd: ctx.workdir,
      env: buildChildEnv(spec.env),
      // Own process group, so the whole tree can be signalled at once.
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe']
    })

    if (child.pid !== undefined) pidRegistry.add(child.pid)

    const finish = (extra: Partial<SpawnResult> = {}): void => {
      if (settled) return
      settled = true
      if (child.pid !== undefined) pidRegistry.remove(child.pid)
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
      resolvePromise({
        exitCode: child.exitCode,
        signal: child.signalCode,
        ranForMs: Date.now() - startedAt,
        timedOut,
        killedByUser,
        stream: parser.finish(),
        argv: invocation.args,
        usedResume: invocation.usedResume,
        ...extra
      })
    }

    const timer = setTimeout(() => {
      timedOut = true
      killTree(child)
    }, timeoutMs)

    const onAbort = (): void => {
      killedByUser = true
      killTree(child)
    }
    opts.signal?.addEventListener('abort', onAbort, { once: true })

    lineReader(child.stdout, (line) => {
      parser.stdoutLine(line)
      opts.onLine?.('out', line)
    })
    lineReader(child.stderr, (line) => {
      parser.stderrLine(line)
      opts.onLine?.('err', line)
    })

    // Some CLIs block forever waiting on stdin if it is left open.
    if (invocation.stdinInput !== undefined) child.stdin?.write(invocation.stdinInput)
    child.stdin?.end()

    child.on('error', (err) => {
      finish({ exitCode: null, signal: null, spawnError: err.message })
    })
    child.on('close', () => finish())
  })
}

function lineReader(stream: NodeJS.ReadableStream | null, onLine: (line: string) => void): void {
  if (!stream) return
  let buffer = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk: string) => {
    buffer += chunk
    let index = buffer.indexOf('\n')
    while (index >= 0) {
      onLine(buffer.slice(0, index).replace(/\r$/, ''))
      buffer = buffer.slice(index + 1)
      index = buffer.indexOf('\n')
    }
    // A single unterminated line must not grow without bound.
    if (buffer.length > 1_000_000) {
      onLine(buffer)
      buffer = ''
    }
  })
  stream.on('end', () => {
    if (buffer.trim()) onLine(buffer)
    buffer = ''
  })
}
