// Puente seguro entre la ventana y el sistema: solo expone estas funciones.
const { contextBridge, ipcRenderer } = require('electron');

const ocrArg = process.argv.find((a) => a.startsWith('--ocr-base='));
const ocrBase = ocrArg ? ocrArg.slice('--ocr-base='.length) : null;

contextBridge.exposeInMainWorld('pacsiDesktop', {
  ocrPaths: ocrBase
    ? { workerPath: `${ocrBase}/worker.min.js`, corePath: `${ocrBase}/core`, langPath: `${ocrBase}/lang` }
    : undefined,
  mail: {
    getConfig: () => ipcRenderer.invoke('mail:getConfig'),
    saveConfig: (config) => ipcRenderer.invoke('mail:saveConfig', config),
    test: (config) => ipcRenderer.invoke('mail:test', config),
    open: () => ipcRenderer.invoke('mail:open'),
    list: () => ipcRenderer.invoke('mail:list'),
    get: (uid) => ipcRenderer.invoke('mail:get', uid),
    close: () => ipcRenderer.invoke('mail:close'),
  },
});
