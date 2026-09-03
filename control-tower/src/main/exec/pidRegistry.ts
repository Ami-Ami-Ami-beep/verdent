import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Records which agent process groups are alive right now.
 *
 * `before-quit` reaps them on an orderly exit, but a crash or a `kill -9` of the
 * app itself never gets that chance — and an orphaned agent tree keeps running,
 * editing files and holding ports with nothing left to stop it. So the pids go
 * to disk, and the next launch cleans up whatever the last one left behind.
 *
 * A module-level singleton is deliberate: live child processes are a property of
 * the OS process, not of any one object. It is inert until init() is called, so
 * tests and the verify flow are unaffected.
 */
class PidRegistry {
  private file: string | null = null
  private live = new Set<number>()

  init(file: string): void {
    this.file = file
    mkdirSync(dirname(file), { recursive: true })
  }

  add(pid: number): void {
    this.live.add(pid)
    this.flush()
  }

  remove(pid: number): void {
    this.live.delete(pid)
    this.flush()
  }

  /** Kills process groups recorded by a previous, non-exiting run of the app. */
  reapOrphans(): number[] {
    if (!this.file || !existsSync(this.file)) return []
    let recorded: number[] = []
    try {
      recorded = JSON.parse(readFileSync(this.file, 'utf8')) as number[]
    } catch {
      return []
    }

    const killed: number[] = []
    for (const pid of recorded) {
      if (!Number.isInteger(pid) || pid <= 1) continue
      try {
        // Signal 0 only tests for existence.
        process.kill(process.platform === 'win32' ? pid : -pid, 0)
      } catch {
        continue // already gone
      }
      try {
        process.kill(process.platform === 'win32' ? pid : -pid, 'SIGKILL')
        killed.push(pid)
      } catch {
        // Someone else's process now owns that pid; leave it alone.
      }
    }
    this.live.clear()
    this.flush()
    return killed
  }

  private flush(): void {
    if (!this.file) return
    try {
      writeFileSync(this.file, JSON.stringify([...this.live]), 'utf8')
    } catch {
      // Losing the pid file costs orphan cleanup, never the run itself.
    }
  }
}

export const pidRegistry = new PidRegistry()
