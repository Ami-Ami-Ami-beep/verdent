/**
 * Per-provider concurrency across every project.
 *
 * Worth being honest about what this buys: serialising two projects on the same
 * subscription does NOT save quota — the same work costs the same tokens. What
 * it buys is no simultaneous burst that trips one rate limit for both runs,
 * deterministic failover instead of two racing runs, and one project degrading
 * to the next provider while the other keeps the good one.
 */
export class LeasePool {
  private active = new Map<string, number>()
  private waiters = new Map<string, Array<() => void>>()

  constructor(private limits: Map<string, number>) {}

  setLimits(limits: Map<string, number>): void {
    this.limits = limits
  }

  private limit(id: string): number {
    return Math.max(1, this.limits.get(id) ?? 1)
  }

  activeCount(id: string): number {
    return this.active.get(id) ?? 0
  }

  hasFree(id: string): boolean {
    return this.activeCount(id) < this.limit(id)
  }

  tryAcquire(id: string): (() => void) | null {
    if (!this.hasFree(id)) return null
    this.active.set(id, this.activeCount(id) + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      this.active.set(id, Math.max(0, this.activeCount(id) - 1))
      const queue = this.waiters.get(id)
      const next = queue?.shift()
      if (next) next()
    }
  }

  /** Waits up to `timeoutMs` for a slot; resolves null when the wait expires. */
  async acquire(id: string, timeoutMs: number): Promise<(() => void) | null> {
    const immediate = this.tryAcquire(id)
    if (immediate) return immediate

    return await new Promise<(() => void) | null>((resolve) => {
      let done = false
      const timer = setTimeout(() => {
        if (done) return
        done = true
        const queue = this.waiters.get(id)
        if (queue) this.waiters.set(id, queue.filter((w) => w !== wake))
        resolve(null)
      }, timeoutMs)

      const wake = (): void => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve(this.tryAcquire(id))
      }

      const queue = this.waiters.get(id) ?? []
      queue.push(wake)
      this.waiters.set(id, queue)
    })
  }
}
