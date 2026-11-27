// "Vigilar carpeta": lee los CVs que Power Automate guarda en una carpeta de OneDrive (o cualquier carpeta).
// Solo lee archivos dentro de la carpeta elegida; nunca fuera de ella.
const { app, dialog, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_FILE = () => path.join(app.getPath('userData'), 'carpeta.json');
const CV_FILE = /\.(pdf|docx?|png|jpe?g|webp)$/i;
const MAX_DEPTH = 3;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function getConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8'));
    return { ...cfg, exists: Boolean(cfg.path && fs.existsSync(cfg.path)) };
  } catch {
    return null;
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true });
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify({ path: config.path, autoCheckMinutes: Number(config.autoCheckMinutes) || 0 }, null, 2));
}

async function choose() {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const result = await dialog.showOpenDialog(win, { title: 'Elegir la carpeta donde llegan los CVs', properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
}

function root() {
  const cfg = getConfig();
  if (!cfg?.path) throw new Error('Primero elija la carpeta (Más → Configurar carpeta).');
  if (!fs.existsSync(cfg.path)) throw new Error(`No se encuentra la carpeta ${cfg.path}. ¿Se movió o OneDrive no está abierto?`);
  return fs.realpathSync(cfg.path);
}

/** Archivos de CV en la carpeta (y subcarpetas), sin temporales ni ocultos. */
function list() {
  const base = root();
  const out = [];
  const walk = (dir, depth) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) walk(full, depth + 1);
      } else if (entry.isFile() && CV_FILE.test(entry.name)) {
        const st = fs.statSync(full);
        if (st.size > 0 && st.size <= MAX_FILE_BYTES) {
          out.push({ rel: path.relative(base, full).split(path.sep).join('/'), name: entry.name, size: st.size, mtimeMs: Math.round(st.mtimeMs) });
        }
      }
    }
  };
  walk(base, 0);
  return out.sort((a, b) => a.mtimeMs - b.mtimeMs);
}

/** Lee un archivo de la lista; rechaza cualquier ruta que salga de la carpeta elegida. */
function read(rel) {
  const base = root();
  const full = fs.realpathSync(path.resolve(base, String(rel)));
  if (full !== base && !full.startsWith(base + path.sep)) throw new Error('Ruta fuera de la carpeta elegida.');
  return new Uint8Array(fs.readFileSync(full));
}

module.exports = { getConfig, saveConfig, choose, list, read };
