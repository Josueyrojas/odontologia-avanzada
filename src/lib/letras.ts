// Montos en letra para recibos: 3500 → "TRES MIL QUINIENTOS PESOS 00/100 M.N."
const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte",
  "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

/** 0–999 en palabras ("uno" al final; se apocopa después según el contexto). */
function hasta999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const c = Math.floor(n / 100), r = n % 100;
  const resto = r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : "");
  return [CENTENAS[c], resto].filter(Boolean).join(" ");
}
/** "uno" → "un" / "veintiuno" → "veintiún" antes de "mil", "millones" o "pesos". */
const apocope = (s: string) => s.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");

export function numeroEnLetras(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000), miles = Math.floor((n % 1_000_000) / 1000), resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "un millón" : `${apocope(numeroEnLetras(millones))} millones`);
  if (miles) partes.push(miles === 1 ? "mil" : `${apocope(hasta999(miles))} mil`);
  if (resto) partes.push(hasta999(resto));
  return partes.join(" ");
}

export function montoEnLetra(monto: number): string {
  const entero = Math.floor(monto + 1e-9);
  const centavos = Math.round((monto - entero) * 100);
  const palabras = apocope(numeroEnLetras(entero));
  // "un millón de pesos" / "dos millones de pesos"
  const de = entero >= 1_000_000 && entero % 1_000_000 === 0 ? " de" : "";
  return `${palabras}${de} ${entero === 1 ? "peso" : "pesos"} ${String(centavos).padStart(2, "0")}/100 M.N.`.toUpperCase();
}
