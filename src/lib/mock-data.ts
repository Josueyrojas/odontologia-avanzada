// Datos de ejemplo. Se generan relativos a la fecha actual la primera vez que se abre la app
// y después viven en el navegador (localStorage). Reemplázalos por Supabase cuando conectes la base.
import type { Appointment, AppointmentStatus, Budget, DB, Expense, Material, Patient, Payment, PaymentMethod, Procedure, ProcedureMaterial } from "./types";
import { addDays, startOfWeek, toISODate } from "./format";

export const upperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const lowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export const DB_VERSION = 4;

// Consumo de material por tratamiento (en la unidad del material: cajas, jeringas, kits…)
const use = (...pairs: [string, number][]): ProcedureMaterial[] => pairs.map(([materialId, qty]) => ({ materialId, qty }));
export const seedProcedures: Procedure[] = [
  { id: "valoracion", name: "Valoración y diagnóstico", price: 400, materialCost: 40, durationMin: 30, color: "#3A7BD5", materials: use(["m3", 0.02], ["m6", 0.02]) },
  { id: "limpieza", name: "Limpieza profunda", price: 900, materialCost: 150, durationMin: 45, color: "#9ADBC0", materials: use(["m3", 0.02], ["m6", 0.02]) },
  { id: "resina", name: "Resina compuesta", price: 850, materialCost: 220, durationMin: 45, color: "#12A36A", materials: use(["m1", 0.2], ["m2", 0.1], ["m3", 0.02]) },
  { id: "endo", name: "Endodoncia", price: 3500, materialCost: 950, durationMin: 90, color: "#E8893A", materials: use(["m4", 0.5], ["m2", 0.2], ["m5", 0.1], ["m3", 0.04]) },
  { id: "corona", name: "Corona de porcelana", price: 4800, materialCost: 1900, durationMin: 60, color: "#0F2A44", materials: use(["m5", 0.3], ["m2", 0.1], ["m3", 0.04]) },
  { id: "extraccion", name: "Extracción", price: 1200, materialCost: 180, durationMin: 45, color: "#D9483B", materials: use(["m2", 0.2], ["m3", 0.02]) },
  { id: "blanqueamiento", name: "Blanqueamiento", price: 3200, materialCost: 800, durationMin: 60, color: "#F2B33D", materials: use(["m7", 1], ["m3", 0.02]) },
  { id: "ortodoncia", name: "Ajuste de ortodoncia", price: 1100, materialCost: 120, durationMin: 30, color: "#7B61FF", materials: use(["m3", 0.02]) },
  { id: "implante", name: "Implante dental", price: 14500, materialCost: 6200, durationMin: 120, color: "#163A5C", materials: use(["m2", 0.3], ["m3", 0.06], ["m6", 0.04]) },
];
const procedures = seedProcedures;

const people: [string, string, string, Patient["gender"]][] = [
  ["Ana García López", "1998-03-14", "55 1234 5678", "F"],
  ["Juan Pérez Morales", "1985-07-02", "55 2345 6789", "M"],
  ["Luis Hernández Ruiz", "1979-11-21", "55 3456 7890", "M"],
  ["Sofía Ramírez Díaz", "2004-01-30", "55 4567 8901", "F"],
  ["Carlos Mendoza Vela", "1991-05-09", "55 5678 9012", "M"],
  ["María Torres Aguilar", "1968-09-17", "55 6789 0123", "F"],
  ["Patricia Vega Soto", "1975-12-03", "55 7890 1234", "F"],
  ["Andrés Cruz Navarro", "2000-06-25", "55 8901 2345", "M"],
  ["Valeria Ortiz Campos", "1996-02-11", "55 9012 3456", "F"],
  ["Roberto Silva Romero", "1982-08-08", "55 0123 4567", "M"],
  ["Fernanda Lara Ibarra", "2009-04-19", "55 1122 3344", "F"],
  ["Jorge Castillo Peña", "1958-10-27", "55 2233 4455", "M"],
];

