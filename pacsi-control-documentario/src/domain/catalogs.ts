import type { Company, DocumentStatus, DocumentType, VehicleType } from './types';

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const COMPANIES: Option<Company>[] = [
  { value: 'HAGEMSA', label: 'Hagemsa' },
  { value: 'SERVOSA', label: 'Servosa' },
  { value: 'PACSI', label: 'Pacsi (flota propia)' },
];

export const DOCUMENT_TYPES: Option<DocumentType>[] = [
  { value: 'SOAT', label: 'SOAT' },
  { value: 'REVISION_TECNICA', label: 'Revisión técnica' },
  { value: 'POLIZA_SEGURO', label: 'Póliza de seguro' },
  { value: 'CERTIFICADO_MTC', label: 'Certificado MTC' },
  { value: 'TARJETA_PROPIEDAD', label: 'Tarjeta de propiedad' },
  { value: 'CERTIFICADO_MATPEL', label: 'Certificado MATPEL' },
];

export const VEHICLE_TYPES: Option<VehicleType>[] = [
  { value: 'TRACTO', label: 'Tracto' },
  { value: 'SEMIRREMOLQUE', label: 'Semirremolque' },
  { value: 'CISTERNA', label: 'Cisterna' },
  { value: 'CAMION', label: 'Camión' },
  { value: 'CAMIONETA', label: 'Camioneta' },
];

export const STATUSES: Option<DocumentStatus>[] = [
  { value: 'VENCIDO', label: 'Vencido' },
  { value: 'POR_VENCER', label: 'Por vencer' },
  { value: 'EN_TRAMITE', label: 'En trámite' },
  { value: 'VIGENTE', label: 'Vigente' },
];

function toLabelMap<T extends string>(options: Option<T>[]): Record<T, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label])) as Record<T, string>;
}

export const COMPANY_LABEL = toLabelMap(COMPANIES);
export const DOCUMENT_TYPE_LABEL = toLabelMap(DOCUMENT_TYPES);
export const VEHICLE_TYPE_LABEL = toLabelMap(VEHICLE_TYPES);
export const STATUS_LABEL = toLabelMap(STATUSES);
