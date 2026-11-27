import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createGraphMailbox, htmlToText } = require('./graph.cjs');

type Route = (url: URL) => { status?: number; body: unknown };

/** Simula Microsoft Graph: responde según la ruta pedida y registra las llamadas. */
function fakeGraph(route: Route) {
  const calls: string[] = [];
  const fetchImpl = async (input: string, init: { headers: Record<string, string> }) => {
    calls.push(input);
    expect(init.headers.Authorization).toBe('Bearer token-de-prueba');
    const { status = 200, body } = route(new URL(input));
    return { ok: status < 400, status, headers: new Headers(), json: async () => body } as unknown as Response;
  };
  return { fetchImpl, calls };
}

const pdfBase64 = Buffer.from('%PDF-1.4 cv de prueba').toString('base64');
const msg = (id: string, subject: string, date: string) => ({
  id,
  internetMessageId: `<${id}@mail>`,
  subject,
  receivedDateTime: date,
  hasAttachments: true,
  from: { emailAddress: { name: `Postulante ${id}`, address: `${id}@gmail.com` } },
});

describe('createGraphMailbox (Microsoft 365)', () => {
  it('lista los correos de la bandeja con paginación y filtra por asunto sin tildes ni mayúsculas', async () => {
    const { fetchImpl, calls } = fakeGraph((url) => {
      if (url.pathname.endsWith('/me/mailFolders/inbox/messages') && !url.searchParams.has('page'))
        return { body: { value: [msg('a', 'BECARIOS 2027 - QUISPE ANA - INDUSTRIAL', '2026-09-20T10:00:00Z'), msg('b', 'Ofertas', '2026-09-21T10:00:00Z')], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?page=2' } };
      return { body: { value: [msg('c', 'Becarios 2027 – Mamani Luis', '2026-09-22T10:00:00Z')] } };
    });
    const box = createGraphMailbox({ getToken: async () => 'token-de-prueba', fetchImpl, subjectFilter: 'becarios', sinceDate: '2026-09-01' });
    const list = await box.list();
    expect(list.map((m: { uid: string }) => m.uid)).toEqual(['a', 'c']);
    expect(list[0]).toMatchObject({ messageId: '<a@mail>', fromAddress: 'a@gmail.com' });
    expect(decodeURIComponent(calls[0]!)).toContain('receivedDateTime ge 2026-09-01T00:00:00Z');
    expect(calls).toHaveLength(2);
  });

  it('baja los adjuntos de CV (PDF, Word, fotos) e ignora firmas incrustadas y otros archivos', async () => {
    const { fetchImpl } = fakeGraph((url) => {
      if (url.pathname.endsWith('/attachments'))
        return {
          body: {
            value: [
              { '@odata.type': '#microsoft.graph.fileAttachment', name: 'CV Ana.pdf', contentType: 'application/pdf', contentBytes: pdfBase64 },
              { '@odata.type': '#microsoft.graph.fileAttachment', name: 'firma.png', contentType: 'image/png', contentBytes: pdfBase64, isInline: true },
              { '@odata.type': '#microsoft.graph.fileAttachment', name: 'musica.mp3', contentType: 'audio/mpeg', contentBytes: pdfBase64 },
              { '@odata.type': '#microsoft.graph.itemAttachment', name: 'Correo reenviado' },
              { '@odata.type': '#microsoft.graph.fileAttachment', name: 'Certificado.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', contentBytes: pdfBase64 },
            ],
          },
        };
      return { body: { ...msg('a', 'BECARIOS 2027', '2026-09-20T10:00:00Z'), body: { contentType: 'html', content: '<p>Hola,<br>adjunto mi CV.&nbsp;DNI 72345678</p>' } } };
    });
    const box = createGraphMailbox({ getToken: async () => 'token-de-prueba', fetchImpl });
    const m = await box.get('a');
    expect(m.attachments.map((a: { filename: string }) => a.filename)).toEqual(['CV Ana.pdf', 'Certificado.docx']);
    expect(Buffer.from(m.attachments[0].content).toString()).toBe('%PDF-1.4 cv de prueba');
    expect(m.text).toContain('DNI 72345678');
  });

  it('usa el buzón compartido cuando es distinto de la cuenta con la que se inició sesión', async () => {
    const { fetchImpl, calls } = fakeGraph(() => ({ body: { displayName: 'Bandeja de entrada', totalItemCount: 42 } }));
    const shared = createGraphMailbox({ getToken: async () => 'token-de-prueba', fetchImpl, mailbox: 'reclutamiento@pacsiingenieros.com', signedInUser: 'ana@pacsiingenieros.com' });
    expect(await shared.info()).toEqual({ folder: 'Bandeja de entrada', total: 42 });
    expect(calls[0]).toContain('/users/reclutamiento%40pacsiingenieros.com/mailFolders/inbox');
    const own = createGraphMailbox({ getToken: async () => 'token-de-prueba', fetchImpl, mailbox: 'Reclutamiento@PacsiIngenieros.com', signedInUser: 'reclutamiento@pacsiingenieros.com' });
    await own.info();
    expect(calls[1]).toContain('/me/mailFolders/inbox');
  });

  it('busca una carpeta por su nombre (también subcarpetas de la bandeja)', async () => {
    const { fetchImpl, calls } = fakeGraph((url) => {
      if (url.pathname.endsWith('/me/mailFolders') ) return { body: { value: [] } };
      if (url.pathname.endsWith('/childFolders')) return { body: { value: [{ id: 'F1', displayName: 'Becarios 2027' }] } };
      return { body: { displayName: 'Becarios 2027', totalItemCount: 7 } };
    });
    const box = createGraphMailbox({ getToken: async () => 'token-de-prueba', fetchImpl, folder: 'Becarios 2027' });
    expect(await box.info()).toEqual({ folder: 'Becarios 2027', total: 7 });
    expect(calls.at(-1)).toContain('/me/mailFolders/F1');
  });

  it('explica en español los errores de permisos y de buzón', async () => {
    const forbidden = fakeGraph(() => ({ status: 403, body: { error: { code: 'ErrorAccessDenied' } } }));
    const box = createGraphMailbox({ getToken: async () => 'token-de-prueba', fetchImpl: forbidden.fetchImpl, mailbox: 'reclutamiento@pacsiingenieros.com', signedInUser: 'ana@x.com' });
    await expect(box.info()).rejects.toThrow(/no tiene permiso para leer el buzón reclutamiento@pacsiingenieros.com/);
    const expired = fakeGraph(() => ({ status: 401, body: {} }));
    await expect(createGraphMailbox({ getToken: async () => 'token-de-prueba', fetchImpl: expired.fetchImpl }).list()).rejects.toThrow(/sesión de Microsoft venció/);
  });

  it('htmlToText deja texto legible', () => {
    expect(htmlToText('<style>p{}</style><div>Hola&nbsp;<b>Ana</b></div><p>DNI&amp;CV</p>')).toBe('Hola Ana\nDNI&CV');
  });
});
