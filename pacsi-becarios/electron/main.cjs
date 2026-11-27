// Programa de escritorio: abre la app en una ventana propia, sin navegador.
// Agrega lo que el navegador no puede hacer: conectarse al correo y leer CVs escaneados sin internet.
const { app, BrowserWindow, Menu, shell, ipcMain, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const mail = require('./mail.cjs');
const folder = require('./folder.cjs');

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
ipcMain.handle('mail:msLogin', (_e, config) => mail.msLogin(config));
ipcMain.handle('mail:msLogout', () => mail.msLogout());
ipcMain.handle('folder:getConfig', () => folder.getConfig());
ipcMain.handle('folder:saveConfig', (_e, config) => folder.saveConfig(config));
ipcMain.handle('folder:choose', () => folder.choose());
ipcMain.handle('folder:list', () => folder.list());
ipcMain.handle('folder:read', (_e, rel) => folder.read(rel));

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

/** "Descargas/nombre.csv"; si ya existe, "nombre (2).csv". */
function uniqueDownloadPath(filename) {
  const dir = app.getPath('downloads');
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = path.join(dir, filename);
  for (let i = 2; fs.existsSync(candidate); i++) candidate = path.join(dir, `${base} (${i})${ext}`);
  return candidate;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // Excel, plantilla y copias de seguridad se guardan directo en Descargas y se muestra el archivo.
  session.defaultSession.on('will-download', (_event, item) => {
    const target = uniqueDownloadPath(item.getFilename());
    item.setSavePath(target);
    item.once('done', (_e, state) => {
      if (state === 'completed') shell.showItemInFolder(target);
    });
  });
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  mail.close().finally(() => process.platform !== 'darwin' && app.quit());
});
