import type { LogEvent } from '@shared/types/log'

const RING_SIZE = 2_000
const FLUSH_MS = 100

/**
 * Holds recent events per run and pushes them to the renderer in batches.
 *
 * Batching is not a nicety: a chatty stream-json provider emits hundreds of
 * events a second, and one IPC message per event locks up the UI thread.
 */
export class LogTailer {
  private rings = new Map<string, LogEvent[]>()
  private pending: LogEvent[] = []
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly emit: (batch: LogEvent[]) => void) {}

  push(event: LogEvent): void {
    const ring = this.rings.get(event.runId) ?? []
    ring.push(event)
    if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE)
    this.rings.set(event.runId, ring)

    this.pending.push(event)
    if (this.timer) return
    this.timer = setTimeout(() => {
      const batch = this.pending
      this.pending = []
      this.timer = null
      if (batch.length > 0) this.emit(batch)
    }, FLUSH_MS)
    this.timer.unref?.()
  }

  /** Recent history, so opening a project detail view is instant. */
  recent(runId: string): LogEvent[] {
    return this.rings.get(runId) ?? []
  }

  forget(runId: string): void {
    this.rings.delete(runId)
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const batch = this.pending
    this.pending = []
    if (batch.length > 0) this.emit(batch)
  }
}
