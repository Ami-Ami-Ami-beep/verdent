/** One line of a run's JSONL log file. */
export interface LogEvent {
  t: string
  runId: string
  projectId: string
  iter: number
  /** sys = orchestrator, out/err = raw child streams, evt = parsed stream-json. */
  ch: 'sys' | 'out' | 'err' | 'evt'
  level: 'debug' | 'info' | 'warn' | 'error'
  provider?: string
  msg: string
  data?: unknown
}
