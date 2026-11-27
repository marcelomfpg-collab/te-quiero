import { describe, expect, it } from 'vitest';
import { groupFolderFiles, parseFolderName } from './importFolder';

const f = (name: string, mtimeMs = 1): FolderFile => ({ rel: `Becarios 2027/${name}`, name, size: 100, mtimeMs });

describe('archivos guardados por Power Automate', () => {
  it('separa el correo del remitente y el nombre original del adjunto', () => {
    expect(parseFolderName('Kevin.MF@hotmail.com__CV Kevin.pdf')).toEqual({ sender: 'kevin.mf@hotmail.com', original: 'CV Kevin.pdf' });
    expect(parseFolderName('ana.quispe@gmail.com_Certificado_trabajo.pdf')).toEqual({ sender: 'ana.quispe@gmail.com', original: 'Certificado_trabajo.pdf' });
    expect(parseFolderName('CV_Juan_Perez.pdf')).toEqual({ original: 'CV_Juan_Perez.pdf' });
  });

  it('junta el CV y el certificado del mismo remitente; los archivos sueltos van solos', () => {
    const groups = groupFolderFiles([
      f('kevin@hotmail.com__CV.pdf'),
      f('ana@gmail.com__CV Ana.pdf'),
      f('kevin@hotmail.com__Certificado.docx'),
      f('CV_suelto.pdf'),
    ]);
    expect(groups.map((g) => [g.sender, g.files.map((x) => parseFolderName(x.name).original)])).toEqual([
      ['kevin@hotmail.com', ['CV.pdf', 'Certificado.docx']],
      ['ana@gmail.com', ['CV Ana.pdf']],
      [undefined, ['CV_suelto.pdf']],
    ]);
  });
});
