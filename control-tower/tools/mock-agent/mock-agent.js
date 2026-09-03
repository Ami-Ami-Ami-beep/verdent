#!/usr/bin/env node
/**
 * A fake coding agent, registered as an ordinary provider.
 *
 * It behaves the way a real one does — reads .tower/, ticks a task, writes a
 * file, appends a journal block and commits — but its behaviour per iteration
 * is driven by a scenario file, so the orchestrator can be exercised end to end
 * without spending a single token of anyone's subscription.
 *
 * Usage: mock-agent.js --prompt <text> --workdir <dir> --scenario <file.json>
 */
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

// --workdir is mandatory on purpose. Falling back to process.cwd() once let a
// stray invocation commit into whatever repository happened to be above it.
// A tool that runs `git commit` must never guess where it is.
const workdir = arg('workdir')
if (!workdir) {
  process.stderr.write('mock-agent: --workdir <dir> is required\n')
  process.exit(64)
}
const scenarioPath = arg('scenario')
const tower = path.join(workdir, '.tower')
// Kept OUTSIDE the project: a counter file inside it would show up as a
// change on every run and make even an idle iteration look like work.
const counterFile = path.join(
  os.tmpdir(),
  `control-tower-mock-${crypto.createHash('sha1').update(workdir).digest('hex').slice(0, 12)}`
)

const scenario = scenarioPath && fs.existsSync(scenarioPath)
  ? JSON.parse(fs.readFileSync(scenarioPath, 'utf8'))
  : { iterations: [{ behave: 'work' }] }

const n = Number(fs.existsSync(counterFile) ? fs.readFileSync(counterFile, 'utf8').trim() : '0')
fs.mkdirSync(tower, { recursive: true })
fs.writeFileSync(counterFile, String(n + 1))

const step = scenario.iterations[n] ?? scenario.iterations[scenario.iterations.length - 1] ?? { behave: 'work' }

function git(args) {
  execFileSync('git', args, { cwd: workdir, stdio: 'ignore' })
}

// Refuse to touch a repository whose root is not the workdir itself — the same
// guard the app applies, enforced again at the tool that does the committing.
function assertOwnRepo() {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: workdir,
    encoding: 'utf8'
  }).trim()
  if (path.resolve(root) !== path.resolve(workdir)) {
    process.stderr.write(`mock-agent: ${workdir} is not its own git repository (root is ${root})\n`)
    process.exit(65)
  }
}

function readTasks() {
  const file = path.join(tower, 'TASKS.md')
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

function seedTasks() {
  const lines = ['# Tasks', '']
  for (let i = 1; i <= 4; i++) {
    lines.push(`- [ ] T00${i} | todo | Mock task number ${i}`)
  }
  fs.writeFileSync(path.join(tower, 'TASKS.md'), `${lines.join('\n')}\n`)
  fs.writeFileSync(
    path.join(tower, 'PLAN.md'),
    '# Plan\n\nA mock plan.\n\n## Definition of done\n\n- All mock tasks are done.\n'
  )
}

/** Ticks the topmost open task, exactly the way a real agent is told to. */
function tickOneTask(markAll = false) {
  const raw = readTasks()
  let ticked = false
  const out = raw.split('\n').map((line) => {
    const m = line.match(/^- \[ \] (T\d{3,}) \| (todo|doing) \| (.+)$/)
    if (!m) return line
    if (ticked && !markAll) return line
    ticked = true
    return `- [x] ${m[1]} | done | ${m[3]}`
  })
  fs.writeFileSync(path.join(tower, 'TASKS.md'), out.join('\n'))
  return ticked
}

function journal(text) {
  fs.appendFileSync(
    path.join(tower, 'JOURNAL.md'),
    `\n## Iteration ${n + 1} — ${new Date().toISOString()} — provider: mock\n**Did:** ${text}\n**Next:** continue\n`
  )
}

function doWork(label) {
  assertOwnRepo()
  if (!fs.existsSync(path.join(tower, 'TASKS.md')) || readTasks().includes('_The planning iteration')) {
    seedTasks()
  }
  tickOneTask()
  fs.writeFileSync(path.join(workdir, `mock-${n + 1}.txt`), `${label}\n`)
  journal(label)
  git(['add', '-A'])
  git(['commit', '-q', '-m', `mock iteration ${n + 1}`])
}

switch (step.behave) {
  case 'quota':
    process.stderr.write(`${step.stderr || 'Error: usage limit reached. Resets at 2099-01-01T00:00:00Z'}\n`)
    process.exit(step.exit ?? 1)
    break

  case 'auth':
    process.stderr.write(`${step.stderr || 'Error: invalid api key'}\n`)
    process.exit(step.exit ?? 1)
    break

  case 'hang':
    // Never exits on its own: verifies the iteration timeout and the group kill.
    process.stdout.write('mock: hanging on purpose\n')
    setInterval(() => {}, 1000)
    break

  case 'hang_with_child': {
    // Real agents spawn npm, tsc, dev servers. This grandchild proves the whole
    // process GROUP is reaped, not just the process the app started.
    const { spawn } = require('node:child_process')
    const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
    if (step.pidFile) fs.writeFileSync(step.pidFile, String(grandchild.pid))
    process.stdout.write(`mock: spawned grandchild ${grandchild.pid}\n`)
    setInterval(() => {}, 1000)
    break
  }

  case 'fail':
    process.stdout.write('mock: build broke\n')
    process.stderr.write(`${step.stderr || 'error TS2304: cannot find name'}\n`)
    process.exit(step.exit ?? 2)
    break

  case 'nocommit':
    // Claims success without committing — the run loop must not believe it.
    process.stdout.write('mock: did lots of work, honest\n')
    process.exit(0)
    break

  case 'prose_trap':
    // The false-positive regression case: real work whose OUTPUT talks about
    // rate limits and 429s. This must be read as success, not exhaustion.
    doWork('implemented rate limiting')
    process.stdout.write(
      `${step.stdout || 'Implemented rate limit handling; 429 quota errors now retry with backoff.'}\n`
    )
    process.exit(step.exit ?? 0)
    break

  case 'complete':
    assertOwnRepo()
    if (!fs.existsSync(path.join(tower, 'TASKS.md'))) seedTasks()
    tickOneTask(true)
    fs.writeFileSync(path.join(workdir, 'mock-final.txt'), 'done\n')
    journal('finished everything')
    git(['add', '-A'])
    git(['commit', '-q', '-m', `mock iteration ${n + 1} (final)`])
    process.stdout.write('All acceptance criteria are met.\nPROJECT_COMPLETE\n')
    process.exit(0)
    break

  case 'work':
  default: {
    const ms = step.durationMs ?? 50
    const finish = () => {
      doWork(step.label || 'did one unit of work')
      process.stdout.write(`mock: completed iteration ${n + 1}\n`)
      process.exit(0)
    }
    if (ms > 0) setTimeout(finish, ms)
    else finish()
  }
}
