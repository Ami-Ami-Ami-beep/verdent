/**
 * Everything about how a CLI is invoked lives here as *data*, not code.
 * Specs are stored as JSON in userData so a wrong flag can be corrected in
 * Settings without rebuilding the app.
 */

/** How a provider run ended, after classification. */
export type FailureClass =
  | 'success'
  | 'quota_exhausted'
  | 'auth_error'
  | 'transient'
  | 'task_failure'
  | 'timeout'
  | 'killed'

export type PermissionMode = 'allowlist' | 'full'

export interface FailureDetectionSpec {
  /** Exit codes that unambiguously mean "out of quota", if the CLI has any. */
  quotaExitCodes: number[]
  /** Matched ONLY against the error channel — never against assistant prose. */
  quotaPatterns: string[]
  authPatterns: string[]
  transientPatterns: string[]
  /** Each pattern should expose one capture group holding a parseable reset time. */
  resetTimePatterns: string[]
  /**
   * A run longer than this that also used tools is not a quota rejection.
   * Quota errors come back in seconds.
   */
  quotaMaxRuntimeMs: number
}

export interface ProviderSpec {
  id: string
  label: string
  enabled: boolean
  /** Bare name (resolved via PATH) or an absolute path. */
  command: string
  /**
   * argv template. Placeholders are substituted as whole argv entries — never
   * concatenated into a shell string. No shell is ever used.
   *   {{PROMPT}} {{WORKDIR}} {{SESSION_ID}} {{MODEL}}
   */
  argvFresh: string[]
  /** Used only when supportsResume is true and a session id exists. */
  argvResume?: string[]
  promptDelivery: 'argv' | 'stdin' | 'file'
  supportsResume: boolean
  supportsStreamJson: boolean
  /** Extra argv appended when the project runs in 'allowlist' permission mode. */
  allowedToolsArgs?: string[]
  /** Extra argv appended when the project runs in 'full' permission mode. */
  fullAutoArgs?: string[]
  model?: string
  env?: Record<string, string>
  detection: FailureDetectionSpec
  /** Per-provider concurrency across ALL projects. 1 for subscription CLIs. */
  maxConcurrent: number
  costHint?: 'subscription' | 'free' | 'metered'
  /** Set by the "Verify" flow. An unverified provider cannot be started. */
  verified?: { at: string; version: string } | null
}

export type ProviderStatus = 'available' | 'cooling' | 'probation' | 'disabled'

export interface ProviderRuntimeState {
  providerId: string
  status: ProviderStatus
  /** ISO timestamp. Persisted, so cooldowns survive an app restart. */
  cooldownUntil?: string
  /** Drives exponential backoff. */
  consecutiveQuotaHits: number
  /** Rate-limits probation probes to one per provider per 15 min. */
  lastProbeAt?: string
  lastFailure?: { class: FailureClass; at: string; excerpt: string }
  activeLeases: number
}
