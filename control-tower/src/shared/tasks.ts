import type { TaskLine, TaskStatus, TaskSummary } from './types/project'

/**
 * TASKS.md is the contract between the orchestrator and every agent that takes
 * a turn on a project. The app only ever *reads* it — writes belong to the
 * agent alone, which is what keeps the two from racing on the same file.
 *
 *   - [ ] T001 | todo    | Scaffold the project
 *   - [x] T002 | done    | Implement the data model
 */
const TASK_LINE = /^-\s\[([ xX])\]\s+(T\d{3,})\s*\|\s*(todo|doing|done|blocked)\s*\|\s*(.+?)\s*$/

export function parseTasks(markdown: string): TaskSummary {
  const tasks: TaskLine[] = []
  let unparsed = 0

  const lines = markdown.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const m = line.match(TASK_LINE)
    if (!m) {
      // Anything that is not a task line is prose or a malformed entry. Both are
      // left exactly as they are; we simply do not count them.
      if (/^-\s\[[ xX]\]/.test(line)) unparsed++
      continue
    }
    tasks.push({
      checked: (m[1] ?? '').toLowerCase() === 'x',
      id: m[2] as string,
      status: m[3] as TaskStatus,
      title: m[4] as string,
      lineNo: i + 1
    })
  }

  const done = tasks.filter((t) => t.status === 'done').length
  const blocked = tasks.filter((t) => t.status === 'blocked').length
  return {
    tasks,
    total: tasks.length,
    done,
    blocked,
    // A blocked task cannot be worked on, so it does not keep the run alive.
    open: tasks.length - done - blocked,
    unparsed
  }
}

/** The tasks an agent should consider picking up next, in file order. */
export function openTasks(summary: TaskSummary): TaskLine[] {
  return summary.tasks.filter((t) => t.status === 'todo' || t.status === 'doing')
}

export function renderOpenTasks(summary: TaskSummary, limit = 12): string {
  const open = openTasks(summary).slice(0, limit)
  if (open.length === 0) return '(none — every task is done or blocked)'
  return open.map((t) => `- ${t.id} [${t.status}] ${t.title}`).join('\n')
}
