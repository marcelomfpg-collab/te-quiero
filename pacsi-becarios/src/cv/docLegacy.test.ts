import { describe, expect, it } from 'vitest';
import { extractLegacyDocText } from './docLegacy';
import { parseCv } from './cvParser';

function utf16(text: string): number[] {
  return [...text].flatMap((ch) => [ch.charCodeAt(0) & 0xff, ch.charCodeAt(0) >> 8]);
}

describe('extractLegacyDocText (.doc antiguo)', () => {
  it('recupera el texto UTF-16 entre basura binaria y el lector encuentra los datos', () => {
    const junk = Array.from({ length: 300 }, (_, i) => (i * 37) % 256);
    const body = 'Luis Mamani Ccama\rDNI: 45678912\rIngeniería Eléctrica - VIII ciclo\rLicencia de conducir A-I\rDirección: Cayma, Arequipa\r';
    const bytes = new Uint8Array([...junk, ...utf16(body), ...junk, ...utf16(body)]);
    const text = extractLegacyDocText(bytes.buffer);
    expect(text).toContain('DNI: 45678912');
    expect(text.match(/45678912/g)).toHaveLength(1); // sin duplicados
    const ext = parseCv(text, { today: '2026-10-01' });
    expect(ext.dni?.value).toBe('45678912');
    expect(ext.career?.value.career).toBe('ELECTRICA');
    expect(ext.studyYear?.value).toBe(4);
    expect(ext.license?.value).toBe('A_I');
  });

  it('entiende Word guardado en Windows-1252 (tildes incluidas)', () => {
    const cp = [...'Administración de Empresas\rDNI 72221111\r'].map((c) => c.charCodeAt(0));
    const text = extractLegacyDocText(new Uint8Array([0, 1, 2, 3, ...cp, 0, 0, 0]).buffer);
    expect(text).toContain('Administración de Empresas');
  });
});
