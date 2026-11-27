import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';

/** Elegir la carpeta (OneDrive) donde Power Automate guarda los CVs del correo. */
export function FolderDialog({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const folder = window.pacsiDesktop!.folder;
  const [path, setPath] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void folder.getConfig().then((c) => {
      if (!c) return;
      setPath(c.path);
      setMinutes(c.autoCheckMinutes);
    });
  }, [folder]);

  const choose = async () => {
    const chosen = await folder.choose();
    if (chosen) {
      setPath(chosen);
      setError(null);
    }
  };

  const save = async () => {
    if (!path) return setError('Elija la carpeta donde llegan los CVs.');
    await folder.saveConfig({ path, autoCheckMinutes: minutes });
    onSaved();
  };

  return (
    <Dialog title="Vigilar la carpeta de CVs" eyebrow="Outlook → OneDrive → este programa" onClose={onClose}>
      <div className="form">
        <p className="dialog__lead">
          Una regla de Power Automate guarda en una carpeta de OneDrive los CVs que llegan al correo. El programa revisa esa
          carpeta y lee solo cada archivo nuevo. No hace falta ningún permiso de TI.
        </p>

        <div className={`folder-pick ${path ? 'is-on' : ''}`}>
          <span className="folder-pick__path">{path || 'Ninguna carpeta elegida'}</span>
          <button type="button" className="btn btn--secondary" onClick={choose}>
            {path ? 'Cambiar carpeta' : 'Elegir carpeta'}
          </button>
        </div>
        <p className="hint">
          Normalmente: <em>OneDrive - Pacsi Ingenieros → Becarios 2027</em>. OneDrive debe estar abierto en esta computadora para que
          los archivos lleguen.
        </p>

        <label className="field">
          <span className="field__label">Revisar automáticamente</span>
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            <option value={0}>No, solo con el botón</option>
            <option value={5}>Cada 5 minutos</option>
            <option value={15}>Cada 15 minutos</option>
            <option value={60}>Cada hora</option>
          </select>
        </label>

        <details className="guide" open={!path}>
          <summary>Cómo crear la regla en Power Automate (una sola vez, unos 10 minutos)</summary>
          <ol>
            <li>
              Entre a <strong>make.powerautomate.com</strong> con la cuenta de Microsoft de la empresa → <em>Crear → Flujo de nube automatizado</em>.
            </li>
            <li>
              Nombre: <strong>CVs Becarios</strong>. Desencadenador: <strong>"Cuando llega un nuevo correo electrónico (V3)"</strong> (Office 365
              Outlook). Si los CVs llegan a un buzón compartido, use <strong>"Cuando llega un nuevo correo electrónico a un buzón compartido (V2)"</strong>{' '}
              y escriba <code>reclutamiento@pacsiingenieros.com</code>.
            </li>
            <li>
              En las opciones del desencadenador: <em>Incluir datos adjuntos</em> = <strong>Sí</strong>, <em>Solo con datos adjuntos</em> ={' '}
              <strong>Sí</strong>, <em>Filtro de asunto</em> = <strong>BECARIOS</strong>.
            </li>
            <li>
              Agregue la acción <strong>"Crear archivo"</strong> (OneDrive para la Empresa). Power Automate la pone dentro de un
              <em> "Aplicar a cada uno"</em> de los datos adjuntos.
            </li>
            <li>
              <em>Ruta de acceso de la carpeta</em>: <code>/Becarios 2027</code>. <em>Nombre de archivo</em>: el <strong>correo del remitente</strong>,
              luego <code>__</code> (dos guiones bajos) y el <strong>nombre del dato adjunto</strong>. Por ejemplo:{' '}
              <code>{'@{triggerOutputs()?[\'body/from\']}__@{items(\'Apply_to_each\')?[\'name\']}'}</code>. <em>Contenido</em>: el{' '}
              <strong>contenido del dato adjunto</strong>.
            </li>
            <li>
              Guarde y envíese un correo de prueba con asunto "BECARIOS 2027 - PRUEBA" y un PDF. En un minuto debe aparecer en la carpeta.
            </li>
          </ol>
          <p className="muted">
            El correo del remitente al inicio del nombre sirve para juntar el CV y los certificados de la misma persona. Si un certificado
            llega después, se agrega al postulante que ya existe.
          </p>
        </details>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={!path}>
            Guardar y leer CVs
          </button>
        </div>
      </div>
    </Dialog>
  );
}
