import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { join } from "node:path";
import { loadConfig, normalizeServerUrl, saveConfig } from "./config";

let win: BrowserWindow | null = null;

/** Seiten, die im App-Fenster bleiben dürfen: das eigene Panel und der Discord-Login. */
function isAllowedInApp(target: string, serverUrl: string | null): boolean {
  try {
    const url = new URL(target);
    if (serverUrl && url.origin === serverUrl) return true;
    return url.origin === "https://discord.com" && (url.pathname.startsWith("/oauth2/") || url.pathname.startsWith("/login"));
  } catch {
    return false;
  }
}

function openExternal(target: string) {
  if (target.startsWith("https://") || target.startsWith("http://")) void shell.openExternal(target);
}

function showSetup() {
  void win?.loadFile(join(__dirname, "../static/setup.html"));
}

function showPanel() {
  const { serverUrl } = loadConfig();
  if (!serverUrl) return showSetup();
  win?.loadURL(serverUrl).catch(() => {
    void win?.loadFile(join(__dirname, "../static/setup.html"), { query: { error: "unreachable", url: serverUrl } });
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 400,
    minHeight: 500,
    backgroundColor: "#09090b",
    title: "BotPanel",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Links wie „Zu Server einladen“ öffnen im normalen Browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file://")) return;
    if (!isAllowedInApp(url, loadConfig().serverUrl)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  showPanel();
}

ipcMain.handle("botpanel:get-server-url", () => loadConfig().serverUrl);
ipcMain.handle("botpanel:set-server-url", (_event, input: unknown) => {
  const serverUrl = typeof input === "string" ? normalizeServerUrl(input) : null;
  if (!serverUrl) return { ok: false, error: "Ungültige Adresse" };
  saveConfig({ serverUrl });
  showPanel();
  return { ok: true };
});

const menu = Menu.buildFromTemplate([
  {
    label: "BotPanel",
    submenu: [
      { label: "Server-Adresse ändern …", click: showSetup },
      { label: "Neu laden", accelerator: "CmdOrCtrl+R", click: () => win?.webContents.reload() },
      { type: "separator" },
      { role: "quit", label: "Beenden" },
    ],
  },
  {
    label: "Ansicht",
    submenu: [
      { role: "zoomIn", label: "Vergrößern" },
      { role: "zoomOut", label: "Verkleinern" },
      { role: "resetZoom", label: "Originalgröße" },
      { role: "togglefullscreen", label: "Vollbild" },
      ...(app.isPackaged ? [] : [{ role: "toggleDevTools" as const }]),
    ],
  },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win?.isMinimized()) win.restore();
    win?.focus();
  });
  void app.whenReady().then(() => {
    Menu.setApplicationMenu(menu);
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
}
