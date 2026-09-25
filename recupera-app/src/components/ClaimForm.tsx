import { createCase } from "@/app/app/actions";
import { cop } from "@/lib/dates";

type Props = {
  category: string; merchant: string | null; amount: number | null; subject: string; body: string;
  findingId?: string; warrantyId?: string; feeable: boolean; editableFacts?: boolean;
};

export function ClaimForm(p: Props) {
  return (
    <form action={createCase} style={{ display: "contents" }}>
      <div className="s-pad">
        <h2 className="s-title">{p.category === "price_increase" || p.category === "warranty" ? "Esta es tu solicitud" : "Este es tu reclamo"}</h2>
        <p className="s-sub">La escribimos con los datos de tu correo. Revísala y edítala. No se envía nada sin tu autorización.</p>
        <input type="hidden" name="category" value={p.category} />
        {p.findingId ? <input type="hidden" name="finding_id" value={p.findingId} /> : null}
        {p.warrantyId ? <input type="hidden" name="warranty_id" value={p.warrantyId} /> : null}
        <div className="row2">
          <div className="field"><label htmlFor="merchant">Empresa</label><input className="input" id="merchant" name="merchant" defaultValue={p.merchant ?? ""} required /></div>
          <div className="field"><label htmlFor="amount">Valor (COP)</label><input className="input num" id="amount" name="amount" inputMode="numeric" defaultValue={p.amount ?? ""} /></div>
        </div>
        <div className="field"><label htmlFor="merchant_contact">Correo de servicio al cliente de la empresa (si lo tienes)</label><input className="input" id="merchant_contact" name="merchant_contact" type="email" placeholder="servicioalcliente@empresa.com" /></div>
        <div className="field"><label htmlFor="subject">Asunto</label><input className="input" id="subject" name="subject" defaultValue={p.subject} required /></div>
        <div className="field"><label htmlFor="letter">Texto</label><textarea className="input letter" id="letter" name="letter" defaultValue={p.body} required /></div>
        {p.feeable ? (
          <div className="result" style={{ gap: 8 }}>
            <b>Tarifa (piloto)</b>
            <div className="kv num">
              <div><span>Escaneo y análisis</span><span>Gratis</span></div>
              <div><span>Durante el piloto</span><span>Sin costo</span></div>
              {p.amount ? <div><span>Referencia futura (15%)</span><span>{cop(p.amount * 0.15)}</span></div> : null}
            </div>
            <p className="hint">El modelo de precios está en revisión legal. La empresa te paga directo a ti.</p>
          </div>
        ) : <div className="note">Sin costo durante el piloto.</div>}
        <label className="chk"><input type="checkbox" name="c1" required /><span>Reviso y apruebo este texto. Lo enviaré desde mi propio correo con ayuda de Recupera.</span></label>
        <label className="chk"><input type="checkbox" name="c2" required /><span>Entiendo que Recupera no es una firma de abogados y no garantiza el resultado.</span></label>
      </div>
      <div className="foot"><button className="btn btn-green btn-block" type="submit">Aprobar y preparar envío</button></div>
    </form>
  );
}
