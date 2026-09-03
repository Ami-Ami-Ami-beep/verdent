import React, { useState } from 'react'
import type { ProviderView, VerifyReport } from '@shared/types/ipc'
import type { ProviderSpec } from '@shared/types/provider'
import type { Settings } from '@shared/types/settings'

export function SettingsScreen({
  settings,
  providers,
  onSettings,
  onProviders
}: {
  settings: Settings
  providers: ProviderView[]
  onSettings: (next: Settings) => void
  onProviders: (next: ProviderView[]) => void
}): JSX.Element {
  const [draft, setDraft] = useState<Settings>(settings)
  const [saved, setSaved] = useState(false)

  const save = async (next: Settings): Promise<void> => {
    setDraft(next)
    onSettings(await window.tower.saveSettings(next))
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const move = (id: string, delta: number): void => {
    const chain = [...draft.providerChain]
    const from = chain.indexOf(id)
    const to = from + delta
    if (from < 0 || to < 0 || to >= chain.length) return
    chain.splice(to, 0, ...chain.splice(from, 1))
    void save({ ...draft, providerChain: chain })
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="card">
        <h2>Provider chain</h2>
        <p className="small muted">
          The first available provider is used. When it runs out of quota the next one takes over,
          and the preferred one is picked up again automatically once its limit resets.
        </p>
        {draft.providerChain.map((id, i) => {
          const view = providers.find((p) => p.spec.id === id)
          return (
            <div className="row" key={id} style={{ padding: '5px 0' }}>
              <span className="muted mono">{i + 1}.</span>
              <strong>{view?.spec.label ?? id}</strong>
              {view && <span className={`dot ${view.state.status}`} />}
              <span className="muted small">{view?.state.status ?? 'unknown'}</span>
              {view && !view.spec.verified && <span className="pill queued">unverified</span>}
              <span className="spacer" />
              <button className="ghost" onClick={() => move(id, -1)} disabled={i === 0}>
                ↑
              </button>
              <button className="ghost" onClick={() => move(id, 1)} disabled={i === draft.providerChain.length - 1}>
                ↓
              </button>
              <button
                className="ghost danger"
                onClick={() => void save({ ...draft, providerChain: draft.providerChain.filter((c) => c !== id) })}
              >
                ✕
              </button>
            </div>
          )
        })}
        <div className="row" style={{ marginTop: 8 }}>
          {providers
            .filter((p) => !draft.providerChain.includes(p.spec.id))
            .map((p) => (
              <button
                key={p.spec.id}
                className="ghost"
                onClick={() => void save({ ...draft, providerChain: [...draft.providerChain, p.spec.id] })}
              >
                + {p.spec.label}
              </button>
            ))}
        </div>
      </div>

      <div className="card">
        <h2>Running</h2>
        <div className="grid2">
          <label>
            <span className="lbl">Projects in parallel</span>
            <input
              type="number"
              min={1}
              max={8}
              value={draft.maxParallelProjects}
              onChange={(e) => void save({ ...draft, maxParallelProjects: Number(e.target.value) })}
            />
          </label>
          <label>
            <span className="lbl">When a provider is busy</span>
            <select
              value={draft.providerContention}
              onChange={(e) =>
                void save({ ...draft, providerContention: e.target.value as 'failover' | 'wait' })
              }
            >
              <option value="failover">Move to the next provider</option>
              <option value="wait">Wait for it to free up</option>
            </select>
          </label>
          <label>
            <span className="lbl">Iteration timeout (minutes)</span>
            <input
              type="number"
              min={1}
              value={Math.round(draft.iterationTimeoutMs / 60_000)}
              onChange={(e) => void save({ ...draft, iterationTimeoutMs: Number(e.target.value) * 60_000 })}
            />
          </label>
          <label>
            <span className="lbl">Review iteration every N</span>
            <input
              type="number"
              min={0}
              value={draft.reviewEvery}
              onChange={(e) => void save({ ...draft, reviewEvery: Number(e.target.value) })}
            />
          </label>
          <label>
            <span className="lbl">Projects root</span>
            <div className="row">
              <input
                value={draft.projectsRoot}
                onChange={(e) => setDraft({ ...draft, projectsRoot: e.target.value })}
                onBlur={() => void save(draft)}
              />
              <button
                onClick={async () => {
                  const chosen = await window.tower.chooseDirectory()
                  if (chosen) void save({ ...draft, projectsRoot: chosen })
                }}
              >
                Browse…
              </button>
            </div>
          </label>
          <label>
            <span className="lbl">Stop after N failed iterations in a row</span>
            <input
              type="number"
              min={1}
              value={draft.maxConsecutiveFailures}
              onChange={(e) => void save({ ...draft, maxConsecutiveFailures: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className="small muted">
          Serialising two projects on one subscription does not save quota — the same work costs the
          same tokens. What it buys is one predictable failover instead of two runs racing into the
          same rate limit, so one project keeps the good provider while the other steps down.
        </p>
        {saved && <span className="small" style={{ color: 'var(--ok)' }}>Saved.</span>}
      </div>

      {providers.map((view) => (
        <ProviderEditor key={view.spec.id} view={view} onProviders={onProviders} />
      ))}
    </div>
  )
}

function ProviderEditor({
  view,
  onProviders
}: {
  view: ProviderView
  onProviders: (next: ProviderView[]) => void
}): JSX.Element {
  const [spec, setSpec] = useState<ProviderSpec>(view.spec)
  const [report, setReport] = useState<VerifyReport | null>(null)
  const [sample, setSample] = useState('')
  const [verdict, setVerdict] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const patch = (p: Partial<ProviderSpec>): void => setSpec({ ...spec, ...p })

  const save = async (): Promise<void> => {
    onProviders(await window.tower.saveProvider(spec))
  }

  const verify = async (): Promise<void> => {
    setBusy(true)
    await window.tower.saveProvider(spec)
    const result = await window.tower.verifyProvider(spec.id)
    setReport(result)
    onProviders(await window.tower.listProviders())
    setBusy(false)
  }

  return (
    <div className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>{spec.label}</h2>
        <span className={`dot ${view.state.status}`} />
        {spec.verified ? (
          <span className="small muted">verified {spec.verified.version}</span>
        ) : (
          <span className="pill queued">unverified</span>
        )}
        <span className="spacer" />
        <label className="checkbox small" style={{ marginBottom: 0 }}>
          <input type="checkbox" checked={spec.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
          <span>enabled</span>
        </label>
        <button onClick={() => void save()}>Save</button>
        <button className="primary" onClick={() => void verify()} disabled={busy}>
          {busy ? 'Verifying…' : 'Verify'}
        </button>
      </div>

      {view.state.status === 'disabled' && (
        <div className="banner bad">
          Authentication failed, so this provider is not retried automatically. Log in to the CLI,
          then verify it again.
        </div>
      )}
      {view.state.status === 'cooling' && view.state.cooldownUntil && (
        <div className="banner">
          Out of quota until {new Date(view.state.cooldownUntil).toLocaleString()}.{' '}
          <button
            className="ghost"
            onClick={async () => {
              await window.tower.saveProvider(spec)
              onProviders(await window.tower.listProviders())
            }}
          >
            Refresh
          </button>
        </div>
      )}

      <div className="grid2">
        <label>
          <span className="lbl">Command</span>
          <input className="mono" value={spec.command} onChange={(e) => patch({ command: e.target.value })} />
        </label>
        <label>
          <span className="lbl">Max concurrent runs</span>
          <input
            type="number"
            min={1}
            value={spec.maxConcurrent}
            onChange={(e) => patch({ maxConcurrent: Number(e.target.value) })}
          />
        </label>
      </div>

      <label>
        <span className="lbl">
          argv template — one entry per line. Placeholders: {'{{PROMPT}} {{WORKDIR}} {{SESSION_ID}} {{MODEL}}'}
        </span>
        <textarea
          className="mono"
          value={spec.argvFresh.join('\n')}
          onChange={(e) => patch({ argvFresh: e.target.value.split('\n').filter((l) => l.length > 0) })}
        />
      </label>

      <label>
        <span className="lbl">Extra argv for allowlist mode</span>
        <textarea
          className="mono"
          value={(spec.allowedToolsArgs ?? []).join('\n')}
          onChange={(e) => patch({ allowedToolsArgs: e.target.value.split('\n').filter((l) => l.length > 0) })}
        />
      </label>

      <label>
        <span className="lbl">Quota patterns — regular expressions, matched only against errors</span>
        <textarea
          className="mono"
          value={spec.detection.quotaPatterns.join('\n')}
          onChange={(e) =>
            patch({
              detection: {
                ...spec.detection,
                quotaPatterns: e.target.value.split('\n').filter((l) => l.length > 0)
              }
            })
          }
        />
      </label>

      <div className="card" style={{ background: 'var(--panel-2)' }}>
        <h2>Test an error message</h2>
        <p className="small muted">
          Paste a real message from this CLI to see how it would be judged. This is the practical way
          to tune the patterns — reproducing a genuine limit would mean exhausting your plan.
        </p>
        <textarea
          className="mono"
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          placeholder="Error: usage limit reached. Resets at 18:00"
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button
            onClick={async () => {
              const result = await window.tower.testClassifier(spec.id, sample)
              setVerdict(result.matched ? `${result.cls} (matched /${result.matched}/)` : result.cls)
            }}
          >
            Classify
          </button>
          {verdict && <span className="mono">{verdict}</span>}
        </div>
      </div>

      {report && (
        <>
          <div className={`banner ${report.ok ? '' : 'bad'}`}>
            {report.ok ? `Verified: ${report.resolvedPath} (${report.version})` : report.error}
          </div>
          {report.helpText && (
            <details>
              <summary className="small muted">CLI help output — edit the argv template against this</summary>
              <pre className="help">{report.helpText}</pre>
            </details>
          )}
          {report.dryRunOutput && (
            <details>
              <summary className="small muted">Dry-run output</summary>
              <pre className="help">{report.dryRunOutput}</pre>
            </details>
          )}
        </>
      )}
    </div>
  )
}
