// Datos del titular de Odonty para el aviso de privacidad y los términos.
// Se configuran en .env.local / Vercel; mientras no existan se muestran entre corchetes para que se note qué falta.
export const LEGAL = {
  marca: "Odonty",
  responsable: process.env.NEXT_PUBLIC_LEGAL_RESPONSABLE || "[Nombre o razón social del titular de Odonty]",
  domicilio: process.env.NEXT_PUBLIC_LEGAL_DOMICILIO || "[Domicilio]",
  ciudad: process.env.NEXT_PUBLIC_LEGAL_CIUDAD || "[Ciudad, Estado]",
  correo: process.env.NEXT_PUBLIC_LEGAL_CORREO || process.env.NEXT_PUBLIC_SOPORTE_EMAIL || "[correo de contacto]",
  /** Fecha de la versión vigente: se guarda con la aceptación de cada usuario. */
  version: "2026-11-23",
  actualizado: "23 de noviembre de 2026",
  /** Días que se conservan los datos de una clínica después de terminar el servicio. */
  diasConservacion: 90,
};
