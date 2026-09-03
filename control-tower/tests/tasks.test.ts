import { describe, expect, it } from 'vitest'
import { openTasks, parseTasks, renderOpenTasks } from '@shared/tasks'

const sample = `# Tasks

- [ ] T001 | todo    | Scaffold Vite + React + TS
- [x] T002 | done    | Implement the data model
- [ ] T003 | doing   | Wire the view to the model
- [ ] T004 | blocked | Publish to TestFlight (needs Apple credentials)

Some prose the agent wrote.
- [ ] not a task line at all
`

describe('parseTasks', () => {
  it('parses the strict line format', () => {
    const s = parseTasks(sample)
    expect(s.total).toBe(4)
    expect(s.done).toBe(1)
    expect(s.blocked).toBe(1)
    expect(s.open).toBe(2)
    expect(s.tasks[0]?.id).toBe('T001')
    expect(s.tasks[2]?.status).toBe('doing')
  })

  it('counts but never rewrites malformed checkbox lines', () => {
    expect(parseTasks(sample).unparsed).toBe(1)
  })

  it('ignores prose entirely', () => {
    expect(parseTasks('just some notes\nand more notes').total).toBe(0)
  })

  it('excludes blocked tasks from the open set, so they cannot stall a run', () => {
    const open = openTasks(parseTasks(sample))
    expect(open.map((t) => t.id)).toEqual(['T001', 'T003'])
  })

  it('renders open tasks for the prompt', () => {
    expect(renderOpenTasks(parseTasks(sample))).toContain('T001 [todo]')
    expect(renderOpenTasks(parseTasks('- [x] T001 | done | all finished'))).toContain('none')
  })
})
