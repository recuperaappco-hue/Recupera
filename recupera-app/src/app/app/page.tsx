import Link from "next/link";
import { ctx } from "@/lib/data";
import { cop, daysBetween, fmtDate, todayISO } from "@/lib/dates";
import { FindingItem, WarrantyItem, type FindingRow, type WarrantyRow } from "@/components/rows";
import { TabBar } from "@/components/TabBar";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { supabase, conn, name } = await ctx();
  const first = name.split(" ")[0] || "Hola";
  const { data: fData } = await supabase.from("findings").select("*").in("status", ["open", "claimed"]).order("created_at", { ascending: false });
  const { data: wData } = await supabase.from("warranties").select("*").order("until");
  const findings = (fData ?? []) as FindingRow[];
  const today = todayISO();
  const urgentW = ((wData ?? []) as WarrantyRow[]).filter((w) => { const d = daysBetween(today, w.until); return d >= 0 && d <= 30; });
  const money = findings.filter((f) => f.grp === "money");
  const alerts = findings.filter((f) => f.grp === "alert");
  const pot = money.reduce((a, f) => a + (Number(f.amount) || 0), 0);
  const save = alerts.reduce((a, f) => a + (Number(f.amount_monthly) || 0) * 12, 0);
  const badge = findings.filter((f) => f.status === "open").length + urgentW.length;

  return (
    <main>
      <div className="hello">
        <div className="avatar">{first[0]?.toUpperCase()}</div>
        <div className="t"><b>Hola, {first}</b><small>{conn?.last_scan_at ? `Último escaneo: ${fmtDate(conn.last_scan_at)}` : "Tu dinero. De vuelta."}</small></div>
        {conn ? <Link className="iconbtn" href="/app/scan" aria-label="Escanear de nuevo"><Icon id="i-refund" /></Link> : null}
      </div>
      <div className="s-pad">
        {!conn ? (
          <div className="connect-cta">
            <b>Conecta tu correo para empezar</b>
            <p className="s-sub">La IA busca dinero por recuperar, cobros que vienen y garantías. Toma un par de minutos.</p>
            <Link className="btn btn-green" href="/app/connect">Conectar mi correo</Link>
          </div>
        ) : conn.status === "expired" ? (
          <div className="banner">Google cerró el acceso a tu correo (en el piloto pasa cada 7 días). <Link className="btn btn-green" href="/app/connect">Conectar de nuevo</Link></div>
        ) : null}

        {conn && (
          <div className="bigcard">
            <div className="lbl">Posible recuperación</div>
            <div className="amt num">{cop(pot)}</div>
            <div className="savings num"><span>Cobros que puedes evitar</span><b>{cop(save)}/año</b></div>
          </div>
        )}
        {money.length > 0 && <div className="grp"><h3>Para reclamar <small>{money.length}</small></h3>{money.map((f) => <FindingItem key={f.id} f={f} />)}</div>}
        {alerts.length > 0 && <div className="grp"><h3>Cobros que vienen <small>{alerts.length}</small></h3>{alerts.map((f) => <FindingItem key={f.id} f={f} />)}</div>}
        {urgentW.length > 0 && <div className="grp"><h3>Garantías por vencer <small>{urgentW.length}</small></h3>{urgentW.map((w) => <WarrantyItem key={w.id} w={w} />)}</div>}
        {conn && conn.last_scan_at && findings.length === 0 && urgentW.length === 0 && (
          <div className="note"><b>No encontramos nada pendiente por ahora.</b> Eso es buena noticia. Vuelve a escanear en unos días o después de una compra o devolución.</div>
        )}
        {conn && !conn.last_scan_at && <Link className="btn btn-navy btn-block" href="/app/scan">Revisar mi correo ahora</Link>}
        <Link className="opt" href="/app/cases/new"><span className="ic"><Icon id="i-plus" /></span><span><b>Contar un caso a mano</b><span>Algo que no encontramos en tu correo</span></span><Icon id="i-chev" size={18} className="chev" /></Link>
        <p className="hint" style={{ textAlign: "center" }}>Recupera no es una firma de abogados. Los montos son una posible recuperación, no una deuda confirmada.</p>
      </div>
      <TabBar badge={badge} />
    </main>
  );
}
