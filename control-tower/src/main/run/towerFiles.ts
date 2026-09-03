import { existsSync } from 'node:fs'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Project } from '@shared/types/project'
import { humanDuration } from '@shared/budget'
import { parseTasks } from '@shared/tasks'
import type { TaskSummary } from '@shared/types/project'

/**
 * `.tower/` is the shared memory between the orchestrator and every agent that
 * takes a turn on a project — including agents from different vendors that
 * share no conversation history whatsoever.
 *
 * Ownership is strict, because it is what keeps writes from racing:
 *   BRIEF.md    written once by the app, read-only for agents
 *   PLAN.md     the agent's, from the planning iteration on
 *   TASKS.md    the agent's alone; the app only ever parses it
 *   JOURNAL.md  the agent's, append-only (the app appends only failure notes)
 *   STATE.json  the app's alone; agents read it
 */
export const TOWER_DIR = '.tower'

export const towerPath = (workdir: string, file: string): string => join(workdir, TOWER_DIR, file)

export interface TowerState {
  schema: number
  runId: string
  iteration: number
  lastProvider?: string
  lastOutcome?: string
  budget: { totalMs: number; usedMs: number; remainingMs: number; remainingHuman: string }
  consecutiveFailures: number
  updatedAt: string
}

export async function bootstrap(project: Project): Promise<void> {
  await mkdir(join(project.workdir, TOWER_DIR), { recursive: true })

  const brief = towerPath(project.workdir, 'BRIEF.md')
  if (!existsSync(brief)) {
    await writeFile(brief, renderBrief(project), 'utf8')
  }
  for (const [file, seed] of [
    ['PLAN.md', '# Plan\n\n_Not written yet. The planning iteration creates this file._\n'],
    ['TASKS.md', TASKS_SEED],
    ['JOURNAL.md', '# Journal\n\n## Summary\n\n_Nothing yet._\n']
  ] as const) {
    const path = towerPath(project.workdir, file)
    if (!existsSync(path)) await writeFile(path, seed, 'utf8')
  }
}

const TASKS_SEED = `# Tasks

One task per line, in exactly this format — the orchestrator parses it:

    - [ ] T001 | todo | Short imperative description

Status is one of: todo | doing | done | blocked.
Task IDs are stable and are never reused.

_The planning iteration replaces this file with the real work breakdown._
`

function renderBrief(project: Project): string {
  return `# Brief

**Project:** ${project.name}
**Time budget:** ${humanDuration(project.budgetMs)}
**Created:** ${project.createdAt}

## What the user asked for

${project.brief.trim()}

---

_This file is written once and is authoritative. Do not edit it._
`
}

export async function readTower(workdir: string): Promise<{
  brief: string
  plan: string
  tasks: TaskSummary
  tasksRaw: string
  journal: string
}> {
  const [brief, plan, tasksRaw, journal] = await Promise.all([
    safeRead(towerPath(workdir, 'BRIEF.md')),
    safeRead(towerPath(workdir, 'PLAN.md')),
    safeRead(towerPath(workdir, 'TASKS.md')),
    safeRead(towerPath(workdir, 'JOURNAL.md'))
  ])
  return { brief, plan, tasksRaw, tasks: parseTasks(tasksRaw), journal }
}

async function safeRead(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return ''
  }
}

export async function writeState(workdir: string, state: TowerState): Promise<void> {
  await mkdir(join(workdir, TOWER_DIR), { recursive: true })
  await writeFile(towerPath(workdir, 'STATE.json'), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

/**
 * The agent owns the journal, but when an iteration dies without writing one,
 * the next agent would otherwise see an unexplained gap. A clearly attributed
 * orchestrator note is better than silence.
 */
export async function appendOrchestratorNote(
  workdir: string,
  note: { iteration: number; provider: string; outcome: string; detail: string }
): Promise<void> {
  const block = [
    '',
    `## Iteration ${note.iteration} — ${new Date().toISOString()} — provider: ${note.provider}`,
    `**Written by:** Control Tower (the agent did not finish this iteration)`,
    `**Outcome:** ${note.outcome}`,
    `**Detail:** ${note.detail.slice(0, 600) || '(no output captured)'}`,
    ''
  ].join('\n')
  await appendFile(towerPath(workdir, 'JOURNAL.md'), block, 'utf8').catch(() => undefined)
}

/**
 * Feed only the tail of the journal into a prompt. The full history stays in
 * git; pushing all of it into every prompt would crowd out the actual task.
 */
export function journalTail(journal: string, blocks = 5): string {
  const parts = journal.split(/^## /m)
  if (parts.length <= 1) return journal.trim().slice(0, 4_000)
  const summary = parts[0]?.trim() ?? ''
  const recent = parts
    .slice(1)
    .slice(-blocks)
    .map((p) => `## ${p.trim()}`)
    .join('\n\n')
  return [summary, recent].filter(Boolean).join('\n\n').slice(0, 8_000)
}
