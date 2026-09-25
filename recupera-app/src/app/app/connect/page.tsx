import Link from "next/link";
import { ctx } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";

const ERR: Record<string, string> = {
  denied: "No diste el permiso en Google. Sin él no podemos revisar tu correo.",
  scope: "En Google quedó sin marcar el permiso para leer correos. Vuelve a intentarlo y deja la casilla marcada.",
  state: "La conexión expiró. Intenta de nuevo.",
  refresh: "Google no nos dio acceso continuo. Intenta de nuevo.",
  exchange: "Algo falló al conectar con Google. Intenta de nuevo.",
  code: "Algo falló al conectar con Google. Intenta de nuevo.",
};

export default async function Connect({ searchParams }: { searchParams: Promise<{ error?: string; consent?: string }> }) {
  const sp = await searchParams;
  const { conn } = await ctx();
  return (
    <main>
      <TopBar title="Conecta tu correo" back={conn ? "/app/profile" : undefined} />
      <div className="s-pad">
        {conn?.status === "active" ? <div className="done-tag"><Icon id="i-check" size={18} />Ya tienes conectado {conn.google_email}</div> : null}
        {conn?.status === "expired" ? <div className="banner">Google cerró el acceso a {conn.google_email}. Vuelve a conectarlo para seguir buscando.</div> : null}
        <h2 className="s-title">Revisamos tus correos de compras</h2>
        <p className="s-sub">Buscamos reembolsos pendientes, cobros duplicados, aumentos de tarifa, pruebas gratis y garantías.</p>
        <div className="result" style={{ gap: 10 }}>
          <b>Qué vamos a leer</b>
          <div className="scope">
            <div className="y"><Icon id="i-check" />Correos de compras, facturas electrónicas, bancos, aerolíneas y suscripciones</div>
            <div className="y"><Icon id="i-check" />Solo guardamos comercio, monto, fechas y plazos. No guardamos el correo completo</div>
            <div className="n"><Icon id="i-x" />No leemos conversaciones personales ni de trabajo</div>
            <div className="n"><Icon id="i-x" />No podemos enviar ni borrar correos: el permiso es de solo lectura</div>
          </div>
        </div>
        {sp.error ? <p className="err">{ERR[sp.error] ?? ERR.exchange}</p> : null}
        {sp.consent ? <p className="err">Marca la casilla de autorización para continuar.</p> : null}
        <form action="/api/gmail/connect" method="post" style={{ display: "grid", gap: 14 }}>
          <label className="chk"><input type="checkbox" name="consent" value="yes" required />
            <span>Autorizo a Recupera a revisar mis correos de compras para buscar dinero por recuperar, según la <Link href="/privacidad">política de tratamiento de datos</Link>.</span></label>
          <p className="hint">Te llevamos a Google para dar el permiso. Nunca vemos tu contraseña. Durante el piloto, Google muestra un aviso de &quot;app no verificada&quot;: toca <b>Continuar</b>.</p>
          <button className="btn btn-green btn-block" type="submit">Conectar Gmail</button>
        </form>
        {!conn ? <Link className="btn btn-ghost btn-block" href="/app">Ahora no</Link> : null}
      </div>
    </main>
  );
}
