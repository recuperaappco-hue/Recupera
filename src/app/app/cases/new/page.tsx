import { ctx } from "@/lib/data";
import { TopBar } from "@/components/TopBar";
import { ClaimForm } from "@/components/ClaimForm";
import { buildLetter } from "@/lib/letters";

const OPTIONS = [
  ["refund_pending", "Reembolso no recibido"],
  ["duplicate_charge", "Cobro duplicado"],
  ["order_not_delivered", "Compra no entregada"],
  ["flight_cancelled", "Vuelo cancelado"],
] as const;

export default async function NewCase({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const { user, name } = await ctx();
  const cat = OPTIONS.find(([k]) => k === sp.c)?.[0];
  if (!cat) return (
    <main>
      <TopBar title="Contar un caso" back="/app" />
      <div className="s-pad">
        <h2 className="s-title">¿Qué problema tienes?</h2>
        <div className="list">{OPTIONS.map(([k, l]) => <a key={k} className="opt" href={`/app/cases/new?c=${k}`}><span><b>{l}</b></span></a>)}</div>
      </div>
    </main>
  );
  const { subject, body } = buildLetter({ category: cat, merchant: null, amount: null, name: name || "[Tu nombre]", email: user.email ?? "" });
  return (
    <main>
      <TopBar title="Contar un caso" back="/app/cases/new" />
      <ClaimForm category={cat} merchant={null} amount={null} subject={subject} body={body.replace(/—/g, "[fecha]")} feeable />
    </main>
  );
}
