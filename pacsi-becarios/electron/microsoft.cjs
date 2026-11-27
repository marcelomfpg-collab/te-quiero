// Inicio de sesión con Microsoft 365 (la misma ventana oficial de Microsoft que usa Outlook).
// El programa nunca ve la contraseña: Microsoft le entrega un permiso de solo lectura del correo,
// que se guarda cifrado por Windows en esta computadora.
const { app, safeStorage, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { PublicClientApplication, InteractionRequiredAuthError } = require('@azure/msal-node');

const SCOPES = ['User.Read', 'Mail.Read', 'Mail.Read.Shared'];
const cacheFile = () => path.join(app.getPath('userData'), 'microsoft-sesion.bin');

const cachePlugin = {
  async beforeCacheAccess(ctx) {
    try {
      const raw = fs.readFileSync(cacheFile());
      ctx.tokenCache.deserialize(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8'));
    } catch {
      /* sin sesión guardada */
    }
  },
  async afterCacheAccess(ctx) {
    if (!ctx.cacheHasChanged) return;
    const data = ctx.tokenCache.serialize();
    fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
    fs.writeFileSync(cacheFile(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(data) : Buffer.from(data, 'utf8'));
  },
};

const page = (title, text) => `<!doctype html><html lang="es"><meta charset="utf-8"><title>${title}</title>
<body style="font-family:Segoe UI,Arial,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#f3f5f8;color:#0e1a2b">
<div style="text-align:center;max-width:420px"><h1 style="font-size:22px">${title}</h1><p>${text}</p></div></body></html>`;

let pca = null;
let pcaKey = '';

function clientFor(config) {
  const clientId = (config.msClientId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) throw new Error('Falta el "Id. de aplicación (cliente)" que entrega TI (36 caracteres, con guiones).');
  const tenant = (config.msTenantId || '').trim() || 'organizations';
  const key = `${clientId}|${tenant}`;
  if (!pca || pcaKey !== key) {
    pca = new PublicClientApplication({
      auth: { clientId, authority: `https://login.microsoftonline.com/${tenant}` },
      cache: { cachePlugin },
    });
    pcaKey = key;
  }
  return pca;
}

async function account(config) {
  const accounts = await clientFor(config).getTokenCache().getAllAccounts();
  return accounts[0] || null;
}

function friendlyAuthError(error) {
  const msg = String(error?.errorMessage || error?.message || error);
  if (/AADSTS65001|consent/i.test(msg)) return 'Falta aprobar los permisos de la aplicación. Pida a TI "Conceder consentimiento de administrador" (ver guía).';
  if (/AADSTS700016|not found in the directory/i.test(msg)) return 'El Id. de aplicación no existe en su organización. Revise que esté bien copiado.';
  if (/AADSTS50011|redirect/i.test(msg)) return 'Falta configurar la dirección de retorno "http://localhost" en la aplicación (ver guía para TI).';
  if (/AADSTS90002|tenant/i.test(msg)) return 'El Id. de directorio (inquilino) no es válido.';
  if (/user_cancelled|cancel/i.test(msg)) return 'Se canceló el inicio de sesión.';
  return `No se pudo iniciar sesión con Microsoft: ${msg}`;
}

/** Abre la ventana de Microsoft en el navegador y espera a que la persona inicie sesión. */
const LOGIN_TIMEOUT_MS = 5 * 60_000;

async function login(config) {
  let timer;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), LOGIN_TIMEOUT_MS);
    });
    const result = await Promise.race([timeout, clientFor(config).acquireTokenInteractive({
      scopes: SCOPES,
      prompt: 'select_account',
      openBrowser: (url) => shell.openExternal(url),
      successTemplate: page('Listo, ya puede volver al programa', 'El programa Becarios PACSI ya puede leer los CVs del correo. Puede cerrar esta pestaña.'),
      errorTemplate: page('No se pudo iniciar sesión', 'Vuelva al programa para ver el detalle.'),
    })]);
    return { ok: true, account: result.account?.username || '' };
  } catch (error) {
    if (error?.message === 'timeout') {
      pca = null; // descarta el intento pendiente
      return { ok: false, message: 'Pasaron 5 minutos sin iniciar sesión. Vuelva a intentarlo.' };
    }
    return { ok: false, message: friendlyAuthError(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** Token de lectura del correo; se renueva solo sin volver a pedir la contraseña. */
async function getToken(config) {
  const acc = await account(config);
  if (!acc) throw new Error('Inicie sesión con Microsoft para leer el correo.');
  try {
    const result = await clientFor(config).acquireTokenSilent({ account: acc, scopes: SCOPES });
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) throw new Error('La sesión de Microsoft venció. Vuelva a iniciar sesión (Más → Configurar correo).');
    throw new Error(friendlyAuthError(error));
  }
}

async function signedInUser(config) {
  try {
    return (await account(config))?.username || '';
  } catch {
    return '';
  }
}

async function logout(config) {
  try {
    const cache = clientFor(config).getTokenCache();
    for (const acc of await cache.getAllAccounts()) await cache.removeAccount(acc);
  } catch {
    /* nada */
  }
  fs.rmSync(cacheFile(), { force: true });
  pca = null;
}

module.exports = { login, logout, getToken, signedInUser, SCOPES };