const materials: Material[] = [
  { id: "m1", name: "Resina 3M Filtek Z350", category: "Resinas", stock: 14, unit: "jeringas", alertLevel: 5, lastCost: 620 },
  { id: "m2", name: "Anestesia (lidocaína)", category: "Anestésicos", stock: 3, unit: "cajas", alertLevel: 6, lastCost: 480 },
  { id: "m3", name: "Guantes de nitrilo", category: "Insumos", stock: 22, unit: "cajas", alertLevel: 8, lastCost: 165 },
  { id: "m4", name: "Limas endodónticas", category: "Instrumental", stock: 9, unit: "paquetes", alertLevel: 6, lastCost: 390 },
  { id: "m5", name: "Ionómero de vidrio", category: "Cementos", stock: 1, unit: "kits", alertLevel: 2, lastCost: 740 },
  { id: "m6", name: "Cubrebocas tricapa", category: "Insumos", stock: 18, unit: "cajas", alertLevel: 6, lastCost: 95 },
  { id: "m7", name: "Gel blanqueador 35%", category: "Estética", stock: 4, unit: "kits", alertLevel: 3, lastCost: 1150 },
  { id: "m8", name: "Brackets metálicos", category: "Ortodoncia", stock: 12, unit: "kits", alertLevel: 4, lastCost: 560 },
];

/** Generador pseudoaleatorio con semilla para que los datos sean estables. */
const rng = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

