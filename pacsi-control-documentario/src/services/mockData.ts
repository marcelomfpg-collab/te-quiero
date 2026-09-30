import type { Company, DocumentType, FleetDocument, VehicleType } from '../domain/types';
import { addDays } from '../lib/dates';
import { createRandom } from '../lib/random';

const ISSUERS: Record<DocumentType, string[]> = {
  SOAT: ['Rímac Seguros', 'Pacífico Seguros', 'La Positiva', 'Mapfre Perú'],
  REVISION_TECNICA: ['Farenet', 'Revitec', 'Certificadora Lima Norte'],
  POLIZA_SEGURO: ['Rímac Seguros', 'Pacífico Seguros', 'Mapfre Perú'],
  CERTIFICADO_MTC: ['MTC - DGTT'],
  TARJETA_PROPIEDAD: ['SUNARP'],
  CERTIFICADO_MATPEL: ['MTC - DGAAM', 'OSINERGMIN'],
};

/** Vigencia típica en días de cada documento. */
const VALIDITY_DAYS: Record<DocumentType, number> = {
  SOAT: 365,
  REVISION_TECNICA: 365,
  POLIZA_SEGURO: 365,
  CERTIFICADO_MTC: 730,
  TARJETA_PROPIEDAD: 3650,
  CERTIFICADO_MATPEL: 365,
};

const RESPONSIBLES = ['M. Paredes', 'L. Quispe', 'R. Huamán', 'A. Torres', 'C. Rojas', 'J. Salazar'];
const COMPANIES: Company[] = ['HAGEMSA', 'HAGEMSA', 'SERVOSA', 'SERVOSA', 'PACSI'];
const VEHICLES: VehicleType[] = ['TRACTO', 'SEMIRREMOLQUE', 'CISTERNA', 'CAMION', 'CAMIONETA'];
const TYPES = Object.keys(VALIDITY_DAYS) as DocumentType[];
const LETTERS = 'ABCDFGHJKMPRTVWXYZ';

/** Genera una flota verosímil con documentos repartidos entre vencidos, por vencer y vigentes. */
export function generateMockDocuments(today: string, vehicleCount = 220, seed = 20260930): FleetDocument[] {
  const rnd = createRandom(seed);
  const docs: FleetDocument[] = [];
  let sequence = 0;

  for (let v = 0; v < vehicleCount; v++) {
    const plate = `${rnd.pick([...LETTERS])}${rnd.int(1, 9)}${rnd.pick([...LETTERS])}-${String(rnd.int(0, 999)).padStart(3, '0')}`;
    const company = rnd.pick(COMPANIES);
    const vehicleType = rnd.pick(VEHICLES);

    for (const type of TYPES) {
      if (type === 'CERTIFICADO_MATPEL' && vehicleType !== 'CISTERNA') continue;
      sequence++;
      const expiryDate = addDays(today, rnd.int(-120, VALIDITY_DAYS[type] - 30));
      const issueDate = addDays(expiryDate, -VALIDITY_DAYS[type]);
      docs.push({
        id: `doc-${sequence}`,
        code: `DOC-${String(sequence).padStart(5, '0')}`,
        plate,
        vehicleType,
        company,
        type,
        number: `${type.slice(0, 3)}-${rnd.int(100000, 999999)}`,
        issuer: rnd.pick(ISSUERS[type]),
        issueDate,
        expiryDate,
        inRenewal: rnd.chance(0.07),
        responsible: rnd.pick(RESPONSIBLES),
        updatedAt: addDays(today, -rnd.int(0, 60)),
      });
    }
  }
  return docs;
}
