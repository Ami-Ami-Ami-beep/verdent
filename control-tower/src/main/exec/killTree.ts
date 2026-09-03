import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'

/**
 * Agent CLIs spawn their own children — npm, tsc, dev servers. Killing only the
 * direct child orphans that tree, which then keeps running, holds ports and
 * burns CPU long after the user pressed Stop. So every child is started as its
 * own process-group leader (`detached: true`) and the whole group is signalled
 * via the negative pid.
 */
const GRACE_MS = 5_000

export function killTree(child: ChildProcess, graceMs = GRACE_MS): void {
  const pid = child.pid
  if (pid === undefined || child.exitCode !== null || child.signalCode !== null) return

  if (process.platform === 'win32') {
    // Windows has no process groups; taskkill /T walks the tree instead.
    try {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
    } catch {
      child.kill('SIGKILL')
    }
    return
  }

  const signalGroup = (signal: NodeJS.Signals): boolean => {
    try {
      process.kill(-pid, signal)
      return true
    } catch {
      // The group may already be gone, or was never created (spawn failed).
      try {
        child.kill(signal)
      } catch {
        /* already dead */
      }
      return false
    }
  }

  signalGroup('SIGTERM')
  const timer = setTimeout(() => signalGroup('SIGKILL'), graceMs)
  // Do not let the grace timer keep the app alive on quit.
  timer.unref?.()
  child.once('exit', () => clearTimeout(timer))
}
