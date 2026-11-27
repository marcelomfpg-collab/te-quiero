/** Funciones que solo existen en el programa de escritorio (ver electron/preload.cjs). */
interface MailConfig {
  /** microsoft = Microsoft 365 (inicio de sesión oficial); imap = usuario y contraseña. */
  provider: 'microsoft' | 'imap';
  msClientId: string;
  msTenantId: string;
  /** Buzón a leer (p. ej. reclutamiento@…); puede ser compartido. */
  msMailbox: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  /** Solo se envía al guardar; nunca vuelve al navegador. */
  password?: string;
  folder: string;
  subjectFilter: string;
  sinceDate: string;
  autoCheckMinutes: number;
}

interface MailSummary {
  /** Número (IMAP) o identificador de Microsoft. */
  uid: number | string;
  messageId: string;
  subject: string;
  date: string;
  fromName: string;
  fromAddress: string;
  hasAttachments: boolean;
}

interface MailAttachment {
  filename: string;
  contentType: string;
  content: Uint8Array;
}

interface MailMessage extends MailSummary {
  text: string;
  attachments: MailAttachment[];
}

interface PacsiDesktop {
  ocrPaths?: { workerPath: string; corePath: string; langPath: string };
  mail: {
    getConfig(): Promise<(Omit<MailConfig, 'password'> & { hasPassword: boolean; msAccount: string; ready: boolean }) | null>;
    saveConfig(config: MailConfig): Promise<void>;
    test(config: MailConfig): Promise<{ ok: boolean; message: string; total?: number }>;
    open(): Promise<void>;
    list(): Promise<MailSummary[]>;
    get(uid: number | string): Promise<MailMessage>;
    close(): Promise<void>;
    msLogin(config: MailConfig): Promise<{ ok: boolean; account?: string; message?: string }>;
    msLogout(): Promise<void>;
  };
}

interface Window {
  pacsiDesktop?: PacsiDesktop;
}
