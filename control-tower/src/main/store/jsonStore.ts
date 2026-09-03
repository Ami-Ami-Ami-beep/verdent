import { existsSync } from 'node:fs'
import { copyFile, mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * A tiny durable JSON store. Deliberately not SQLite: the data is a few dozen
 * projects, the main process is the only writer, and hand-editable files match
 * the "provider specs are editable data" line the rest of the app takes.
 *
 * Writes are temp-file -> fsync -> rename, which is atomic on POSIX, so a crash
 * mid-write can never leave a half-written file behind. The previous version is
 * kept as `.bak` for the one case rename cannot cover: corrupt *content*.
 */
export class JsonStore<T extends object> {
  private queue: Promise<void> = Promise.resolve()
  private cache: T | null = null

  constructor(
    private readonly file: string,
    private readonly fallback: () => T
  ) {}

  async read(): Promise<T> {
    if (this.cache) return this.cache
    for (const candidate of [this.file, `${this.file}.bak`]) {
      if (!existsSync(candidate)) continue
      try {
        const parsed = JSON.parse(await readFile(candidate, 'utf8')) as T
        this.cache = parsed
        return parsed
      } catch {
        // Fall through to the backup, then to the fallback value.
      }
    }
    this.cache = this.fallback()
    return this.cache
  }

  /** Serialised through a promise chain so two callers cannot interleave writes. */
  async write(value: T): Promise<void> {
    this.cache = value
    const run = this.queue.then(() => this.persist(value))
    this.queue = run.catch(() => undefined)
    return run
  }

  async update(fn: (current: T) => T): Promise<T> {
    const next = fn(await this.read())
    await this.write(next)
    return next
  }

  private async persist(value: T): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    const tmp = join(dirname(this.file), `.${Date.now()}.${process.pid}.tmp`)
    const body = `${JSON.stringify(value, null, 2)}\n`

    const handle = await open(tmp, 'w')
    try {
      await handle.writeFile(body, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }

    if (existsSync(this.file)) {
      try {
        await copyFile(this.file, `${this.file}.bak`)
      } catch {
        // A missing backup is not worth failing the write for.
      }
    }
    try {
      await rename(tmp, this.file)
    } catch (err) {
      await unlink(tmp).catch(() => undefined)
      throw err
    }
  }
}
