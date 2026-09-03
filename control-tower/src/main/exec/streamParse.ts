/**
 * Splits a provider's output into the two things the app needs from it:
 * readable prose for the log, and an *error channel* for the classifier.
 *
 * Keeping those apart is the whole defence against a false quota verdict: an
 * agent implementing rate limiting will happily print "429" and "quota" in its
 * normal output, and that text must never reach the classifier.
 */

export interface ParsedStream {
  /** Text the classifier is allowed to see. */
  errorChannel: string
  /** Human-readable lines for the log view. */
  pretty: string[]
  /** True when the provider structurally reported failure. */
  structuredError: boolean
  /** True when the agent actually did something — drives the fail-fast rule. */
  hadToolActivity: boolean
  /** Native session id, when the provider reports one (enables warm resume). */
  sessionId?: string
  /** Set when the agent declared the project finished. */
  projectComplete: boolean
}

const COMPLETION_MARKER = 'PROJECT_COMPLETE'

export function createStreamParser(supportsStreamJson: boolean) {
  const state: ParsedStream = {
    errorChannel: '',
    pretty: [],
    structuredError: false,
    hadToolActivity: false,
    projectComplete: false
  }
  const errorParts: string[] = []

  function addError(text: string): void {
    if (text.trim()) errorParts.push(text.trim())
  }

  function pushPretty(line: string): void {
    state.pretty.push(line)
  }

  return {
    /** stdout is prose by default; only structured error fields are promoted. */
    stdoutLine(line: string): string {
      if (!line.trim()) return ''
      if (line.includes(COMPLETION_MARKER)) state.projectComplete = true

      if (!supportsStreamJson) {
        pushPretty(line)
        return line
      }

      let event: Record<string, unknown>
      try {
        event = JSON.parse(line) as Record<string, unknown>
      } catch {
        // Not JSON: a CLI warning or banner. Prose, so it stays out of the
        // error channel.
        pushPretty(line)
        return line
      }

      const type = String(event.type ?? '')
      if (typeof event.session_id === 'string') state.sessionId = event.session_id

      if (type === 'system' || type === 'error') {
        const text = typeof event.message === 'string' ? event.message : JSON.stringify(event)
        if (type === 'error') addError(text)
        pushPretty(`[${type}] ${text}`)
        return text
      }

      if (type === 'assistant' || type === 'user') {
        const text = extractText(event)
        if (containsToolUse(event)) state.hadToolActivity = true
        if (text) pushPretty(text)
        return text
      }

      if (type === 'result') {
        if (event.is_error === true) {
          state.structuredError = true
          addError(typeof event.result === 'string' ? event.result : JSON.stringify(event))
        }
        const summary = typeof event.result === 'string' ? event.result : ''
        if (summary.includes(COMPLETION_MARKER)) state.projectComplete = true
        pushPretty(`[result] ${summary.slice(0, 400)}`)
        return summary
      }

      pushPretty(line)
      return line
    },

    /**
     * stderr is the error channel for providers without structured output.
     * Agent prose overwhelmingly goes to stdout, so this stays clean.
     */
    stderrLine(line: string): string {
      if (!line.trim()) return ''
      addError(line)
      pushPretty(line)
      return line
    },

    markToolActivity(): void {
      state.hadToolActivity = true
    },

    finish(): ParsedStream {
      // Only the tail can matter to the classifier, and it bounds memory too.
      state.errorChannel = errorParts.join('\n').slice(-16 * 1024)
      return state
    }
  }
}

function extractText(event: Record<string, unknown>): string {
  const message = event.message as { content?: unknown } | undefined
  const content = message?.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (block && typeof block === 'object') {
      const b = block as Record<string, unknown>
      if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
      if (b.type === 'tool_use' && typeof b.name === 'string') parts.push(`→ ${b.name}`)
    }
  }
  return parts.join('\n')
}

function containsToolUse(event: Record<string, unknown>): boolean {
  const message = event.message as { content?: unknown } | undefined
  const content = message?.content
  if (!Array.isArray(content)) return false
  return content.some(
    (b) => b && typeof b === 'object' && ['tool_use', 'tool_result'].includes(String((b as Record<string, unknown>).type))
  )
}
