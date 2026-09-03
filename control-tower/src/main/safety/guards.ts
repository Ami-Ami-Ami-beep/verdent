import { existsSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { homedir } from 'node:os'

/**
 * These CLIs run with edits auto-approved, so the workdir boundary is the last
 * line of defence. Everything here is a *refusal to start*, not a warning:
 * a run that should not begin must not begin.
 */

export interface WorkdirCheck {
  ok: boolean
  reason?: string
}

export function isInside(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * `createdByApp` should be true only for a directory this app just created.
 * Refusing pre-existing git repositories is what keeps an agent away from the
 * user's real work — including the unrelated TodoApp sitting in this repo.
 */
export function checkWorkdir(
  workdir: string,
  opts: { projectsRoot: string; userDataDir: string; createdByApp: boolean }
): WorkdirCheck {
  const target = resolve(workdir)

  if (!isAbsolute(workdir)) return { ok: false, reason: 'The project folder must be an absolute path.' }
  if (target === resolve('/')) return { ok: false, reason: 'The filesystem root cannot be a project folder.' }
  if (target === resolve(homedir())) return { ok: false, reason: 'Your home directory cannot be a project folder.' }
  if (target.split(sep).includes('..')) return { ok: false, reason: 'The path may not contain "..".' }

  if (isInside(opts.userDataDir, target)) {
    return { ok: false, reason: "A project cannot live inside Control Tower's own data directory." }
  }
  if (!isInside(opts.projectsRoot, target)) {
    return { ok: false, reason: `The project folder must be inside the projects root (${opts.projectsRoot}).` }
  }
  if (!opts.createdByApp && existsSync(resolve(target, '.git'))) {
    return {
      ok: false,
      reason:
        'That folder is already a git repository that Control Tower did not create. ' +
        'Pick an empty folder — an autonomous agent must never be pointed at existing work.'
    }
  }
  return { ok: true }
}

/**
 * Build the child environment from an allowlist rather than passing the whole
 * of process.env through. Otherwise unrelated tokens in the user's shell leak
 * into a third-party CLI.
 */
const ENV_ALLOWLIST = [
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'TERM', 'TMPDIR', 'TZ',
  'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME',
  'SystemRoot', 'COMSPEC', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'PATHEXT'
]

export function buildChildEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const key of ENV_ALLOWLIST) {
    const value = process.env[key]
    if (value !== undefined) env[key] = value
  }
  // Long autonomous runs must never stop to draw a pager or an editor.
  env.PAGER = 'cat'
  env.GIT_PAGER = 'cat'
  env.GIT_TERMINAL_PROMPT = '0'
  env.CI = '1'
  return { ...env, ...(extra ?? {}) }
}
