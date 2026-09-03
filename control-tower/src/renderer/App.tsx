import React, { useEffect, useState } from 'react'
import type { Settings } from '@shared/types/settings'
import { ProviderChip } from './components/bits'
import { NewProjectWizard } from './screens/NewProjectWizard'
import { ProjectDetail } from './screens/ProjectDetail'
import { ProjectList } from './screens/ProjectList'
import { SettingsScreen } from './screens/SettingsScreen'
import { useProjects, useProviders } from './store/useTower'

type View = { name: 'list' } | { name: 'detail'; projectId: string } | { name: 'new' } | { name: 'settings' }

export function App(): JSX.Element {
  const [view, setView] = useState<View>({ name: 'list' })
  const [settings, setSettings] = useState<Settings | null>(null)
  const [slots, setSlots] = useState({ used: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const { projects, loading, refresh } = useProjects()
  const { providers, setProviders } = useProviders()

  useEffect(() => {
    void window.tower.getSettings().then(setSettings)
    const timer = setInterval(() => void window.tower.slots().then(setSlots), 2_000)
    return () => clearInterval(timer)
  }, [])

  const act = async (action: 'start' | 'pause' | 'stop' | 'delete', projectId: string): Promise<void> => {
    setError(null)
    try {
      if (action === 'start') await window.tower.startProject(projectId)
      if (action === 'pause') await window.tower.pauseProject(projectId)
      if (action === 'stop') await window.tower.stopProject(projectId)
      if (action === 'delete') {
        await window.tower.deleteProject(projectId)
        setView({ name: 'list' })
      }
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Control Tower</h1>
        <nav>
          <button className={view.name === 'list' ? 'active' : 'ghost'} onClick={() => setView({ name: 'list' })}>
            Projects
          </button>
          <button className={view.name === 'settings' ? 'active' : 'ghost'} onClick={() => setView({ name: 'settings' })}>
            Settings
          </button>
          <button className="ghost" onClick={() => setView({ name: 'new' })}>
            + New
          </button>
        </nav>

        <span className="spacer" />

        <div className="providers-strip">
          {providers.map((p) => (
            <ProviderChip key={p.spec.id} view={p} />
          ))}
        </div>

        <span className="chip">
          {slots.used}/{slots.total} slots
        </span>

        <button
          className="danger"
          title="Halt every run and kill every agent process"
          onClick={() => void window.tower.stopAll().then(refresh)}
        >
          STOP ALL
        </button>
      </header>

      <main className="content">
        {error && <div className="banner bad">{error}</div>}

        {view.name === 'list' && (
          <ProjectList
            projects={projects}
            loading={loading}
            onOpen={(projectId) => setView({ name: 'detail', projectId })}
            onNew={() => setView({ name: 'new' })}
            onAction={(action, projectId) => void act(action, projectId)}
          />
        )}

        {view.name === 'detail' && (
          <ProjectDetail
            projectId={view.projectId}
            onBack={() => setView({ name: 'list' })}
            onAction={(action, projectId) => void act(action, projectId)}
          />
        )}

        {view.name === 'new' && settings && (
          <NewProjectWizard
            providers={providers}
            settings={settings}
            onCreated={() => {
              void refresh()
              setView({ name: 'list' })
            }}
            onCancel={() => setView({ name: 'list' })}
          />
        )}

        {view.name === 'settings' && settings && (
          <SettingsScreen
            settings={settings}
            providers={providers}
            onSettings={setSettings}
            onProviders={setProviders}
          />
        )}
      </main>
    </div>
  )
}
