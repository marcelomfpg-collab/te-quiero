/**
 * Versión de prueba en línea (build con VITE_DEMO=1): sin marca de la empresa, sin guardar datos,
 * sin descargas ni conexión al correo, y con CVs de ejemplo para probar la lectura con un clic.
 */
export const DEMO = import.meta.env.VITE_DEMO === '1';

/** En la versión de prueba no hay ventanas de confirmación del navegador. */
export const ask = (message: string): boolean => DEMO || window.confirm(message);

export async function sampleCvFiles(): Promise<File[]> {
  const { SAMPLE_CVS } = await import('./cv/samples/samples');
  return SAMPLE_CVS.map(({ name, base64 }) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const type = name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return new File([bytes], name, { type });
  });
}
