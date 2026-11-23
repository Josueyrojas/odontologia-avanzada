export type ToothStatus = "sano" | "tratado" | "pendiente" | "problema" | "ausente";

/** Caras del diente: Oclusal/incisal, Mesial, Distal, Vestibular, Lingual/palatino. */
export type Surface = "O" | "M" | "D" | "V" | "L";
export type SurfaceFinding = "caries" | "obturado" | "sellante" | "fractura";
export type SurfaceMap = Record<number, Partial<Record<Surface, SurfaceFinding>>>;

export interface Consent {
  id: string; folio: number; patientId: string; date: string;
  template: string; title: string; body: string;
  signature: string;          // imagen PNG (data URL) de la firma del paciente
  signerName: string;         // quien firma (paciente o tutor)
  witness?: string;
}

export interface ClinicalNote {
  id: string; date: string; text: string; tooth?: number;
  author?: string;        // quién la escribió
  createdAt?: string;     // fecha y hora exactas (ISO)
}

/** Anamnesis / historia clínica (NOM-013). */
export interface MedicalHistory {
  reason?: string;            // motivo de consulta
  bloodType?: string;
  medications?: string;
  surgeries?: string;
  flags: Partial<Record<RiskFlag, boolean>>;
  bloodPressure?: string;
  lastDentalVisit?: string;
  hygiene?: "buena" | "regular" | "mala";
  updatedAt?: string;
}
export type RiskFlag =
  | "diabetes" | "hipertension" | "cardiopatia" | "coagulacion" | "embarazo" | "asma"
  | "epilepsia" | "vih_hepatitis" | "tabaquismo" | "bruxismo" | "anticoagulantes" | "bifosfonatos";

export interface PrescriptionItem { drug: string; dose: string; frequency: string; duration: string; }
export interface Prescription { id: string; folio: number; patientId: string; date: string; items: PrescriptionItem[]; indications?: string; }

export interface Patient {
  id: string;
  name: string;
  birthDate: string;    // "YYYY-MM-DD"
  phone: string;
  email?: string;
  gender?: "F" | "M" | "O";
  allergies?: string;
  conditions?: string;  // padecimientos / antecedentes
  notes?: string;
  createdAt: string;
  teeth: Record<number, ToothStatus>;
  clinicalNotes: ClinicalNote[];
  history?: MedicalHistory;
  surfaces?: SurfaceMap;
}

export interface ProcedureMaterial { materialId: string; qty: number; }
export interface Procedure {
  id: string; name: string; price: number; materialCost: number; durationMin: number; color?: string;
  materials?: ProcedureMaterial[];   // lo que consume cada vez que se realiza
}

export interface BudgetItem {
  id: string; procedureId: string; name: string; tooth?: number; qty: number; price: number; cost: number;
  doneDate?: string;                 // fecha en que se realizó
}
export type BudgetStatus = "borrador" | "enviado" | "aceptado" | "rechazado";
export interface Budget {
  id: string; folio: number; patientId: string; items: BudgetItem[];
  discount: number; status: BudgetStatus; createdAt: string; notes?: string;
}

export type AppointmentStatus = "pendiente" | "confirmada" | "en_sala" | "urgencia" | "completada" | "cancelada";
export interface Appointment {
  id: string; patientId: string; procedureId?: string; treatment: string;
  date: string;         // "YYYY-MM-DD"
  start: string;        // "09:00"
  durationMin: number;
  status: AppointmentStatus;
  notes?: string;
  arrivedAt?: string;
}

export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia";
export interface Payment { id: string; patientId: string; budgetId?: string; amount: number; method: PaymentMethod; date: string; concept: string; }

export interface Material {
  id: string; name: string; category: string; stock: number; unit: string; alertLevel: number; lastCost: number;
}
export interface Expense {
  id: string; date: string; supplier: string; category: string; amount: number; invoice?: string;
  materialId?: string; qty?: number; notes?: string;
}

export interface Settings {
  clinicName: string; doctorName: string; specialty: string; license: string;
  phone: string; address: string; email: string;
  startHour: number; endHour: number; workDays: number; // 5 = lun-vie, 6 = lun-sáb
}

export interface DB {
  version: number;
  settings: Settings;
  patients: Patient[];
  procedures: Procedure[];
  appointments: Appointment[];
  budgets: Budget[];
  payments: Payment[];
  materials: Material[];
  expenses: Expense[];
  prescriptions: Prescription[];
  consents: Consent[];
}
