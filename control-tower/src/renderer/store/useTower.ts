import { useCallback, useEffect, useRef, useState } from 'react'
import type { LogEvent } from '@shared/types/log'
import type { ProjectView, ProviderView } from '@shared/types/ipc'
import type { Run } from '@shared/types/run'

const MAX_LINES = 5_000

/**
 * A deliberately small store. Main-process events already arrive batched, so
 * the only job here is to fold them into state without re-rendering per line.
 */
export function useProjects() {
  const [projects, setProjects] = useState<ProjectView[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setProjects(await window.tower.listProjects())
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const offRun = window.tower.onRun((run: Run) => {
      setProjects((current) =>
        current.map((v) => (v.project.id === run.projectId ? { ...v, run } : v))
      )
    })
    const offIteration = window.tower.onIteration(() => void refresh())
    // A slow poll keeps task counts and commits fresh without a file watcher.
    const timer = setInterval(() => void refresh(), 5_000)
    return () => {
      offRun()
      offIteration()
      clearInterval(timer)
    }
  }, [refresh])

  return { projects, loading, refresh }
}

export function useProviders() {
  const [providers, setProviders] = useState<ProviderView[]>([])

  const refresh = useCallback(async () => {
    setProviders(await window.tower.listProviders())
  }, [])

  useEffect(() => {
    void refresh()
    return window.tower.onProviders((next: ProviderView[]) => setProviders(next))
  }, [refresh])

  return { providers, refresh, setProviders }
}

export function useRunLog(runId: string | undefined) {
  const [lines, setLines] = useState<LogEvent[]>([])
  const buffer = useRef<LogEvent[]>([])

  useEffect(() => {
    buffer.current = []
    setLines([])
    if (!runId) return

    void window.tower.recentLogs(runId).then((history) => {
      buffer.current = history
      setLines(history)
    })

    return window.tower.onLogs((batch: LogEvent[]) => {
      const mine = batch.filter((e) => e.runId === runId)
      if (mine.length === 0) return
      const next = [...buffer.current, ...mine]
      buffer.current = next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
      setLines(buffer.current)
    })
  }, [runId])

  return lines
}
