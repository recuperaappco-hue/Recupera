import Link from "next/link";

export const metadata = { title: "Privacidad y términos · Recupera" };

// DRAFT: must be reviewed by a Colombian lawyer (Ley 1581 de 2012) before public launch.
export default function Privacy() {
  return (
    <div className="prose">
      <Link className="logo" href="/">Recupera</Link>
      <h1>Política de tratamiento de datos y términos</h1>
      <p><b>Borrador para el piloto privado.</b> Última actualización: septiembre de 2026.</p>

      <h2>Quién es el responsable</h2>
      <p>[Razón social], NIT [número], con domicilio en [ciudad], Colombia. Contacto para temas de datos: [correo de contacto].</p>

      <h2>Qué es Recupera</h2>
      <p>Recupera es una plataforma de tecnología que revisa, con tu autorización, correos relacionados con compras y pagos para encontrar dinero que podrías recuperar y ayudarte a preparar reclamos. Recupera no es una firma de abogados, no presta asesoría legal y no garantiza resultados. Los montos que mostramos son una posible recuperación, no una deuda confirmada.</p>

      <h2>Qué datos tratamos</h2>
      <ul>
        <li>Datos de tu cuenta de Google: nombre y correo electrónico.</li>
        <li>Con tu autorización expresa, acceso de solo lectura a tu Gmail. Buscamos únicamente correos de compras, facturas electrónicas, bancos, aerolíneas y suscripciones.</li>
        <li>De esos correos guardamos solo datos estructurados: comercio, montos, fechas, plazos, productos, el asunto, el remitente y un fragmento corto que sirve como prueba. No guardamos el cuerpo completo de los correos.</li>
        <li>Los reclamos que apruebas y el estado de tus casos.</li>
      </ul>

      <h2>Para qué los usamos</h2>
      <p>Solo para encontrar hallazgos (reembolsos pendientes, cobros duplicados, aumentos de tarifa, pruebas gratis, garantías), mostrártelos y ayudarte a reclamar. No vendemos tus datos, no los usamos para publicidad y no los usamos para entrenar modelos de inteligencia artificial.</p>

      <h2>Con quién los compartimos</h2>
      <p>Con proveedores que nos ayudan a operar el servicio, bajo acuerdos de confidencialidad: Supabase (base de datos), Vercel (servidores) y Anthropic (modelo de inteligencia artificial que lee los correos seleccionados para extraer los datos). Los datos pueden procesarse fuera de Colombia.</p>

      <h2>Uso de datos de Google</h2>
      <p>El uso y la transferencia que hace Recupera de la información recibida de las API de Google se ajusta a la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Política de datos de usuario de los servicios de API de Google</a>, incluidos los requisitos de Uso Limitado.</p>

      <h2>Seguridad</h2>
      <p>La conexión con Google es de solo lectura. El permiso se guarda cifrado. Las comunicaciones van cifradas. Solo personal autorizado accede a los datos, y cada acceso queda registrado.</p>

      <h2>Tus derechos</h2>
      <p>Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar esta autorización en cualquier momento. Desde tu perfil puedes desconectar tu correo (borramos lo que leímos) o borrar tu cuenta completa. También puedes quitar el permiso desde tu cuenta de Google. Para otras solicitudes, escríbenos a [correo de contacto].</p>

      <h2>Tarifas</h2>
      <p>Durante el piloto, Recupera no cobra. Cualquier tarifa futura se mostrará antes de que apruebes un reclamo.</p>
    </div>
  );
}
