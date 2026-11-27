// Conexión IMAP al buzón de reclutamiento (Outlook / correo del hosting de la empresa).
// La contraseña se guarda cifrada con el sistema operativo (safeStorage) y nunca llega a la ventana.
const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const microsoft = require('./microsoft.cjs');
const { createGraphMailbox } = require('./graph.cjs');

const CONFIG_FILE = () => path.join(app.getPath('userData'), 'correo.json');
const CV_TYPES = /\.(pdf|docx|png|jpe?g|webp)$/i;

function readStored() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8'));
  } catch {
    return null;
  }
}

function decryptPassword(stored) {
  if (!stored?.password) return '';
  const buf = Buffer.from(stored.password, 'base64');
  return stored.encrypted ? safeStorage.decryptString(buf) : buf.toString('utf8');
}

const isMicrosoft = (config) => config?.provider === 'microsoft';

async function getConfig() {
  const stored = readStored();
  if (!stored) return null;
  const { password, encrypted, ...rest } = stored;
  const msAccount = isMicrosoft(stored) ? await microsoft.signedInUser(stored) : '';
  return { ...rest, hasPassword: Boolean(password), msAccount, ready: isMicrosoft(stored) ? Boolean(msAccount) : Boolean(password) };
}

function graphFor(config, user) {
  return createGraphMailbox({
    getToken: () => microsoft.getToken(config),
    mailbox: config.msMailbox,
    signedInUser: user,
    folder: config.folder,
    subjectFilter: config.subjectFilter,
    sinceDate: config.sinceDate,
  });
}

async function msLogin(config) {
  const result = await microsoft.login(config);
  if (result.ok) saveConfig({ ...(readStored() || {}), ...config, password: undefined });
  return result;
}

async function msLogout() {
  const stored = readStored();
  if (stored) await microsoft.logout(stored);
}

function saveConfig(config) {
  const previous = readStored();
  const { password, ...rest } = config;
  let stored = { ...rest, password: previous?.password, encrypted: previous?.encrypted };
  if (password) {
    const canEncrypt = safeStorage.isEncryptionAvailable();
    stored.password = (canEncrypt ? safeStorage.encryptString(password) : Buffer.from(password, 'utf8')).toString('base64');
    stored.encrypted = canEncrypt;
  }
  fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true });
  fs.writeFileSync(CONFIG_FILE(), JSON.stringify(stored, null, 2));
}

function clientFor(config) {
  return new ImapFlow({
    host: config.host,
    port: Number(config.port) || 993,
    secure: config.secure !== false,
    auth: { user: config.user, pass: config.password },
    logger: false,
    tls: { rejectUnauthorized: false }, // muchos hostings usan certificados propios
    socketTimeout: 60_000,
  });
}

function friendlyError(error) {
  const msg = String(error?.responseText || error?.message || error);
  if (/auth|login|credentials|password|invalid/i.test(msg)) return 'Usuario o contraseña incorrectos.';
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) return 'No se encontró el servidor. Revise el nombre del servidor de correo.';
  if (/ECONNREFUSED|ETIMEDOUT|timeout/i.test(msg)) return 'El servidor no responde. Revise el puerto y la conexión a internet.';
  if (/mailbox|folder|NONEXISTENT/i.test(msg)) return 'No existe esa carpeta en el correo.';
  return `No se pudo conectar: ${msg}`;
}

const normalize = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function hasCvAttachment(node) {
  if (!node) return false;
  const name = node.dispositionParameters?.filename || node.parameters?.name || '';
  if (CV_TYPES.test(name) || node.type === 'application/pdf') return true;
  return (node.childNodes || []).some(hasCvAttachment);
}

let session = null;