export function createSeed(): DB {
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const now = toISODate(new Date());
  const monday = startOfWeek(now);

  const patients: Patient[] = people.map(([name, birthDate, phone, gender], i) => ({
    id: `p${i + 1}`, name, birthDate, phone, gender,
    email: `${name.split(" ")[0].toLowerCase()}@correo.com`,
    allergies: i === 2 ? "Penicilina" : i === 5 ? "Látex" : "",
    conditions: i === 5 ? "Hipertensión controlada" : i === 11 ? "Diabetes tipo 2" : "",
    notes: "",
    createdAt: addDays(now, -200 + i * 12),
    teeth: {},
    clinicalNotes: [],
  }));
  Object.assign(patients[0].teeth, { 16: "pendiente", 36: "problema", 24: "pendiente", 45: "pendiente", 11: "tratado", 26: "tratado", 47: "tratado", 18: "ausente" });
  Object.assign(patients[2].teeth, { 46: "problema", 37: "tratado", 14: "pendiente" });
  Object.assign(patients[6].teeth, { 36: "ausente", 25: "tratado", 15: "pendiente" });
  patients[0].clinicalNotes.push(
    { id: "n1", date: addDays(now, -30), text: "Paciente refiere sensibilidad al frío en zona molar inferior izquierda.", tooth: 36 },
    { id: "n2", date: addDays(now, -14), text: "Se realiza limpieza profunda. Se recomienda endodoncia en 36 y corona en 16." },
  );
  patients[0].history = {
    reason: "Sensibilidad dental y revisión general", bloodType: "O+", medications: "Ninguno", surgeries: "",
    flags: {}, bloodPressure: "110/70", lastDentalVisit: "Hace 2 años", hygiene: "regular", updatedAt: addDays(now, -30),
  };
  patients[5].history = {
    reason: "Dolor al masticar", bloodType: "A+", medications: "Losartán 50 mg c/24 h", surgeries: "Colecistectomía (2015)",
    flags: { hipertension: true }, bloodPressure: "135/85", hygiene: "buena", updatedAt: addDays(now, -60),
  };
  patients[11].history = {
    reason: "Prótesis desajustada", medications: "Metformina 850 mg c/12 h, ácido acetilsalicílico 100 mg",
    flags: { diabetes: true, anticoagulantes: true, tabaquismo: true }, bloodPressure: "130/80", hygiene: "mala", updatedAt: addDays(now, -90),
  };
  patients[0].surfaces = { 16: { O: "caries", M: "caries" }, 24: { D: "caries" }, 46: { O: "obturado" }, 26: { O: "obturado", V: "obturado" }, 37: { O: "sellante" } };
  patients[2].surfaces = { 46: { O: "caries", D: "caries", L: "caries" }, 14: { M: "caries" } };
  patients[2].clinicalNotes.push({ id: "n3", date: addDays(now, -7), text: "Dolor agudo en 46, se indica analgésico y se programa endodoncia.", tooth: 46 });

  // Citas de la semana actual + la siguiente
  const week: [number, string, number, string, AppointmentStatus][] = [
    [0, "09:00", 0, "corona", "confirmada"], [0, "10:00", 1, "limpieza", "completada"], [0, "11:00", 2, "endo", "urgencia"], [0, "13:00", 3, "ortodoncia", "confirmada"],
    [1, "09:30", 4, "resina", "confirmada"], [1, "11:30", 5, "valoracion", "pendiente"], [1, "13:00", 8, "blanqueamiento", "confirmada"],
    [2, "09:00", 6, "implante", "confirmada"], [2, "12:00", 7, "limpieza", "confirmada"],
    [3, "10:00", 8, "blanqueamiento", "pendiente"], [3, "12:30", 9, "endo", "pendiente"],
    [4, "09:00", 10, "ortodoncia", "confirmada"], [4, "11:00", 11, "corona", "confirmada"],
    [7, "10:00", 0, "endo", "pendiente"], [8, "09:00", 2, "endo", "pendiente"], [9, "12:00", 6, "valoracion", "pendiente"],
  ];
  const todayIdx = Math.min(4, Math.max(0, Math.floor((new Date().getTime() - new Date(monday + "T00:00").getTime()) / 864e5)));
  const appointments: Appointment[] = week.map(([d, start, p, proc, status], i) => {
    const pr = procedures.find((x) => x.id === proc)!;
    // asegura que el día de hoy tenga citas: rota la semana para que el bloque del lunes caiga hoy
    const day = d < 5 ? (d + todayIdx) % 5 : d;
    const date = addDays(monday, day);
    const past = date < now;
    return {
      id: `a${i + 1}`, patientId: `p${p + 1}`, procedureId: pr.id, treatment: pr.name, date, start, durationMin: pr.durationMin,
      status: past ? "completada" : status === "completada" && date > now ? "confirmada" : status,
    };
  });

  // Pagos de los últimos 6 meses con tendencia creciente
  const payments: Payment[] = [];
  const methods: PaymentMethod[] = ["efectivo", "tarjeta", "transferencia"];
  const base = new Date(); base.setDate(1);
  for (let m = 5; m >= 0; m--) {
    const first = new Date(base.getFullYear(), base.getMonth() - m, 1);
    const daysInMonth = m === 0 ? new Date().getDate() : new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const target = (140000 + (5 - m) * 9000) * (m === 0 ? daysInMonth / 30 : 1);
    let sum = 0;
    while (sum < target) {
      const pr = pick(procedures.filter((p) => p.id !== "implante" || r() > 0.7));
      const d = new Date(first); d.setDate(1 + Math.floor(r() * daysInMonth));
      payments.push({ id: `pay${payments.length}`, patientId: `p${1 + Math.floor(r() * patients.length)}`, amount: pr.price, method: pick(methods), date: toISODate(d), concept: pr.name });
      sum += pr.price;
    }
  }

  const expenses: Expense[] = [];
  for (let m = 5; m >= 0; m--) {
    const first = new Date(base.getFullYear(), base.getMonth() - m, 1);
    const day = (n: number) => toISODate(new Date(first.getFullYear(), first.getMonth(), n));
    const items: Expense[] = [
      { id: `e${m}a`, date: day(1), supplier: "Inmobiliaria Centro", category: "Renta y servicios", amount: 22000, invoice: `R-${100 + m}` },
      { id: `e${m}b`, date: day(15), supplier: "Nómina quincenal", category: "Nómina", amount: 28000 + (5 - m) * 500 },
      { id: `e${m}c`, date: day(8), supplier: "Depósito Dental del Bajío", category: "Materiales dentales", amount: 9000 + Math.round(r() * 6000), invoice: `F-${4500 + m * 7}` },
      { id: `e${m}d`, date: day(20), supplier: "Farmacia San Jorge", category: "Medicamentos", amount: 1800 + Math.round(r() * 1500) },
    ];
    // en el mes en curso solo se registran los egresos que ya ocurrieron
    expenses.push(...items.filter((e) => m > 0 || e.date <= now));
  }
  expenses.sort((a, b) => b.date.localeCompare(a.date));

  const budgets: Budget[] = [
    {
      id: "b1", folio: 1001, patientId: "p1", discount: 5, status: "enviado", createdAt: addDays(now, -10),
      items: [
        { id: "i1", procedureId: "corona", name: "Corona de porcelana", tooth: 16, qty: 1, price: 4800, cost: 1900 },
        { id: "i2", procedureId: "endo", name: "Endodoncia", tooth: 36, qty: 1, price: 3500, cost: 950 },
        { id: "i3", procedureId: "resina", name: "Resina compuesta", tooth: 24, qty: 2, price: 850, cost: 220 },
        { id: "i4", procedureId: "limpieza", name: "Limpieza profunda", qty: 1, price: 900, cost: 150 },
      ],
    },
    {
      id: "b2", folio: 1002, patientId: "p7", discount: 0, status: "aceptado", createdAt: addDays(now, -25),
      items: [{ id: "i5", procedureId: "implante", name: "Implante dental", tooth: 36, qty: 1, price: 14500, cost: 6200 }],
    },
    {
      id: "b3", folio: 1003, patientId: "p3", discount: 0, status: "borrador", createdAt: addDays(now, -2),
      items: [{ id: "i6", procedureId: "endo", name: "Endodoncia", tooth: 46, qty: 1, price: 3500, cost: 950 }],
    },
  ];
  // Historial: cada pago anterior a esta semana corresponde a una cita completada (reportes coherentes)
  const slots = ["09:00", "09:30", "10:00", "11:00", "11:30", "12:00", "13:00", "16:00", "17:00"];
  payments.filter((p) => p.date < monday).forEach((p, i) => {
    const pr = procedures.find((x) => x.name === p.concept)!;
    appointments.push({ id: `h${i}`, patientId: p.patientId, procedureId: pr.id, treatment: pr.name, date: p.date, start: pick(slots), durationMin: pr.durationMin, status: r() < 0.06 ? "cancelada" : "completada" });
  });
  payments.push({ id: "payb2", patientId: "p7", budgetId: "b2", amount: 7000, method: "transferencia", date: addDays(now, -20), concept: "Anticipo implante" });

  return {
    version: DB_VERSION,
    settings: {
      clinicName: "Odontología Avanzada", doctorName: "Dr. Josué Rojas", specialty: "Cirujano Dentista", license: "Céd. Prof. 0000000",
      phone: "55 0000 0000", address: "Av. Principal 123, Col. Centro", email: "contacto@odontologia.mx",
      startHour: 8, endHour: 19, workDays: 6,
    },
    patients, procedures, appointments, budgets, payments, materials, expenses,
    consents: [],
    prescriptions: [{
      id: "rx1", folio: 1, patientId: "p3", date: addDays(now, -7),
      items: [
        { drug: "Ibuprofeno 400 mg tabletas", dose: "1 tableta", frequency: "cada 8 horas", duration: "3 días" },
        { drug: "Amoxicilina 500 mg cápsulas", dose: "1 cápsula", frequency: "cada 8 horas", duration: "7 días" },
      ],
      indications: "Tomar con alimentos. Evitar alimentos muy fríos o calientes. Acudir a urgencias si hay inflamación facial.",
    }],
  };
}
