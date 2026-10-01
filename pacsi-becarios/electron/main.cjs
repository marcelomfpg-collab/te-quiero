// Programa de escritorio: abre la app en una ventana propia, sin navegador.
// Agrega lo que el navegador no puede hacer: conectarse al correo y leer CVs escaneados sin internet.
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const mail = require('./mail.cjs');

if (!app.requestSingleInstanceLock()) app.quit();

/** Archivos del OCR: incluidos en el instalador (resources/ocr) o, en desarrollo, en node_modules. */
function ocrBaseUrl() {
  const base = app.isPackaged ? path.join(process.resourcesPath, 'ocr') : path.join(__dirname, '..', 'build', 'ocr');
  return pathToFileURL(base).href;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Becarios PACSI 2027-A',
    backgroundColor: '#f3f5f8',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      additionalArguments: [`--ocr-base=${ocrBaseUrl()}`],
    },
  });
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) event.preventDefault();
  });
  return win;
}

ipcMain.handle('mail:getConfig', () => mail.getConfig());
ipcMain.handle('mail:saveConfig', (_e, config) => mail.saveConfig(config));
ipcMain.handle('mail:test', (_e, config) => mail.test(config));
ipcMain.handle('mail:open', () => mail.open());
ipcMain.handle('mail:list', () => mail.list());
ipcMain.handle('mail:get', (_e, uid) => mail.get(uid));
ipcMain.handle('mail:close', () => mail.close());

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  mail.close().finally(() => process.platform !== 'darwin' && app.quit());
});
