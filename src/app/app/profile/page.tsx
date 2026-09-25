import Link from "next/link";
import { ctx } from "@/lib/data";
import { fmtDate } from "@/lib/dates";
import { TabBar } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { deleteAccount, disconnectGmail } from "../actions";

export default async function Profile({ searchParams }: { searchParams: Promise<{ disconnected?: string; confirm?: string }> }) {
  const sp = await searchParams;
  const { user, conn, name } = await ctx();
  return (
    <main>
      <TopBar title="Perfil y privacidad" />
      <div className="s-pad">
        <div className="hello" style={{ padding: 0 }}><div className="avatar">{(name[0] ?? "U").toUpperCase()}</div><div className="t"><b>{name}</b><small>{user.email}</small></div></div>
        {sp.disconnected ? <div className="done-tag"><Icon id="i-check" size={18} />Correo desconectado y datos borrados.</div> : null}
        {conn ? (
          <div className="result" style={{ gap: 8 }}>
            <div className="top"><b>Gmail conectado</b><span className={`chip ${conn.status === "active" ? "chip-green" : "chip-red"}`}>{conn.status === "active" ? "Solo lectura" : "Vencido"}</span></div>
            <span className="hint">{conn.google_email} · Último escaneo: {conn.last_scan_at ? fmtDate(conn.last_scan_at) : "nunca"}</span>
            {conn.status === "active" ? <Link className="btn btn-ghost" href="/app/scan">Escanear de nuevo</Link> : <Link className="btn btn-green" href="/app/connect">Conectar de nuevo</Link>}
          </div>
        ) : (
          <div className="connect-cta"><b>No hay correo conectado</b><Link className="btn btn-green" href="/app/connect">Conectar mi correo</Link></div>
        )}
        <details className="note"><summary style={{ cursor: "pointer", fontWeight: 700 }}>Qué leemos de tu correo</summary>
          <div className="scope" style={{ marginTop: 10 }}>
            <div className="y"><Icon id="i-check" />Compras, facturas electrónicas, bancos, aerolíneas y suscripciones</div>
            <div className="y"><Icon id="i-check" />Guardamos solo comercio, monto, fechas, plazos y el asunto del correo de prueba</div>
            <div className="n"><Icon id="i-x" />No guardamos correos completos ni leemos conversaciones personales</div>
          </div>
        </details>
        {conn ? (
          <form action={disconnectGmail}><button className="btn dangerbtn btn-block">Desconectar correo y borrar lo que leímos</button></form>
        ) : null}
        {sp.confirm ? (
          <div className="note" style={{ display: "grid", gap: 10 }}>
            <b>¿Borrar tu cuenta?</b><span>Borramos tu cuenta, tus hallazgos, garantías y casos. No se puede deshacer.</span>
            <div className="row2"><Link className="btn btn-ghost" href="/app/profile">Cancelar</Link><form action={deleteAccount}><button className="btn dangerbtn btn-block">Sí, borrar</button></form></div>
          </div>
        ) : <Link className="linkbtn" href="/app/profile?confirm=1" style={{ color: "var(--red)" }}>Borrar mi cuenta</Link>}
        <form action="/auth/signout" method="post"><button className="btn btn-ghost btn-block">Cerrar sesión</button></form>
        <p className="hint"><Link href="/privacidad">Política de privacidad y términos</Link></p>
      </div>
      <TabBar />
    </main>
  );
}
