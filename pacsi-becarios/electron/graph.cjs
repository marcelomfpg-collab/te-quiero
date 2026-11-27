// Lectura del buzón de Microsoft 365 con Microsoft Graph (la API oficial de Outlook).
// No depende de Electron: recibe cómo pedir el token y cómo hacer fetch, para poder probarlo.
const GRAPH = 'https://graph.microsoft.com/v1.0';
const CV_TYPES = /\.(pdf|docx?|png|jpe?g|webp)$/i;

const normalize = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Texto plano a partir del HTML del correo (para buscar datos que vienen en el cuerpo). */
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n\s*/g, '\n')
    .trim();
}

class GraphError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function friendly(status, body, mailbox) {
  const code = body?.error?.code || '';
  if (status === 401) return 'La sesión de Microsoft venció. Vuelva a iniciar sesión.';
  if (status === 403 || code === 'ErrorAccessDenied')
    return mailbox
      ? `Su cuenta no tiene permiso para leer el buzón ${mailbox}. Pida a TI acceso a ese buzón (o inicie sesión con esa cuenta).`
      : 'Microsoft no dio permiso para leer el correo. Pida a TI que apruebe los permisos de la aplicación.';
  if (status === 404 || code === 'ErrorInvalidUser' || code === 'MailboxNotEnabledForRESTAPI')
    return mailbox ? `No se encontró el buzón ${mailbox}.` : 'No se encontró la carpeta de correo.';
  return `Microsoft respondió con un error (${status}${code ? `: ${code}` : ''}).`;
}

/**
 * @param {{ getToken: () => Promise<string>, fetchImpl?: typeof fetch, mailbox?: string, signedInUser?: string,
 *           folder?: string, subjectFilter?: string, sinceDate?: string, base?: string }} opts
 */
function createGraphMailbox(opts) {
  const fetchImpl = opts.fetchImpl || fetch;
  const base = opts.base || GRAPH;
  const mailbox = (opts.mailbox || '').trim();
  // Si el buzón es la misma cuenta con la que se inició sesión, se usa /me (no hace falta permiso de buzón compartido).
  const useMe = !mailbox || normalize(mailbox) === normalize(opts.signedInUser);
  const root = useMe ? '/me' : `/users/${encodeURIComponent(mailbox)}`;
  const shared = useMe ? '' : mailbox;
  let folderPath = null;

  async function call(pathOrUrl, attempt = 0) {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${base}${pathOrUrl}`;
    const token = await opts.getToken();
    const resp = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (resp.status === 429 && attempt < 2) {
      const wait = Math.min(Number(resp.headers.get('retry-after')) || 5, 30);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return call(pathOrUrl, attempt + 1);
    }
    const body = await resp.json().catch(() => null);
    if (!resp.ok) throw new GraphError(friendly(resp.status, body, shared), resp.status);
    return body;
  }

  /** "Bandeja de entrada" / "INBOX" → carpeta estándar; cualquier otro nombre se busca por su nombre visible. */
  async function resolveFolder() {
    if (folderPath) return folderPath;
    const name = (opts.folder || '').trim();
    if (!name || /^(inbox|bandeja de entrada|recibidos)$/i.test(normalize(name))) {
      folderPath = `${root}/mailFolders/inbox`;
      return folderPath;
    }
    const escaped = name.replace(/'/g, "''");
    const res = await call(`${root}/mailFolders?$filter=displayName eq '${encodeURIComponent(escaped)}'&$select=id,displayName`);
    let found = res?.value?.[0];
    if (!found) {
      // También dentro de la bandeja de entrada (subcarpetas como "Becarios 2027").
      const sub = await call(`${root}/mailFolders/inbox/childFolders?$filter=displayName eq '${encodeURIComponent(escaped)}'&$select=id,displayName`);
      found = sub?.value?.[0];
    }
    if (!found) throw new GraphError(`No existe la carpeta "${name}" en el correo.`, 404);
    folderPath = `${root}/mailFolders/${found.id}`;
    return folderPath;
  }

  return {
    /** Prueba de conexión: cuántos correos hay en la carpeta. */
    async info() {
      const path = await resolveFolder();
      const folder = await call(`${path}?$select=displayName,totalItemCount`);
      return { folder: folder.displayName, total: folder.totalItemCount };
    },

    async list() {
      const path = await resolveFolder();
      const params = ['$select=id,internetMessageId,subject,from,receivedDateTime,hasAttachments', '$top=50', '$orderby=receivedDateTime asc'];
      if (opts.sinceDate) params.push(`$filter=receivedDateTime ge ${opts.sinceDate}T00:00:00Z`);
      let next = `${path}/messages?${params.join('&')}`;
      const out = [];
      while (next) {
        const page = await call(next);
        for (const m of page.value || []) {
          if (opts.subjectFilter && !normalize(m.subject).includes(normalize(opts.subjectFilter))) continue;
          out.push({
            uid: m.id,
            messageId: m.internetMessageId || m.id,
            subject: m.subject || '',
            date: m.receivedDateTime || new Date().toISOString(),
            fromName: m.from?.emailAddress?.name || '',
            fromAddress: m.from?.emailAddress?.address || '',
            hasAttachments: Boolean(m.hasAttachments),
          });
        }
        next = page['@odata.nextLink'] || null;
      }
      return out;
    },

    async get(id) {
      const msg = await call(`${root}/messages/${encodeURIComponent(id)}?$select=id,internetMessageId,subject,from,receivedDateTime,hasAttachments,body`);
      const attachments = [];
      if (msg.hasAttachments) {
        let next = `${root}/messages/${encodeURIComponent(id)}/attachments`;
        while (next) {
          const page = await call(next);
          for (const a of page.value || []) {
            const isFile = a['@odata.type'] === '#microsoft.graph.fileAttachment';
            if (!isFile || !a.contentBytes || a.isInline) continue;
            if (!CV_TYPES.test(a.name || '') && a.contentType !== 'application/pdf') continue;
            attachments.push({ filename: a.name || 'adjunto.pdf', contentType: a.contentType || 'application/octet-stream', content: new Uint8Array(Buffer.from(a.contentBytes, 'base64')) });
          }
          next = page['@odata.nextLink'] || null;
        }
      }
      const text = msg.body?.contentType === 'html' ? htmlToText(msg.body.content) : String(msg.body?.content || '');
      return {
        uid: id,
        messageId: msg.internetMessageId || msg.id,
        subject: msg.subject || '',
        date: msg.receivedDateTime || new Date().toISOString(),
        fromName: msg.from?.emailAddress?.name || '',
        fromAddress: msg.from?.emailAddress?.address || '',
        hasAttachments: attachments.length > 0,
        text: text.slice(0, 20_000),
        attachments,
      };
    },
  };
}

module.exports = { createGraphMailbox, htmlToText, GraphError };
