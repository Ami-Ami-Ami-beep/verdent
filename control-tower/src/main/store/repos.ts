import { join } from 'node:path'
import type { Project } from '@shared/types/project'
import type { ProviderRuntimeState } from '@shared/types/provider'
import type { Run } from '@shared/types/run'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types/settings'
import { JsonStore } from './jsonStore'

export interface ProjectsFile {
  schema: number
  projects: Project[]
  runs: Run[]
}

export interface ProviderStateFile {
  schema: number
  states: ProviderRuntimeState[]
}

export function createRepos(userDataDir: string, defaultProjectsRoot: string) {
  const settings = new JsonStore<Settings>(join(userDataDir, 'settings.json'), () => ({
    ...DEFAULT_SETTINGS,
    projectsRoot: defaultProjectsRoot
  }))

  const projects = new JsonStore<ProjectsFile>(join(userDataDir, 'projects.json'), () => ({
    schema: 1,
    projects: [],
    runs: []
  }))

  // Kept separate from settings because it changes on every provider outcome,
  // and because it must survive a restart: a subscription window is hours long.
  const providerState = new JsonStore<ProviderStateFile>(join(userDataDir, 'providerState.json'), () => ({
    schema: 1,
    states: []
  }))

  return { settings, projects, providerState }
}

export type Repos = ReturnType<typeof createRepos>
