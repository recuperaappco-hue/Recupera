import Link from "next/link";
import { notFound } from "next/navigation";
import { ctx } from "@/lib/data";
import { cop, daysBetween, fmtDate, todayISO } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { setFindingStatus, toggleFindingRemind } from "../../actions";
import type { Evidence } from "@/lib/rules";

const ROUTE: Record<string, string> = {
  refund_pending: "Reclamo directo a la tienda pidiendo el reembolso. Si no responde en 15 días hábiles o dice que no, queja ante la Superintendencia de Industria y Comercio (SIC).",
  duplicate_charge: "Desconoce el cargo duplicado con tu banco y, en paralelo, reclamo directo al comercio.",
  flight_cancelled: "Solicitud de reembolso a la aerolínea. Si no responde, queja ante la autoridad aeronáutica.",
  order_not_delivered: "Reclamo directo a la tienda. Si pagaste con tarjeta o PSE, pide también la reversión del pago a tu banco (plazo de referencia: 5 días hábiles desde que supiste del problema).",
};

export default async function FindingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await ctx();
  const { data: f } = await supabase.from("findings").select("*").eq("id", id).maybeSingle();
  if (!f) notFound();
  const evidence = (f.evidence ?? []) as Evidence[];
  const checks = (f.checks ?? []) as [boolean, string][];
  const src = evidence.map((e) => (
    <div className="srcmail" key={e.gmail_id}>
      <div className="h"><Icon id="i-mail" size={14} />Correo de origen · {fmtDate(e.date)}</div>
      <b>{e.subject}</b><small className="hint">{e.sender}</small><p>{e.snippet}</p>
    </div>
  ));
  const paid = setFindingStatus.bind(null, f.id, "paid");
  const dismiss = setFindingStatus.bind(null, f.id, "dismissed");

  if (f.grp === "money") return (
    <main>
      <TopBar title={f.title} back="/app" />
      <div className="s-pad">
        <div className="result">
          <div className="top"><span className="hint">Posible recuperación</span><span className={`chip ${f.confidence === "high" ? "chip-green" : "chip-amber"}`}>{f.confidence === "high" ? "Alta confianza" : "Confianza media"}</span></div>
          <div className="amt num">{f.amount ? cop(f.amount) : "Monto por confirmar"}</div>
          <div className="kv num"><div><span>Empresa</span><span>{f.merchant ?? "—"}</span></div>{f.data?.order_ref ? <div><span>Referencia</span><span>{String(f.data.order_ref)}</span></div> : null}</div>
        </div>
        <h3 style={{ fontSize: 16 }}>Lo que encontramos</h3>{src}
        <h3 style={{ fontSize: 16 }}>Por qué lo vemos así</h3>
        <ul className="checks">{checks.map(([ok, t], i) => <li key={i}><span className={`dot ${ok ? "y" : "n"}`}>{ok ? "✓" : "!"}</span><span>{t}</span></li>)}</ul>
        <h3 style={{ fontSize: 16 }}>Ruta sugerida</h3><p className="route">{ROUTE[f.rule]}</p>
        <p className="hint">Análisis preliminar hecho con IA, no una confirmación de que la empresa te debe dinero. Revisa los datos antes de reclamar.</p>
      </div>
      <div className="foot">
        {f.status === "claimed" ? <Link className="btn btn-ghost btn-block" href="/app/cases">Ver mis casos</Link> : <>
          <Link className="btn btn-green btn-block" href={`/app/f/${f.id}/claim`}>Reclamar</Link>
          <div className="row2"><form action={paid}><button className="btn btn-ghost btn-block">Ya me pagaron</button></form><form action={dismiss}><button className="btn btn-ghost btn-block">No es correcto</button></form></div>
        </>}
      </div>
    </main>
  );

  if (f.rule === "trial_ending") {
    const d = f.due_date ? daysBetween(todayISO(), f.due_date) : 0;
    const remind = toggleFindingRemind.bind(null, f.id, !f.remind);
    return (
      <main>
        <TopBar title={f.title} back="/app" />
        <div className="s-pad">
          <div className="urgent"><b className="t">QUEDAN {d} DÍAS</b><span>Tu prueba gratis de <b>{f.merchant}</b> termina el <b>{fmtDate(f.due_date)}</b>.{f.amount_monthly ? <> Desde ese día te cobran <b className="num">{cop(f.amount_monthly)}</b> al mes ({cop(f.amount_monthly * 12)} al año).</> : null}</span></div>
          <h3 style={{ fontSize: 16 }}>Lo que encontramos</h3>{src}
          <div className="note"><b>Cómo cancelar:</b> entra a tu cuenta del servicio, busca &quot;Suscripción&quot; o &quot;Plan&quot; y elige cancelar. Guarda el correo de confirmación: si te cobran igual, lo usamos para reclamar.</div>
        </div>
        <div className="foot">
          <form action={remind}><button className={`btn ${f.remind ? "btn-ghost" : "btn-green"} btn-block`}>{f.remind ? "✓ Recordatorio guardado" : "Guardar recordatorio"}</button></form>
          <form action={dismiss}><button className="btn btn-ghost btn-block">La quiero mantener</button></form>
        </div>
      </main>
    );
  }

  // price_increase
  const pct = f.price_from && f.price_to ? ((f.price_to / f.price_from - 1) * 100).toFixed(1).replace(".", ",") : null;
  return (
    <main>
      <TopBar title={f.title} back="/app" />
      <div className="s-pad">
        <div className="result">
          <div className="top"><span className="hint">Nueva tarifa desde el {fmtDate(f.due_date)}</span>{pct ? <span className="chip chip-amber">+{pct}%</span> : null}</div>
          <div className="kv num">
            <div><span>Plan</span><span>{f.merchant}</span></div>
            {f.price_from ? <div><span>Precio actual</span><span>{cop(f.price_from)}/mes</span></div> : null}
            {f.price_to ? <div><span>Precio nuevo</span><span>{cop(f.price_to)}/mes</span></div> : null}
            {f.amount_monthly ? <div><span>Pagarías de más al año</span><span style={{ color: "var(--red)", fontWeight: 700 }}>{cop(f.amount_monthly * 12)}</span></div> : null}
          </div>
        </div>
        <h3 style={{ fontSize: 16 }}>Lo que encontramos</h3>{src}
        <div className="note">Si tu plan tiene precio fijo por contrato o cláusula de permanencia, este aumento podría no aplicarte.</div>
        <h3 style={{ fontSize: 16 }}>Qué puedes hacer</h3>
        <div className="optlist">
          {f.status === "claimed" ? <div className="done-tag"><Icon id="i-check" size={18} />Solicitud enviada</div> :
            <Link className="opt" href={`/app/f/${f.id}/claim`}><span className="ic"><Icon id="i-mail" /></span><span><b>Pedir que mantengan mi tarifa</b><span>Preparamos la solicitud por ti</span></span><Icon id="i-chev" size={18} className="chev" /></Link>}
          <form action={dismiss}><button className="opt"><span className="ic" style={{ background: "var(--soft)", color: "var(--muted)" }}><Icon id="i-check" /></span><span><b>Está bien, lo acepto</b><span>Quitamos esta alerta</span></span></button></form>
        </div>
      </div>
    </main>
  );
}
