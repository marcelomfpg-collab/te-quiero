import { useEffect, useState, type FormEvent } from 'react';
import { CONVOCATORIA } from '../../../domain/convocatoria';
import { Dialog } from './Dialog';

const DEFAULTS: MailConfig = {
  host: 'mail.pacsiingenieros.com',
  port: 993,
  secure: true,
  user: CONVOCATORIA.email,
  password: '',
  folder: 'INBOX',
  subjectFilter: 'BECARIOS',
  sinceDate: '2026-09-01',
  autoCheckMinutes: 15,
};

/** Configurar la conexión con el correo de reclutamiento (los mismos datos que usa Outlook). */
export function MailDialog({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const mail = window.pacsiDesktop!.mail;
  const [config, setConfig] = useState<MailConfig>(DEFAULTS);
  const [hasPassword, setHasPassword] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void mail.getConfig().then((saved) => {
      if (!saved) return;
      const { hasPassword: has, ...rest } = saved;
      setConfig({ ...DEFAULTS, ...rest, password: '' });
      setHasPassword(has);
    });
  }, [mail]);

  const set = <K extends keyof MailConfig>(key: K, value: MailConfig[K]) => setConfig((c) => ({ ...c, [key]: value }));

  const test = async () => {
    setBusy(true);
    setStatus(null);
    setStatus(await mail.test(config));
    setBusy(false);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!config.password && !hasPassword) {
      setStatus({ ok: false, message: 'Ingrese la contraseña del correo.' });
      return;
    }
    setBusy(true);
    const result = await mail.test(config);
    if (!result.ok) {
      setStatus(result);
      setBusy(false);
      return;
    }
    await mail.saveConfig(config);
    setBusy(false);
    onSaved();
  };

  return (
    <Dialog title="Conectar el correo de reclutamiento" eyebrow="Los mismos datos que usa Outlook" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <p className="dialog__lead">
          El programa revisa el buzón y baja solo los CVs. Los datos del servidor los encuentra en Outlook:{' '}
          <em>Archivo → Configuración de la cuenta → Cambiar</em>, o se los da el área de sistemas o el proveedor de la página web.
        </p>
        <div className="form__grid">
          <label className="field">
            <span className="field__label">Servidor de correo entrante (IMAP)</span>
            <input value={config.host} onChange={(e) => set('host', e.target.value.trim())} placeholder="mail.pacsiingenieros.com" required />
          </label>
          <label className="field">
            <span className="field__label">Puerto</span>
            <input type="number" value={config.port} onChange={(e) => set('port', Number(e.target.value))} />
          </label>
          <label className="field">
            <span className="field__label">Usuario (correo)</span>
            <input value={config.user} onChange={(e) => set('user', e.target.value.trim())} required />
          </label>
          <label className="field">
            <span className="field__label">Contraseña</span>
            <input
              type="password"
              value={config.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder={hasPassword ? '•••••••• (guardada)' : ''}
              autoComplete="off"
            />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={config.secure} onChange={(e) => set('secure', e.target.checked)} /> Conexión segura SSL/TLS
          (puerto 993)
        </label>

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

        <p className="muted">🔒 La contraseña se guarda cifrada en esta computadora y solo se usa para leer el correo.</p>
        {status && (
          <p className={status.ok ? 'form-ok' : 'form-error'} role="status">
            {status.message}
          </p>
        )}
        <div className="dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={test} disabled={busy}>
            Probar conexión
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Conectando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