async function test(config) {
  if (isMicrosoft(config)) {
    try {
      const user = await microsoft.signedInUser(config);
      if (!user) return { ok: false, message: 'Primero inicie sesión con Microsoft.' };
      const info = await graphFor(config, user).info();
      return { ok: true, message: `Conexión correcta como ${user}. La carpeta "${info.folder}" tiene ${info.total} correos.`, total: info.total };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }
  const full = { ...config, password: config.password || decryptPassword(readStored()) };
  const client = clientFor(full);
  try {
    await client.connect();
    const status = await client.status(full.folder || 'INBOX', { messages: true });
    return { ok: true, message: `Conexión correcta. La carpeta tiene ${status.messages} correos.`, total: status.messages };
  } catch (error) {
    return { ok: false, message: friendlyError(error) };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

async function open() {
  const stored = readStored();
  if (!stored) throw new Error('Primero configure el correo.');
  if (isMicrosoft(stored)) {
    const user = await microsoft.signedInUser(stored);
    if (!user) throw new Error('Inicie sesión con Microsoft (Más → Configurar correo).');
    session = { graph: graphFor(stored, user), config: stored };
    return;
  }
  const config = { ...stored, password: decryptPassword(stored) };
  const client = clientFor(config);
  try {
    await client.connect();
  } catch (error) {
    throw new Error(friendlyError(error));
  }
  const lock = await client.getMailboxLock(config.folder || 'INBOX');
  session = { client, lock, config };
}

async function list() {
  if (!session) throw new Error('El correo no está conectado.');
  if (session.graph) return session.graph.list();
  const { client, config } = session;
  const since = config.sinceDate ? new Date(`${config.sinceDate}T00:00:00`) : undefined;
  let uids = await client.search(since ? { since } : { all: true }, { uid: true });
  // Algunos servidores no entienden bien la búsqueda por fecha: se revisa todo y se filtra aquí.
  if (since && (!uids || !uids.length)) uids = await client.search({ all: true }, { uid: true });
  const out = [];
  if (!uids || !uids.length) return out;
  for await (const msg of client.fetch(uids, { envelope: true, bodyStructure: true, uid: true }, { uid: true })) {
    if (since && msg.envelope?.date && msg.envelope.date < since) continue;
    const subject = msg.envelope?.subject || '';
    if (config.subjectFilter && !normalize(subject).includes(normalize(config.subjectFilter))) continue;
    const from = msg.envelope?.from?.[0] || {};
    out.push({
      uid: msg.uid,
      messageId: msg.envelope?.messageId || `uid-${msg.uid}`,
      subject,
      date: (msg.envelope?.date || new Date()).toISOString(),
      fromName: from.name || '',
      fromAddress: from.address || '',
      hasAttachments: hasCvAttachment(msg.bodyStructure),
    });
  }
  return out;
}

async function get(uid) {
  if (!session) throw new Error('El correo no está conectado.');
  if (session.graph) return session.graph.get(uid);
  const msg = await session.client.fetchOne(String(uid), { source: true, envelope: true }, { uid: true });
  const parsed = await simpleParser(msg.source);
  const from = parsed.from?.value?.[0] || {};
  return {
    uid,
    messageId: parsed.messageId || msg.envelope?.messageId || `uid-${uid}`,
    subject: parsed.subject || '',
    date: (parsed.date || new Date()).toISOString(),
    fromName: from.name || '',
    fromAddress: from.address || '',
    hasAttachments: parsed.attachments.length > 0,
    text: (parsed.text || '').slice(0, 20_000),
    attachments: parsed.attachments
      .filter((a) => CV_TYPES.test(a.filename || '') || a.contentType === 'application/pdf')
      .map((a) => ({ filename: a.filename || 'adjunto.pdf', contentType: a.contentType, content: new Uint8Array(a.content) })),
  };
}

async function close() {
  if (!session) return;
  if (session.graph) {
    session = null;
    return;
  }
  const { client, lock } = session;
  session = null;
  lock.release();
  await client.logout().catch(() => undefined);
}

module.exports = { getConfig, saveConfig, test, open, list, get, close, msLogin, msLogout };
