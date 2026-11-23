import LegalPage from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Aviso de privacidad · Odonty" };

export default function PrivacidadPage() {
  const L = LEGAL;
  return (
    <LegalPage title="Aviso de privacidad">
      <p>
        <b>{L.responsable}</b>, con domicilio en {L.domicilio}, quien opera la plataforma <b>{L.marca}</b>, es responsable del tratamiento
        de los datos personales de las personas que usan la plataforma (doctores, personal de recepción y administradores de clínicas),
        conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y demás normativa aplicable.
      </p>

      <h2>1. Datos que recabamos de los usuarios</h2>
      <ul>
        <li>Identificación y contacto: nombre, correo electrónico y, en su caso, teléfono.</li>
        <li>Datos de la clínica: nombre comercial, domicilio, teléfono, cédula profesional que el usuario decida registrar.</li>
        <li>Datos de la cuenta: rol dentro de la clínica (doctor o recepción) y fecha de aceptación de este aviso.</li>
        <li>Datos de contratación y pago del servicio.</li>
        <li>Datos técnicos de uso: fecha y hora de acceso y de los cambios realizados, para seguridad y para la bitácora del expediente.</li>
      </ul>

      <h2>2. Datos de los pacientes de cada clínica</h2>
      <p>
        La información de los pacientes que cada clínica captura en {L.marca} (identificación, contacto, historia clínica, odontograma,
        notas, recetas, consentimientos, citas y pagos) incluye <b>datos personales sensibles de salud</b>. Respecto de esos datos,
        <b> la clínica es la responsable</b> y {L.marca} actúa únicamente como <b>encargado</b>: los trata por cuenta de la clínica y solo
        para prestarle el servicio, sin usarlos para fines propios, sin venderlos y sin compartirlos con terceros, salvo con los proveedores
        de infraestructura indicados en la sección 4.
      </p>
      <p>
        Cada clínica debe poner a disposición de sus pacientes su propio aviso de privacidad y obtener el consentimiento expreso
        que la ley exige para tratar datos de salud.
      </p>

      <h2>3. Finalidades</h2>
      <p>Usamos los datos de los usuarios para estas finalidades, necesarias para el servicio:</p>
      <ul>
        <li>Crear y administrar la cuenta y el acceso a la clínica.</li>
        <li>Prestar el servicio, guardar la información y mantenerla sincronizada entre los usuarios de la clínica.</li>
        <li>Dar soporte, capacitación y avisos sobre el servicio, la licencia y los pagos.</li>
        <li>Mantener la seguridad de la plataforma y la bitácora de cambios del expediente clínico.</li>
        <li>Cumplir obligaciones legales, fiscales y contractuales.</li>
      </ul>
      <p>
        De forma adicional, y solo si no te opones, podemos enviarte información sobre novedades de {L.marca}. Puedes pedir que dejemos
        de hacerlo escribiendo a {L.correo}; esto no afecta el servicio.
      </p>

      <h2>4. Proveedores y transferencias</h2>
      <p>
        Para operar usamos proveedores de alojamiento en la nube, base de datos y envío de correos, que tratan la información por nuestra
        cuenta y bajo obligaciones de confidencialidad y seguridad. Sus servidores pueden ubicarse fuera de México. No vendemos ni rentamos
        datos personales. Solo los compartiremos con autoridades cuando una ley o una orden competente lo exija.
      </p>

      <h2>5. Seguridad</h2>
      <p>
        La información viaja cifrada, cada clínica solo puede acceder a sus propios datos mediante reglas aplicadas en la base de datos,
        el acceso requiere usuario y contraseña, y los cambios al expediente quedan registrados en una bitácora.
      </p>

      <h2>6. Conservación</h2>
      <p>
        Conservamos los datos mientras la cuenta de la clínica esté vigente. Al terminar el servicio, la clínica puede descargar un respaldo
        completo; conservaremos la información {L.diasConservacion} días para permitir su reactivación o entrega y después la eliminaremos,
        salvo que una ley obligue a conservarla. La conservación del expediente clínico por el plazo que marca la normativa sanitaria
        es responsabilidad de la clínica.
      </p>

      <h2>7. Derechos ARCO y revocación del consentimiento</h2>
      <p>
        Puedes solicitar el acceso, rectificación, cancelación u oposición al tratamiento de tus datos, así como revocar tu consentimiento,
        escribiendo a <b>{L.correo}</b>. Indica tu nombre, el correo de tu cuenta, la solicitud concreta y, en su caso, los documentos que
        la respalden. Responderemos en los plazos que establece la ley. Los pacientes deben dirigir sus solicitudes a la clínica que los atiende,
        y {L.marca} apoyará a la clínica para atenderlas.
      </p>

      <h2>8. Cambios a este aviso</h2>
      <p>
        Publicaremos cualquier cambio en esta página, indicando la fecha de actualización. Si el cambio es relevante, te lo avisaremos
        dentro de la plataforma o por correo.
      </p>
    </LegalPage>
  );
}
