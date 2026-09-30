/** Empresas cuyas unidades gestionamos (clientes / transportistas). */
export type Company = 'HAGEMSA' | 'SERVOSA' | 'PACSI';

export type DocumentType =
  | 'SOAT'
  | 'REVISION_TECNICA'
  | 'POLIZA_SEGURO'
  | 'CERTIFICADO_MTC'
  | 'TARJETA_PROPIEDAD'
  | 'CERTIFICADO_MATPEL';

export type VehicleType = 'TRACTO' | 'SEMIRREMOLQUE' | 'CISTERNA' | 'CAMION' | 'CAMIONETA';

/** Estado calculado del documento (no se persiste: se deriva de las fechas). */
export type DocumentStatus = 'VIGENTE' | 'POR_VENCER' | 'VENCIDO' | 'EN_TRAMITE';

/** Registro tal como llega del backend. Fechas en formato ISO `YYYY-MM-DD`. */
export interface FleetDocument {
  id: string;
  code: string;
  plate: string;
  vehicleType: VehicleType;
  company: Company;
  type: DocumentType;
  number: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  /** true cuando la renovación ya fue solicitada y está en curso. */
  inRenewal: boolean;
  responsible: string;
  updatedAt: string;
}
