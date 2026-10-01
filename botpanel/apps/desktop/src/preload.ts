import { contextBridge, ipcRenderer } from "electron";

// Nur diese zwei Funktionen sind für Webseiten sichtbar, kein voller Node-Zugriff.
contextBridge.exposeInMainWorld("botpanelDesktop", {
  getServerUrl: (): Promise<string | null> => ipcRenderer.invoke("botpanel:get-server-url"),
  setServerUrl: (url: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("botpanel:set-server-url", url),
});
