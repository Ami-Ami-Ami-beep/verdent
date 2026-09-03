import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/types/ipc'

/**
 * The renderer never touches fs, child_process or paths. This allowlisted
 * bridge is the only way across, which keeps every dangerous capability in the
 * main process where it can be guarded.
 */
const api = {
  listProjects: () => ipcRenderer.invoke(IPC.listProjects),
  createProject: (input: unknown) => ipcRenderer.invoke(IPC.createProject, input),
  deleteProject: (projectId: string) => ipcRenderer.invoke(IPC.deleteProject, projectId),
  startProject: (projectId: string) => ipcRenderer.invoke(IPC.startProject, projectId),
  pauseProject: (projectId: string) => ipcRenderer.invoke(IPC.pauseProject, projectId),
  stopProject: (projectId: string) => ipcRenderer.invoke(IPC.stopProject, projectId),
  stopAll: () => ipcRenderer.invoke(IPC.stopAll),
  projectDetail: (projectId: string) => ipcRenderer.invoke(IPC.projectDetail, projectId),
  recentLogs: (runId: string) => ipcRenderer.invoke(IPC.recentLogs, runId),

  listProviders: () => ipcRenderer.invoke(IPC.listProviders),
  saveProvider: (spec: unknown) => ipcRenderer.invoke(IPC.saveProvider, spec),
  verifyProvider: (providerId: string) => ipcRenderer.invoke(IPC.verifyProvider, providerId),
  testClassifier: (providerId: string, sample: string) =>
    ipcRenderer.invoke(IPC.testClassifier, providerId, sample),

  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  saveSettings: (settings: unknown) => ipcRenderer.invoke(IPC.saveSettings, settings),
  chooseDirectory: () => ipcRenderer.invoke(IPC.chooseDirectory),
  slots: () => ipcRenderer.invoke(IPC.slots),
  openWorkdir: (projectId: string) => ipcRenderer.invoke(IPC.openWorkdir, projectId),

  onLogs: (cb: (batch: unknown) => void) => subscribe(IPC.evLogs, cb),
  onRun: (cb: (run: unknown) => void) => subscribe(IPC.evRun, cb),
  onIteration: (cb: (iteration: unknown) => void) => subscribe(IPC.evIteration, cb),
  onProviders: (cb: (providers: unknown) => void) => subscribe(IPC.evProviders, cb)
}

function subscribe(channel: string, cb: (payload: never) => void): () => void {
  const listener = (_event: unknown, payload: never): void => cb(payload)
  ipcRenderer.on(channel, listener as never)
  return () => ipcRenderer.removeListener(channel, listener as never)
}

contextBridge.exposeInMainWorld('tower', api)
