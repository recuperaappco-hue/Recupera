import { notFound } from "next/navigation";
import { ctx } from "@/lib/data";
import { cop, daysBetween, fmtDate, todayISO } from "@/lib/dates";
import { buildLetter } from "@/lib/letters";
import { TopBar } from "@/components/TopBar";
import { ClaimForm } from "@/components/ClaimForm";
import { toggleWarrantyRemind } from "../../actions";

export default async function Warranty({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fault?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, name } = await ctx();
  const { data: w } = await supabase.from("warranties").select("*").eq("id", id).maybeSingle();
  if (!w) notFound();
  const d = daysBetween(todayISO(), w.until);

  if (sp.fault !== undefined && sp.fault.trim()) {
    const { subject, body } = buildLetter({ category: "warranty", merchant: w.store, amount: w.price, name: name || "[Tu nombre]", email: user.email ?? "", eventDate: w.bought_on, dueDate: w.until, item: w.item, fault: sp.fault.slice(0, 600) });
    return (
      <main>
        <TopBar title="Solicitud de garantía" back={`/app/warranties/${w.id}`} />
        <ClaimForm category="warranty" merchant={w.store} amount={null} subject={subject} body={body} warrantyId={w.id} feeable={false} />
      </main>
    );
  }
  const remind = toggleWarrantyRemind.bind(null, w.id, !w.remind);
  return (
    <main>
      <TopBar title="Garantía" back="/app/warranties" />
      <div className="s-pad">
        {d <= 30 ? <div className="urgent"><b className="t">VENCE EN {d} DÍAS</b><span>Si tiene alguna falla, repórtala antes del <b>{fmtDate(w.until)}</b>.</span></div> : null}
        <div className="result">
          <b style={{ fontFamily: "var(--display)", fontSize: 22 }}>{w.item}</b>
          <div className="kv num">
            <div><span>Tienda</span><span>{w.store ?? "—"}</span></div>
            {w.price ? <div><span>Precio</span><span>{cop(w.price)}</span></div> : null}
            <div><span>Compra</span><span>{fmtDate(w.bought_on)}</span></div>
            <div><span>Garantía hasta</span><span>{fmtDate(w.until)}</span></div>
          </div>
        </div>
        <form method="get" className="result" style={{ gap: 10 }}>
          <b>¿Tiene una falla?</b>
          <textarea className="input" name="fault" required placeholder="Ej.: La pantalla se apaga sola después de 10 minutos de uso." />
          <button className="btn btn-navy btn-block">Preparar solicitud de garantía</button>
        </form>
      </div>
      <div className="foot"><form action={remind}><button className="btn btn-ghost btn-block">{w.remind ? "✓ Recordatorio guardado" : "Guardar recordatorio"}</button></form></div>
    </main>
  );
}
