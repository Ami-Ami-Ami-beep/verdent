import { createWriteStream, existsSync, type WriteStream } from 'node:fs'
import { mkdir, rename, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { LogEvent } from '@shared/types/log'

const ROTATE_BYTES = 50 * 1024 * 1024

/**
 * One append stream per run. Deliberately not writeFile: re-serialising a
 * growing log on every event would dominate the cost of a long autonomous run.
 */
export class RunLogWriter {
  private stream: WriteStream | null = null
  private bytes = 0

  constructor(private readonly file: string) {}

  private async ensure(): Promise<WriteStream> {
    if (this.stream) return this.stream
    await mkdir(dirname(this.file), { recursive: true })
    if (existsSync(this.file)) this.bytes = (await stat(this.file)).size
    this.stream = createWriteStream(this.file, { flags: 'a' })
    return this.stream
  }

  async append(event: LogEvent): Promise<void> {
    const stream = await this.ensure()
    const line = `${JSON.stringify(event)}\n`
    this.bytes += Buffer.byteLength(line)
    stream.write(line)
    if (this.bytes > ROTATE_BYTES) await this.rotate()
  }

  private async rotate(): Promise<void> {
    await this.close()
    await rename(this.file, join(dirname(this.file), `${Date.now()}-rotated.jsonl`)).catch(() => undefined)
    this.bytes = 0
  }

  async close(): Promise<void> {
    const stream = this.stream
    this.stream = null
    if (!stream) return
    await new Promise<void>((resolve) => stream.end(resolve))
  }
}
