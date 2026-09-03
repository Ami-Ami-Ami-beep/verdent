import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { classify } from '@shared/classify'
import { IPC, type NewProjectInput, type ProjectView } from '@shared/types/ipc'
import type { Project } from '@shared/types/project'
import type { ProviderSpec } from '@shared/types/provider'
import type { Settings } from '@shared/types/settings'
import { initRepo, recentCommits } from '../git/repo'
import type { Orchestrator } from '../run/orchestrator'
import type { ProviderRegistry } from '../providers/registry'
import { verifyProvider } from '../providers/registry'
import { readTower } from '../run/towerFiles'
import { checkWorkdir } from '../safety/guards'
import type { Repos } from '../store/repos'

export interface IpcContext {
  repos: Repos
  registry: ProviderRegistry
  orchestrator: Orchestrator
  userDataDir: string
  window: () => BrowserWindow | null
}

export function registerIpc(ctx: IpcContext): void {
  const { repos, registry, orchestrator } = ctx

  const handle = <T extends unknown[], R>(channel: string, fn: (...args: T) => Promise<R> | R): void => {
    ipcMain.handle(channel, async (_event, ...args) => fn(...(args as T)))
  }

  const viewFor = async (project: Project): Promise<ProjectView> => {
    const run = orchestrator.runFor(project.id) ?? (await findRun(repos, project.currentRunId))
    const tower = existsSync(join(project.workdir, '.tower'))
      ? await readTower(project.workdir)
      : undefined
    const commits = await recentCommits(project.workdir, 1)
    return {
      project,
      ...(run ? { run } : {}),
      ...(tower ? { tasks: tower.tasks } : {}),
      iterations: run ? orchestrator.iterations(run.id) : [],
      ...(commits[0] ? { lastCommit: commits[0] } : {})
    }
  }

  handle(IPC.listProjects, async () => {
    const file = await repos.projects.read()
    return await Promise.all(file.projects.map(viewFor))
  })

  handle(IPC.createProject, async (input: NewProjectInput) => {
    const settings = await repos.settings.read()
    const workdir = resolve(input.parentDir, slug(input.name))

    // The folder is created first so the guard can distinguish "we made this"
    // from "this is somebody's existing repository".
    const alreadyExisted = existsSync(workdir)
    const check = checkWorkdir(workdir, {
      projectsRoot: settings.projectsRoot,
      userDataDir: ctx.userDataDir,
      createdByApp: !alreadyExisted
    })
    if (!check.ok) throw new Error(check.reason)

    await mkdir(workdir, { recursive: true })
    await initRepo(workdir)

    const project: Project = {
      id: randomUUID(),
      name: input.name.trim(),
      workdir,
      brief: input.brief,
      budgetMs: input.budgetMs,
      permissionMode: input.permissionMode,
      autonomousOptIn: input.autonomousOptIn,
      createdAt: new Date().toISOString(),
      ...(input.providerChainOverride?.length ? { providerChainOverride: input.providerChainOverride } : {})
    }
    await repos.projects.update((file) => ({ ...file, projects: [...file.projects, project] }))
    return await viewFor(project)
  })

  handle(IPC.deleteProject, async (projectId: string) => {
    orchestrator.stop(projectId)
    await repos.projects.update((file) => ({
      ...file,
      projects: file.projects.filter((p) => p.id !== projectId),
      runs: file.runs.filter((r) => r.projectId !== projectId)
    }))
    // Only Control Tower's own records are removed; the user's code stays put.
    await rm(join(ctx.userDataDir, 'projects', projectId), { recursive: true, force: true }).catch(() => undefined)
  })

  handle(IPC.startProject, async (projectId: string) => {
    const project = await requireProject(repos, projectId)
    await orchestrator.reloadSettings()
    await orchestrator.refreshProviders()
    return await orchestrator.start(project)
  })

  handle(IPC.pauseProject, (projectId: string) => orchestrator.pause(projectId))
  handle(IPC.stopProject, (projectId: string) => orchestrator.stop(projectId))
  handle(IPC.stopAll, () => orchestrator.stopAll())

  handle(IPC.projectDetail, async (projectId: string) => {
    const project = await requireProject(repos, projectId)
    const base = await viewFor(project)
    const tower = existsSync(join(project.workdir, '.tower'))
      ? await readTower(project.workdir)
      : { plan: '', journal: '' }
    return { ...base, plan: tower.plan, journal: tower.journal }
  })

  handle(IPC.recentLogs, (runId: string) => orchestrator.tailer.recent(runId))

  handle(IPC.listProviders, async () => {
    await orchestrator.refreshProviders()
    return orchestrator.providerView()
  })

  handle(IPC.saveProvider, async (spec: ProviderSpec) => {
    await registry.upsert(spec)
    await orchestrator.refreshProviders()
    return orchestrator.providerView()
  })

  handle(IPC.verifyProvider, async (providerId: string) => {
    const spec = await registry.get(providerId)
    if (!spec) throw new Error(`Unknown provider: ${providerId}`)
    const report = await verifyProvider(spec)
    if (report.ok) {
      await registry.upsert({
        ...spec,
        verified: { at: new Date().toISOString(), version: report.version ?? 'unknown' }
      })
      await orchestrator.refreshProviders()
    }
    return report
  })

  // Lets the user paste a real error message and see how it would be judged,
  // which is the only practical way to tune patterns without exhausting a plan.
  handle(IPC.testClassifier, async (providerId: string, sample: string) => {
    const spec = await registry.get(providerId)
    if (!spec) throw new Error(`Unknown provider: ${providerId}`)
    const verdict = classify({
      exitCode: 1,
      signal: null,
      errorChannelText: sample,
      ranForMs: 5_000,
      hadToolActivity: false,
      spec: spec.detection
    })
    return {
      cls: verdict.cls,
      ...(verdict.matched ? { matched: verdict.matched } : {}),
      ...(verdict.resetAt ? { resetAt: verdict.resetAt.toISOString() } : {})
    }
  })

  handle(IPC.getSettings, () => repos.settings.read())
  handle(IPC.saveSettings, async (settings: Settings) => {
    await repos.settings.write(settings)
    return await orchestrator.reloadSettings()
  })

  handle(IPC.chooseDirectory, async () => {
    const win = ctx.window()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? undefined : result.filePaths[0]
  })

  handle(IPC.slots, () => orchestrator.slots())

  handle(IPC.openWorkdir, async (projectId: string) => {
    const project = await requireProject(repos, projectId)
    await shell.openPath(project.workdir)
  })
}

async function requireProject(repos: Repos, projectId: string): Promise<Project> {
  const file = await repos.projects.read()
  const project = file.projects.find((p) => p.id === projectId)
  if (!project) throw new Error(`Unknown project: ${projectId}`)
  return project
}

async function findRun(repos: Repos, runId?: string) {
  if (!runId) return undefined
  const file = await repos.projects.read()
  return file.runs.find((r) => r.id === runId)
}

function slug(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || `project-${Date.now()}`
}
