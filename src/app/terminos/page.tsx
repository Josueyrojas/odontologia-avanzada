import LegalPage from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Términos de uso · Odonty" };

export default function TerminosPage() {
  const L = LEGAL;
  return (
    <LegalPage title="Términos de uso">
      <p>
        Estos términos regulan el uso de <b>{L.marca}</b>, plataforma en la nube para la gestión de consultorios dentales, operada por
        <b> {L.responsable}</b> (&quot;{L.marca}&quot;). Al crear una cuenta o usar la plataforma, la clínica y sus usuarios los aceptan.
        Si existe un contrato firmado con la clínica, ese contrato prevalece sobre estos términos en lo que se contradigan.
      </p>

      <h2>1. Servicio y licencia</h2>
      <p>
        {L.marca} otorga a la clínica una licencia de uso no exclusiva e intransferible de la plataforma mientras su licencia esté vigente.
        La licencia no incluye el código fuente ni el derecho a copiar, revender o modificar el software.
      </p>

      <h2>2. Cuentas y usuarios</h2>
      <ul>
        <li>Cada persona usa su propia cuenta; no deben compartirse contraseñas.</li>
        <li>El doctor que crea la clínica administra a su equipo: invita usuarios, asigna roles y puede quitar accesos.</li>
        <li>La clínica es responsable de lo que hagan sus usuarios dentro de la plataforma.</li>
      </ul>

      <h2>3. Pagos, vigencia y suspensión</h2>
      <ul>
        <li>El precio, la forma de pago y la vigencia son los del plan contratado.</li>
        <li>Al vencer la licencia hay 5 días naturales de gracia. Después, el acceso se suspende hasta regularizar el pago.</li>
        <li>Durante la suspensión <b>la información no se borra</b>: se conserva y vuelve a estar disponible al reactivar la licencia.</li>
      </ul>

      <h2>4. Datos de los pacientes</h2>
      <p>
        La información de los pacientes pertenece a la clínica, que es la <b>responsable</b> de su tratamiento. {L.marca} actúa como
        <b> encargado</b> y se obliga a:
      </p>
      <ul>
        <li>Tratar esos datos solo para prestar el servicio y conforme a las instrucciones de la clínica.</li>
        <li>No usarlos para fines propios, no venderlos y no compartirlos, salvo con los proveedores de infraestructura necesarios para operar.</li>
        <li>Mantener medidas de seguridad y la confidencialidad de su personal.</li>
        <li>Avisar a la clínica sin demora si ocurre una vulneración de seguridad que afecte sus datos.</li>
        <li>Al terminar el servicio, permitir la descarga de la información y eliminarla después de {L.diasConservacion} días.</li>
      </ul>
      <p>
        La clínica se obliga a contar con su propio aviso de privacidad para pacientes y a obtener su consentimiento expreso para tratar
        datos de salud.
      </p>

      <h2>5. Expediente clínico</h2>
      <p>
        {L.marca} es una herramienta de apoyo. La integración, veracidad y conservación del expediente clínico conforme a la normativa
        sanitaria aplicable corresponden al profesional y a la clínica. La plataforma registra en una bitácora los cambios al expediente
        y permite descargar respaldos completos en cualquier momento.
      </p>

      <h2>6. Disponibilidad y respaldos</h2>
      <p>
        Hacemos lo razonable para que la plataforma esté disponible y respaldada, pero puede haber interrupciones por mantenimiento,
        fallas de proveedores o de internet. Recomendamos descargar respaldos periódicos desde Configuración.
      </p>

      <h2>7. Uso aceptable</h2>
      <p>
        No está permitido usar la plataforma para fines ilícitos, intentar acceder a información de otras clínicas, afectar su
        funcionamiento o copiar el software.
      </p>

      <h2>8. Responsabilidad</h2>
      <p>
        {L.marca} no responde por decisiones clínicas, administrativas o fiscales tomadas con base en la información capturada, ni por
        daños indirectos. En cualquier caso, la responsabilidad total de {L.marca} se limita al monto pagado por la clínica en los 12 meses
        anteriores al hecho que la origine.
      </p>

      <h2>9. Terminación</h2>
      <p>
        La clínica puede dejar de usar el servicio en cualquier momento conforme a su plan. {L.marca} puede terminarlo por falta de pago
        o incumplimiento de estos términos. En ambos casos aplica lo indicado en la sección 4 sobre la entrega y eliminación de datos.
      </p>

      <h2>10. Cambios, ley aplicable y contacto</h2>
      <p>
        Podemos actualizar estos términos; los cambios relevantes se avisarán con anticipación dentro de la plataforma o por correo.
        Estos términos se rigen por las leyes de los Estados Unidos Mexicanos y, para cualquier controversia, las partes se someten a los
        tribunales de {L.ciudad}. Contacto: <b>{L.correo}</b>.
      </p>
    </LegalPage>
  );
}
