import React, { useEffect, useState } from 'react'
import type { NewProjectInput, ProviderView } from '@shared/types/ipc'
import type { Settings } from '@shared/types/settings'
import { humanDuration } from '../components/bits'

const HOUR = 3_600_000
const PRESETS = [1, 4, 10, 24]

const BRIEF_PLACEHOLDER = `Describe the app you want, as precisely as you can. The more concrete this is, the better the result.

  What it should do, and for whom
  Which platform and technologies you want (or "you choose")
  The features that must exist
  What is explicitly NOT wanted
  How you will judge it is finished

Example: "A macOS menu-bar app in SwiftUI that tracks how long I spend in each application, shows a daily bar chart, and exports CSV. No cloud sync, no account. Done when it runs, has unit tests for the tracking logic, and exports a valid CSV."`

export function NewProjectWizard({
  providers,
  settings,
  onCreated,
  onCancel
}: {
  providers: ProviderView[]
  settings: Settings
  onCreated: () => void
  onCancel: () => void
}): JSX.Element {
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [parentDir, setParentDir] = useState(settings.projectsRoot)
  const [brief, setBrief] = useState('')
  const [hours, setHours] = useState(10)
  const [permissionMode, setPermissionMode] = useState(settings.defaultPermissionMode)
  const [chain, setChain] = useState<string[]>(settings.providerChain)
  const [ack, setAck] = useState(false)

  useEffect(() => setParentDir(settings.projectsRoot), [settings.projectsRoot])

  const runnable = providers.filter((p) => p.spec.enabled && p.spec.verified)
  const chainIsUsable = chain.some((id) => runnable.some((p) => p.spec.id === id))

  const submit = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const input: NewProjectInput = {
      name,
      parentDir,
      brief,
      budgetMs: Math.round(hours * HOUR),
      permissionMode,
      providerChainOverride: chain,
      autonomousOptIn: ack
    }
    try {
      await window.tower.createProject(input)
      onCreated()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const steps = ['Folder', 'Brief', 'Budget', 'Confirm']

  return (
    <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="wizard-steps">
        {steps.map((label, i) => (
          <div key={label} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {error && <div className="banner bad">{error}</div>}

      {step === 0 && (
        <>
          <label>
            <span className="lbl">Project name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Time Tracker" />
          </label>
          <label>
            <span className="lbl">Parent folder — a subfolder is created inside it</span>
            <div className="row">
              <input value={parentDir} onChange={(e) => setParentDir(e.target.value)} />
              <button
                onClick={async () => {
                  const chosen = await window.tower.chooseDirectory()
                  if (chosen) setParentDir(chosen)
                }}
              >
                Browse…
              </button>
            </div>
          </label>
          <p className="small muted">
            It must sit inside your projects root ({settings.projectsRoot}). An existing git
            repository is refused, so an agent can never be pointed at work you already have.
          </p>
        </>
      )}

      {step === 1 && (
        <label>
          <span className="lbl">What should be built?</span>
          <textarea
            style={{ minHeight: 300 }}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={BRIEF_PLACEHOLDER}
          />
        </label>
      )}

      {step === 2 && (
        <>
          <label>
            <span className="lbl">Time budget — working time, pauses do not count</span>
            <div className="row" style={{ marginBottom: 8 }}>
              {PRESETS.map((h) => (
                <button key={h} className={hours === h ? 'primary' : ''} onClick={() => setHours(h)}>
                  {h}h
                </button>
              ))}
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                style={{ width: 110 }}
              />
              <span className="muted">= {humanDuration(hours * HOUR)}</span>
            </div>
          </label>

          <label>
            <span className="lbl">Provider chain — the first available one is used</span>
            <div className="row">
              {chain.map((id, i) => (
                <span key={id} className="chip">
                  {i + 1}. {id}
                  <button
                    className="ghost small"
                    onClick={() => setChain(chain.filter((c) => c !== id))}
                    title="remove"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              {providers
                .filter((p) => !chain.includes(p.spec.id))
                .map((p) => (
                  <button key={p.spec.id} className="ghost" onClick={() => setChain([...chain, p.spec.id])}>
                    + {p.spec.label}
                  </button>
                ))}
            </div>
          </label>

          <label>
            <span className="lbl">How much may the agent do without asking?</span>
            <select value={permissionMode} onChange={(e) => setPermissionMode(e.target.value as 'allowlist' | 'full')}>
              <option value="allowlist">Allowlist — file edits plus approved commands only</option>
              <option value="full">Full — every command inside the project folder</option>
            </select>
            <p className="small muted" style={{ marginTop: 6 }}>
              In non-interactive mode anything that would normally prompt is denied automatically, so
              the allowlist has to name every command the agent needs. If a run keeps stalling on a
              missing command, either extend the allowlist in Settings or switch this project to full.
            </p>
          </label>
        </>
      )}

      {step === 3 && (
        <>
          <div className="grid2">
            <div>
              <div className="lbl muted">Name</div>
              <div>{name || <span className="muted">— required —</span>}</div>
            </div>
            <div>
              <div className="lbl muted">Budget</div>
              <div>{humanDuration(hours * HOUR)}</div>
            </div>
            <div>
              <div className="lbl muted">Folder</div>
              <div className="mono small">{parentDir}</div>
            </div>
            <div>
              <div className="lbl muted">Providers</div>
              <div>{chain.join(' → ') || <span className="muted">none</span>}</div>
            </div>
          </div>

          {!chainIsUsable && (
            <div className="banner">
              None of the chosen providers is verified yet. Verify at least one in Settings, or the
              run will stop immediately.
            </div>
          )}

          <div className="card" style={{ background: 'var(--panel-2)' }}>
            <label className="checkbox">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>
                <strong>Enable autonomous mode for this project.</strong>
                <br />
                The agent will write files and run commands inside{' '}
                <span className="mono">{parentDir}</span> without asking, for up to{' '}
                {humanDuration(hours * HOUR)}. Every iteration is committed to git, so any state can
                be recovered, and Stop kills everything immediately.
                <br />
                <br />
                <span className="muted">
                  Honest limitation: the agent has network access and will install packages it
                  chooses. Confining it to a folder does not protect you from a malicious dependency.
                  Run it on a machine where that is acceptable.
                </span>
              </span>
            </label>
          </div>
        </>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <span className="spacer" />
        {step > 0 && <button onClick={() => setStep(step - 1)}>Back</button>}
        {step < 3 ? (
          <button
            className="primary"
            disabled={(step === 0 && !name.trim()) || (step === 1 && brief.trim().length < 20)}
            onClick={() => setStep(step + 1)}
          >
            Next
          </button>
        ) : (
          <button className="primary" disabled={!ack || !name.trim() || busy} onClick={() => void submit()}>
            {busy ? 'Creating…' : 'Create project'}
          </button>
        )}
      </div>
    </div>
  )
}
