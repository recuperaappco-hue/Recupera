import { notFound } from "next/navigation";
import { ctx } from "@/lib/data";
import { addBusinessDays, cop, fmtDate } from "@/lib/dates";
import { CATEGORY_LABEL } from "@/lib/letters";
import { TopBar } from "@/components/TopBar";
import { TabBar } from "@/components/TabBar";
import { CopyButton } from "@/components/CopyButton";
import { updateCase } from "../../actions";
import { STATUS } from "@/components/rows";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await ctx();
  const { data: c } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const st = STATUS[c.status] ?? STATUS.authorized;
  const due = c.sent_at ? addBusinessDays(c.sent_at.slice(0, 10), 15) : null;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.merchant_contact ?? "")}&su=${encodeURIComponent(c.subject ?? "")}&body=${encodeURIComponent(c.letter)}`;
  const idx = ["authorized", "sent", "response", "closed"].indexOf(c.status);
  const steps = [
    { t: "Aprobado", d: fmtDate(c.authorized_at), p: "Revisaste y aprobaste el texto." },
    { t: "Enviado a la empresa", d: c.sent_at ? fmtDate(c.sent_at) : "Pendiente", p: "Lo envías desde tu correo, con tus pruebas adjuntas." },
    { t: "Respuesta de la empresa", d: c.response_at ? fmtDate(c.response_at) : due ? `Antes del ${fmtDate(due)}` : "Pendiente", p: "La empresa tiene 15 días hábiles para responder, sin contar fines de semana ni festivos." },
    { t: "Caso cerrado", d: c.closed_at ? fmtDate(c.closed_at) : "Pendiente", p: c.recovered_amount ? `Recuperaste ${cop(c.recovered_amount)}.` : "Confirmas cuando llegue la plata o el resultado." },
  ];
  return (
    <main>
      <TopBar title={`Caso #${c.short_id}`} back="/app/cases" />
      <div className="s-pad">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b>{CATEGORY_LABEL[c.category]}</b><span className={`chip ${st[1]}`}>{st[0]}</span></div>
        <div className="kv num"><div><span>Empresa</span><span>{c.merchant}</span></div>{c.amount ? <div><span>Valor</span><span>{cop(c.amount)}</span></div> : null}</div>
        <ul className="timeline">
          {steps.map((s, i) => <li key={s.t} className={i <= idx ? "done" : i === idx + 1 ? "now" : ""}><span className="d">{i <= idx ? "✓" : ""}</span><div><b>{s.t}</b><small className="num">{s.d}</small><p>{s.p}</p></div></li>)}
        </ul>

        {c.status === "authorized" && (
          <div className="result" style={{ gap: 10 }}>
            <b>Envíalo desde tu correo</b>
            <p className="hint">Así la empresa ve que el reclamo es tuyo. Adjunta los correos de prueba (reenvíalos o agrégalos como adjunto).</p>
            <a className="btn btn-navy btn-block" href={gmailUrl} target="_blank" rel="noopener noreferrer">Abrir en Gmail</a>
            <CopyButton text={`${c.subject}\n\n${c.letter}`} label="Copiar texto" />
            <form action={updateCase}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="step" value="sent" /><button className="btn btn-green btn-block">Ya lo envié</button></form>
          </div>
        )}
        {c.status === "sent" && (
          <form action={updateCase} className="result" style={{ gap: 10 }}>
            <b>¿La empresa respondió?</b>
            <input type="hidden" name="id" value={c.id} /><input type="hidden" name="step" value="response" />
            <textarea className="input" name="response_summary" placeholder="Resume o pega lo que respondió la empresa" />
            <button className="btn btn-green btn-block">Guardar respuesta</button>
          </form>
        )}
        {(c.status === "sent" || c.status === "response") && (
          <form action={updateCase} className="result" style={{ gap: 10 }}>
            <b>¿Te llegó la plata o se resolvió?</b>
            <input type="hidden" name="id" value={c.id} /><input type="hidden" name="step" value="closed" />
            <div className="field"><label htmlFor="recovered">Valor recibido (COP)</label><input className="input num" id="recovered" name="recovered" inputMode="numeric" defaultValue={c.amount ?? ""} /></div>
            <button className="btn btn-green btn-block">Cerrar caso</button>
          </form>
        )}
        {c.response_summary ? <div className="note"><b>Respuesta:</b> {c.response_summary}</div> : null}
        <details className="note"><summary style={{ cursor: "pointer", fontWeight: 600 }}>Ver el texto aprobado</summary><p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{c.subject}{"\n\n"}{c.letter}</p></details>
      </div>
      <TabBar />
    </main>
  );
}
