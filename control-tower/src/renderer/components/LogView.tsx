import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { LogEvent } from '@shared/types/log'

type Filter = 'all' | 'sys' | 'out' | 'err'

/**
 * Renders only the slice of the log that is on screen. A ten-hour run produces
 * far more lines than the DOM can hold, and the interesting ones are at the
 * bottom, so the default is to follow the tail.
 */
const ROW_HEIGHT = 18
const OVERSCAN = 30

export function LogView({ lines }: { lines: LogEvent[] }): JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const [follow, setFollow] = useState(true)
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(600)
  const ref = useRef<HTMLDivElement>(null)

  const visible = filter === 'all' ? lines : lines.filter((l) => l.ch === filter)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => setHeight(el.clientHeight))
    observer.observe(el)
    setHeight(el.clientHeight)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (el && follow) el.scrollTop = el.scrollHeight
  }, [visible.length, follow])

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const count = Math.ceil(height / ROW_HEIGHT) + OVERSCAN * 2
  const slice = visible.slice(first, first + count)

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        {(['all', 'sys', 'out', 'err'] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'active' : 'ghost'} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
        <span className="spacer" />
        <label className="checkbox small" style={{ marginBottom: 0 }}>
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          <span>follow</span>
        </label>
        <span className="small muted">{visible.length} lines</span>
      </div>

      <div
        className="logview"
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget
          setScrollTop(el.scrollTop)
          // Scrolling away from the bottom means the user is reading history.
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
          if (atBottom !== follow) setFollow(atBottom)
        }}
      >
        <div style={{ height: visible.length * ROW_HEIGHT, position: 'relative' }}>
          <div style={{ position: 'absolute', top: first * ROW_HEIGHT, left: 0, right: 0 }}>
            {slice.map((line, i) => (
              <div
                key={first + i}
                className={`logline ${line.ch} ${line.level}`}
                style={{ minHeight: ROW_HEIGHT }}
              >
                <span className="muted">{new Date(line.t).toLocaleTimeString()} </span>
                {line.provider ? <span className="muted">[{line.provider}] </span> : null}
                {line.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
