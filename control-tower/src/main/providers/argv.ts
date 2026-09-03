import type { PermissionMode, ProviderSpec } from '@shared/types/provider'

/**
 * Renders a spec's argv template. Placeholders are substituted as *whole argv
 * entries* — the app never builds a shell string, so a prompt containing
 * quotes, backticks or newlines cannot turn into command injection.
 */
export interface ArgvContext {
  prompt: string
  workdir: string
  sessionId: string
  model?: string
  permissionMode: PermissionMode
  /** Use argvResume when the spec supports it and this is a warm continuation. */
  resume: boolean
}

export interface RenderedInvocation {
  args: string[]
  /** When set, the prompt goes to the child's stdin instead of argv. */
  stdinInput?: string
  /** When set, the prompt was written to this file and referenced by path. */
  promptFile?: string
  usedResume: boolean
}

const PLACEHOLDER = /^\{\{(PROMPT|WORKDIR|SESSION_ID|MODEL)\}\}$/

export function renderArgv(spec: ProviderSpec, ctx: ArgvContext, promptFilePath?: string): RenderedInvocation {
  const usedResume = ctx.resume && spec.supportsResume && Array.isArray(spec.argvResume) && spec.argvResume.length > 0
  const template = usedResume ? (spec.argvResume as string[]) : spec.argvFresh

  const permissionArgs =
    ctx.permissionMode === 'full' ? (spec.fullAutoArgs ?? []) : (spec.allowedToolsArgs ?? [])

  const args: string[] = []
  for (const entry of [...template, ...permissionArgs]) {
    const match = entry.match(PLACEHOLDER)
    if (!match) {
      args.push(entry)
      continue
    }
    switch (match[1]) {
      case 'PROMPT':
        // Dropped from argv when the prompt travels by another route.
        if (spec.promptDelivery === 'argv') args.push(ctx.prompt)
        else if (spec.promptDelivery === 'file' && promptFilePath) args.push(promptFilePath)
        break
      case 'WORKDIR':
        args.push(ctx.workdir)
        break
      case 'SESSION_ID':
        args.push(ctx.sessionId)
        break
      case 'MODEL':
        // An unset model must not leave a dangling flag; drop the value and
        // let the CLI use its own default.
        if (ctx.model ?? spec.model) args.push((ctx.model ?? spec.model) as string)
        else args.pop()
        break
    }
  }

  return {
    args,
    usedResume,
    ...(spec.promptDelivery === 'stdin' ? { stdinInput: ctx.prompt } : {}),
    ...(spec.promptDelivery === 'file' && promptFilePath ? { promptFile: promptFilePath } : {})
  }
}

/** A spec that has never been verified against the real CLI cannot be started. */
export function specIsRunnable(spec: ProviderSpec): { ok: boolean; reason?: string } {
  if (!spec.enabled) return { ok: false, reason: `${spec.label} is disabled.` }
  if (!spec.command.trim()) return { ok: false, reason: `${spec.label} has no command configured.` }
  if (spec.argvFresh.length === 0) {
    return { ok: false, reason: `${spec.label} has no argv template — configure and verify it in Settings.` }
  }
  if (!spec.verified) {
    return { ok: false, reason: `${spec.label} has not been verified yet. Run "Verify" in Settings first.` }
  }
  return { ok: true }
}
