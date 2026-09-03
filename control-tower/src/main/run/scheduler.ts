/**
 * Global cap on how many projects run at once. A project holds its slot for the
 * whole run, not per iteration — otherwise a long project would be repeatedly
 * elbowed aside by shorter ones and never finish.
 */
export class Scheduler {
  private active = new Set<string>()
  private queue: string[] = []

  constructor(private limit: number) {}

  setLimit(limit: number): void {
    this.limit = Math.max(1, limit)
  }

  get activeIds(): string[] {
    return [...this.active]
  }

  get queuedIds(): string[] {
    return [...this.queue]
  }

  get slots(): { used: number; total: number } {
    return { used: this.active.size, total: this.limit }
  }

  /** True when the project may start now; false when it was queued instead. */
  request(projectId: string): boolean {
    if (this.active.has(projectId)) return true
    if (this.active.size < this.limit) {
      this.active.add(projectId)
      return true
    }
    if (!this.queue.includes(projectId)) this.queue.push(projectId)
    return false
  }

  /** Releases a slot and returns the next queued project, if any. */
  release(projectId: string): string | undefined {
    this.active.delete(projectId)
    this.queue = this.queue.filter((id) => id !== projectId)
    const next = this.queue.shift()
    if (next) this.active.add(next)
    return next
  }

  cancel(projectId: string): void {
    this.queue = this.queue.filter((id) => id !== projectId)
  }
}
