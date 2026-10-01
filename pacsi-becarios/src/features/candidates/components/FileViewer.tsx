import { useEffect, useRef, useState } from 'react';
import type { CandidateFile } from '../../../domain/types';
import { extractText, fileKind, pdfjs } from '../../../cv/textExtract';
import { fileStore } from '../../../lib/fileStore';
import { DEMO } from '../../../demo';
import { Dialog } from './Dialog';

/** Muestra el CV original (PDF página por página, imagen o texto de Word) dentro del programa. */
export function FileViewer({ file, onClose }: { file: CandidateFile; onClose: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [text, setText] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      const blob = await fileStore.get(file.id);
      if (!blob) return setState('missing');
      url = URL.createObjectURL(blob);
      setBlobUrl(url);
      const kind = fileKind(file.name, file.type);
      if (kind === 'imagen') {
        setImageUrl(url);
      } else if (kind === 'word') {
        setText((await extractText(await blob.arrayBuffer(), file.name, file.type)).text);
      } else if (kind === 'pdf') {
        const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
        const doc = await task.promise;
        for (let i = 1; i <= doc.numPages && !cancelled; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = 'viewer__page';
          await page.render({ canvas, viewport }).promise;
          container.current?.append(canvas);
        }
        void task.destroy();
      }
      if (!cancelled) setState('ready');
    })().catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <Dialog title={file.name} eyebrow="CV original" variant="viewer" onClose={onClose}
      header={blobUrl && !DEMO ? <a className="btn btn--link" href={blobUrl} download={file.name}>Descargar archivo</a> : undefined}>
      {state === 'loading' && <div className="progress"><span className="spinner" aria-hidden="true" /> Abriendo…</div>}
      {state === 'missing' && <p className="form-error">El archivo no está en esta computadora (puede venir de una copia de seguridad).</p>}
      {state === 'error' && <p className="form-error">No se pudo mostrar el archivo.</p>}
      {imageUrl && <img src={imageUrl} alt={file.name} className="viewer__page" />}
      {text !== null && <pre className="viewer__text">{text}</pre>}
      <div ref={container} className="viewer__pages" />
    </Dialog>
  );
}
