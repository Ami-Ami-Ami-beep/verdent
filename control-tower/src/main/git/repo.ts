import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { buildChildEnv } from '../safety/guards'

const run = promisify(execFile)

/** Field separator for `git log` output; safe because it cannot appear in a subject. */
const SEP = '\x1f'

/**
 * Git is the undo buffer for the whole system. Every iteration ends in a commit,
 * so a run that goes wrong can always be walked back — and so the next agent,
 * possibly a different vendor's model, inherits a clean, inspectable state.
 */
async function git(workdir: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, {
    cwd: workdir,
    env: buildChildEnv(),
    maxBuffer: 8 * 1024 * 1024
  })
  return stdout.trim()
}

export async function initRepo(workdir: string): Promise<void> {
  await git(workdir, ['init', '-q'])
  // A fresh machine often has no global identity configured; commits would fail.
  await git(workdir, ['config', 'user.name', 'Control Tower']).catch(() => undefined)
  await git(workdir, ['config', 'user.email', 'control-tower@localhost']).catch(() => undefined)
  await assertOwnRepo(workdir)
}

/**
 * Refuses to proceed unless the workdir is the ROOT of its own repository.
 *
 * If it were merely a directory inside someone else's repo, every `git add -A`
 * an agent runs would sweep up that whole repository instead — committing the
 * user's unrelated work under an agent's name. `git init` should make this
 * impossible; checking it is far cheaper than the failure it prevents.
 */
export async function assertOwnRepo(workdir: string): Promise<void> {
  const root = await git(workdir, ['rev-parse', '--show-toplevel'])
  if (resolve(root) !== resolve(workdir)) {
    throw new Error(
      `${workdir} is not the root of its own git repository (root is ${root}). ` +
        'Refusing to run an agent there — a commit would sweep up the surrounding repository.'
    )
  }
}

export async function isRepo(workdir: string): Promise<boolean> {
  try {
    return (await git(workdir, ['rev-parse', '--is-inside-work-tree'])) === 'true'
  } catch {
    return false
  }
}

export async function headSha(workdir: string): Promise<string | undefined> {
  try {
    return await git(workdir, ['rev-parse', 'HEAD'])
  } catch {
    return undefined // no commits yet
  }
}

export async function hasChanges(workdir: string): Promise<boolean> {
  return (await git(workdir, ['status', '--porcelain'])).length > 0
}

/**
 * Commits whatever the agent left behind. Returns undefined when there was
 * nothing to commit — which the run loop treats as a failed iteration, because
 * work that is not committed does not exist.
 */
export async function commitAll(workdir: string, message: string): Promise<string | undefined> {
  if (!(await hasChanges(workdir))) return undefined
  await git(workdir, ['add', '-A'])
  await git(workdir, ['commit', '-q', '-m', message])
  return await headSha(workdir)
}

export async function tagIteration(workdir: string, n: number): Promise<void> {
  await git(workdir, ['tag', '-f', `tower/iter-${n}`]).catch(() => undefined)
}

export interface CommitInfo {
  sha: string
  subject: string
  at: string
}

export async function recentCommits(workdir: string, limit = 30): Promise<CommitInfo[]> {
  try {
    const format = ['%h', '%s', '%cI'].join(SEP)
    const out = await git(workdir, ['log', `-${limit}`, `--pretty=format:${format}`])
    if (!out) return []
    return out.split('\n').map((line) => {
      const [sha = '', subject = '', at = ''] = line.split(SEP)
      return { sha, subject, at }
    })
  } catch {
    return []
  }
}
