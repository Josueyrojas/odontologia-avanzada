# Odontología Avanzada — Sistema de gestión

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase · Recharts

## Arrancar
```bash
npm install
npm run dev
```
Abre http://localhost:3000

## Módulos
| Ruta | Módulo |
|---|---|
| `/` | Inicio: agenda del día, cobros, utilidad, alertas de inventario, presupuestos por cerrar |
| `/agenda` | Calendario día/semana, alta y edición de citas (clic en un hueco), detección de empalmes, alertas médicas, recordatorio por WhatsApp, **cerrar consulta** (cobro + avance del plan + descuento de inventario + nota clínica en un paso) |
| `/pacientes` | Directorio con búsqueda, orden, vista lista/tarjetas y exportación CSV |
| `/pacientes/[id]` | Expediente: odontograma por diente y **por superficies**, historia clínica, citas, presupuestos, pagos, notas, recetas y **consentimientos firmados en pantalla** |
| `/presupuestos` | Listado con estados (borrador, enviado, aceptado, rechazado) y tasa de aceptación |
| `/presupuestos/[id]` | Editor con odontograma, utilidad estimada, avance del tratamiento, abonos, PDF/impresión y WhatsApp |
| `/finanzas` | Reporte mensual, corte de caja diario con arqueo de efectivo, CSV |
| `/reportes` | Productividad: rentabilidad y utilidad por hora de cada tratamiento, horas pico, ocupación, faltas, captación de pacientes, embudo de presupuestos |
| `/inventario` | Materiales con alertas, compras (suman stock y generan egreso), registro de uso |
| `/configuracion` | Clínica y horario, catálogo de tratamientos con materiales, equipo (modo nube), respaldo/restauración |

Modo claro/oscuro con el botón ☀/🌙 de la barra superior (por defecto sigue al sistema; siempre imprime en claro).

## Dos modos de funcionamiento

### Modo local (sin configurar nada)
Los datos se guardan en el navegador (`localStorage`). La primera vez se cargan datos de ejemplo
generados relativos a la fecha actual. Desde **Configuración › Datos** puedes descargar respaldos,
restaurarlos, recargar los ejemplos o empezar desde cero.

### Modo nube (Supabase)
Inicio de sesión, datos en Supabase y sincronización **en tiempo real** entre doctor y recepción.

1. Crea un proyecto en https://supabase.com (plan gratuito).
2. **SQL Editor › New query**: pega el contenido de `supabase/schema.sql` y presiona **Run**.
3. **Project Settings › API**: copia la *Project URL* y la *anon public key*.
4. Copia `.env.example` a `.env.local` y pega esos dos valores.
5. Reinicia `npm run dev`.
6. Crea tu cuenta en la app → **Soy el doctor › Crear mi clínica** → elige
   **Subir los datos de este navegador** para llevarte lo que ya capturaste.
7. Para recepción: en **Configuración › Equipo** está el código de 6 letras. Tu recepcionista
   crea su cuenta y elige **Unirme con código**.

Notas:
- Por defecto Supabase pide confirmar el correo al registrarse. Para el enlace de confirmación y el de
  "olvidé mi contraseña", en **Authentication › URL Configuration** pon como *Site URL* la dirección
  donde corre la app (por ejemplo `http://localhost:3000` o tu dominio).
- Permisos de **recepción**: agenda, pacientes, cobros, compras, recetas y consentimientos. No ve Finanzas,
  Reportes ni Configuración, y no puede borrar registros (excepto citas). Postgres lo hace cumplir con RLS.
- Cada elemento (paciente, cita, pago…) es una fila JSON en la tabla `registros`; la app envía solo lo que
  cambió y agrupa los cambios rápidos (`src/lib/cloud.ts`).

## Estructura
```
src/
  app/            páginas por módulo
  components/     Shell, Sidebar, Topbar, odontogramas, formularios, clínica (historia, recetas),
                  consentimiento con firma, pantallas de acceso, UI base
  lib/            tipos, almacén (store.tsx), sincronización (cloud.ts), datos de ejemplo, formato
supabase/         esquema SQL (tablas, RLS, funciones, tiempo real)
```

Al cambiar la estructura de datos se sube `DB_VERSION` y se agrega un paso en `migrate()` (store.tsx)
para que los datos existentes se actualicen sin perderse.

## Siguientes pasos sugeridos
- Recordatorios automáticos de citas 24 h antes (WhatsApp Business API + función programada de Supabase)
- Radiografías y archivos por paciente (Supabase Storage)
- Portal para que el paciente confirme su cita desde un enlace
