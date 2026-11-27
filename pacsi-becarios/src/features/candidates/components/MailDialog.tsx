import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CONVOCATORIA } from '../../../domain/convocatoria';
import { Dialog } from './Dialog';

const DEFAULTS: MailConfig = {
  provider: 'microsoft',
  msClientId: '',
  msTenantId: '',
  msMailbox: CONVOCATORIA.email,
  host: 'mail.pacsiingenieros.com',
  port: 993,
  secure: true,
  user: CONVOCATORIA.email,
  password: '',
  folder: 'Bandeja de entrada',
  subjectFilter: 'BECARIOS',
  sinceDate: '2026-09-01',
  autoCheckMinutes: 15,
};

type Status = { ok: boolean; message: string } | null;

/** Conectar el buzón de reclutamiento: Microsoft 365 (inicio de sesión oficial) u otro servidor (IMAP). */
export function MailDialog({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const mail = window.pacsiDesktop!.mail;
  const [config, setConfig] = useState<MailConfig>(DEFAULTS);
  const [hasPassword, setHasPassword] = useState(false);
  const [account, setAccount] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const ms = config.provider === 'microsoft';
  const attempt = useRef(0);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    void mail.getConfig().then((saved) => {
      if (!saved) return;
      const { hasPassword: has, msAccount, ready: _ready, ...rest } = saved;
      setConfig({ ...DEFAULTS, ...rest, password: '' });
      setHasPassword(has);
      setAccount(msAccount);
    });
  }, [mail]);

  const set = <K extends keyof MailConfig>(key: K, value: MailConfig[K]) => setConfig((c) => ({ ...c, [key]: value }));

  const signIn = async () => {
    const id = ++attempt.current;
    setSigningIn(true);
    setBusy('Se abrió la ventana de Microsoft en su navegador. Inicie sesión ahí y vuelva aquí…');
    setStatus(null);
    const result = await mail.msLogin(config);
    if (id !== attempt.current) return; // la persona canceló este intento
    setSigningIn(false);
    setBusy(null);
    if (result.ok) {
      setAccount(result.account ?? '');
      setStatus(await mail.test(config));
    } else setStatus({ ok: false, message: result.message ?? 'No se pudo iniciar sesión.' });
  };

  const signOut = async () => {
    await mail.msLogout();
    setAccount('');
    setStatus({ ok: true, message: 'Se cerró la sesión de Microsoft en esta computadora.' });
  };

  const test = async () => {
    setBusy('Probando conexión…');
    setStatus(await mail.test(config));
    setBusy(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (ms && !account) return setStatus({ ok: false, message: 'Primero inicie sesión con Microsoft.' });
    if (!ms && !config.password && !hasPassword) return setStatus({ ok: false, message: 'Ingrese la contraseña del correo.' });
    setBusy('Conectando…');
    const result = await mail.test(config);
    if (!result.ok) {
      setStatus(result);
      setBusy(null);
      return;
    }
    await mail.saveConfig(config);
    setBusy(null);
    onSaved();
  };

  return (
    <Dialog title="Conectar el correo de reclutamiento" eyebrow="Bajar los CVs automáticamente" onClose={busy ? () => undefined : onClose}>
      <form className="form" onSubmit={save}>
        <div className="segmented provider" role="radiogroup" aria-label="Tipo de cuenta de correo">
          <button type="button" role="radio" aria-checked={ms} className={`segmented__item ${ms ? 'is-active' : ''}`} onClick={() => set('provider', 'microsoft')}>
            Microsoft 365 / Outlook de empresa
          </button>
          <button type="button" role="radio" aria-checked={!ms} className={`segmented__item ${!ms ? 'is-active' : ''}`} onClick={() => set('provider', 'imap')}>
            Otro servidor (usuario y contraseña)
          </button>
        </div>

        {ms ? (
          <>
            <p className="dialog__lead">
              Se inicia sesión con la ventana oficial de Microsoft, la misma de Outlook. El programa solo obtiene permiso para
              <strong> leer</strong> el correo: no puede enviar, borrar ni ver su contraseña.
            </p>
            <div className="form__grid">
              <label className="field">
                <span className="field__label">Id. de aplicación (cliente)</span>
                <input id="ms-client" value={config.msClientId} onChange={(e) => set('msClientId', e.target.value.trim())} placeholder="00000000-0000-0000-0000-000000000000" />
              </label>
              <label className="field">
                <span className="field__label">Id. de directorio (inquilino)</span>
                <input id="ms-tenant" value={config.msTenantId} onChange={(e) => set('msTenantId', e.target.value.trim())} placeholder="Lo entrega TI (opcional)" />
              </label>
              <label className="field form__wide">
                <span className="field__label">Buzón donde llegan los CVs</span>
                <input id="ms-mailbox" value={config.msMailbox} onChange={(e) => set('msMailbox', e.target.value.trim())} />
                <span className="hint">Si inicia sesión con otra cuenta, esa cuenta necesita acceso a este buzón (buzón compartido).</span>
              </label>
            </div>

            <div className={`ms-account ${account ? 'is-on' : ''}`}>
              {account ? (
                <>
                  <span>
                    ✓ Sesión iniciada como <strong>{account}</strong>
                  </span>
                  <button type="button" className="btn btn--link" onClick={signOut} disabled={!!busy}>
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn--ms" onClick={signIn} disabled={!!busy || !config.msClientId}>
                  <span className="ms-logo" aria-hidden="true">
                    <i /><i /><i /><i />
                  </span>
                  Iniciar sesión con Microsoft
                </button>
              )}
            </div>

            <details className="guide">
              <summary>¿No tiene el Id. de aplicación? Guía para el área de TI (una sola vez, unos 10 minutos)</summary>
              <ol>
                <li>
                  Entrar a <strong>entra.microsoft.com</strong> con una cuenta administradora → <em>Aplicaciones → Registros de aplicaciones → Nuevo registro</em>.
                </li>
                <li>
                  Nombre: <strong>Becarios PACSI</strong>. Tipos de cuenta: <em>Solo cuentas de este directorio organizativo</em>.
                </li>
                <li>
                  URI de redirección: plataforma <strong>"Cliente público/nativo (móvil y escritorio)"</strong> con el valor <code>http://localhost</code>. Registrar.
                </li>
                <li>
                  En <em>Permisos de API → Agregar permiso → Microsoft Graph → Permisos delegados</em>, agregar <strong>Mail.Read</strong>,{' '}
                  <strong>Mail.Read.Shared</strong> y <strong>User.Read</strong>. Luego <strong>"Conceder consentimiento de administrador"</strong>.
                </li>
                <li>
                  Si los CVs llegan a un buzón compartido, dar a la persona de RR. HH. permiso de <em>lectura</em> sobre ese buzón (Centro de administración de Exchange).
                </li>
                <li>
                  Copiar de la página <em>Información general</em> el <strong>Id. de aplicación (cliente)</strong> y el <strong>Id. de directorio (inquilino)</strong> y pegarlos arriba.
                </li>
              </ol>
              <p className="muted">Es gratuito. Los permisos son solo de lectura y se pueden quitar en cualquier momento desde el mismo registro.</p>
            </details>
          </>
        ) : (
          <>
            <p className="dialog__lead">
              Para correos del hosting de la página web. Los datos están en Outlook: <em>Archivo → Configuración de la cuenta → Cambiar</em>.
            </p>
            <div className="form__grid">
              <label className="field">
                <span className="field__label">Servidor de correo entrante (IMAP)</span>
                <input value={config.host} onChange={(e) => set('host', e.target.value.trim())} placeholder="mail.pacsiingenieros.com" />
              </label>
              <label className="field">
                <span className="field__label">Puerto</span>
                <input type="number" value={config.port} onChange={(e) => set('port', Number(e.target.value))} />
              </label>
              <label className="field">
                <span className="field__label">Usuario (correo)</span>
                <input value={config.user} onChange={(e) => set('user', e.target.value.trim())} />
              </label>
              <label className="field">
                <span className="field__label">Contraseña</span>
                <input type="password" value={config.password} onChange={(e) => set('password', e.target.value)} placeholder={hasPassword ? '•••••••• (guardada)' : ''} autoComplete="off" />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={config.secure} onChange={(e) => set('secure', e.target.checked)} /> Conexión segura SSL/TLS (puerto 993)
            </label>
            <p className="muted">🔒 La contraseña se guarda cifrada en esta computadora.</p>
          </>
        )}

        <fieldset className="form__group">
          <legend>Qué correos bajar</legend>
          <div className="form__grid">
            <label className="field">
              <span className="field__label">Solo si el asunto contiene</span>
              <input value={config.subjectFilter} onChange={(e) => set('subjectFilter', e.target.value)} placeholder="(vacío = todos)" />
            </label>
            <label className="field">
              <span className="field__label">Recibidos desde</span>
              <input type="date" value={config.sinceDate} onChange={(e) => set('sinceDate', e.target.value)} />
            </label>
            <label className="field">
              <span className="field__label">Carpeta</span>
              <input value={config.folder} onChange={(e) => set('folder', e.target.value)} />
            </label>
            <label className="field">
              <span className="field__label">Revisar automáticamente</span>
              <select value={config.autoCheckMinutes} onChange={(e) => set('autoCheckMinutes', Number(e.target.value))}>
                <option value={0}>No, solo con el botón</option>
                <option value={15}>Cada 15 minutos</option>
                <option value={30}>Cada 30 minutos</option>
                <option value={60}>Cada hora</option>
              </select>
            </label>
          </div>
        </fieldset>

        {busy && (
          <div className="progress" role="status">
            <span className="spinner" aria-hidden="true" />
            <span>{busy}</span>
            {signingIn && (
              <button
                type="button"
                className="btn btn--link"
                onClick={() => {
                  attempt.current++;
                  setSigningIn(false);
                  setBusy(null);
                  setStatus({ ok: false, message: 'Se canceló el inicio de sesión.' });
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        )}
        {status && !busy && (
          <p className={status.ok ? 'form-ok' : 'form-error'} role="status">
            {status.message}
          </p>
        )}
        <div className="dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={test} disabled={!!busy || (ms && !account)}>
            Probar conexión
          </button>
          <button type="submit" className="btn btn--primary" disabled={!!busy}>
            Guardar y bajar CVs
          </button>
        </div>
      </form>
    </Dialog>
  );
}
