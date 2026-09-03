import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { app, BrowserWindow } from 'electron'
import { pidRegistry } from './exec/pidRegistry'
import { registerIpc } from './ipc/register'
import { ProviderRegistry, type ProvidersFile } from './providers/registry'
import { Orchestrator } from './run/orchestrator'
import { createRepos } from './store/repos'

let window: BrowserWindow | null = null
let orchestrator: Orchestrator | null = null

// One window only: two instances writing the same JSON store would corrupt it,
// and two orchestrators would double-book every provider lease.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })
  void main()
}

async function main(): Promise<void> {
  await app.whenReady()

  const userDataDir = app.getPath('userData')
  const defaultProjectsRoot = join(homedir(), 'ControlTowerProjects')

  // Anything the last run left behind dies before this one starts.
  pidRegistry.init(join(userDataDir, 'pids.json'))
  const orphans = pidRegistry.reapOrphans()
  if (orphans.length > 0) console.warn(`[control-tower] reaped ${orphans.length} orphaned agent process(es)`)

  const repos = createRepos(userDataDir, defaultProjectsRoot)
  const registry = new ProviderRegistry(join(userDataDir, 'providers.json'), loadSeed())
  orchestrator = new Orchestrator(repos, registry, userDataDir)
  await orchestrator.init()

  registerIpc({ repos, registry, orchestrator, userDataDir, window: () => window })

  orchestrator.on('log', (batch) => window?.webContents.send('ev:logs', batch))
  orchestrator.on('run', (run) => window?.webContents.send('ev:run', run))
  orchestrator.on('iteration', (iteration) => window?.webContents.send('ev:iteration', iteration))
  orchestrator.on('providers', (providers) => window?.webContents.send('ev:providers', providers))
  orchestrator.on('error', (err: Error) => console.error('[orchestrator]', err))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Control Tower',
    backgroundColor: '#12141a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.once('ready-to-show', () => window?.show())
  window.on('closed', () => {
    window = null
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) void window.loadURL(devUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
}

function loadSeed(): ProvidersFile {
  // Packaged builds keep resources next to the app; dev reads from the repo.
  const candidates = [
    join(process.resourcesPath ?? '', 'providers.default.json'),
    join(app.getAppPath(), 'resources', 'providers.default.json'),
    join(__dirname, '../../resources/providers.default.json')
  ]
  for (const path of candidates) {
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as ProvidersFile
    } catch {
      // Try the next location.
    }
  }
  return { schema: 1, providers: [] }
}

// Nothing may outlive the app: every agent tree is reaped before quitting.
app.on('before-quit', () => orchestrator?.stopAll('app_shutdown'))
app.on('window-all-closed', () => {
  orchestrator?.stopAll('app_shutdown')
  if (process.platform !== 'darwin') app.quit()
})
