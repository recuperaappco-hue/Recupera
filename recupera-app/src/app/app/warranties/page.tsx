import Link from "next/link";
import { ctx } from "@/lib/data";
import { cop, todayISO } from "@/lib/dates";
import { TabBar } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";
import { WarrantyItem, type WarrantyRow } from "@/components/rows";

export default async function Warranties() {
  const { supabase, conn } = await ctx();
  const { data } = await supabase.from("warranties").select("*").gte("until", todayISO()).order("until");
  const ws = (data ?? []) as WarrantyRow[];
  const total = ws.reduce((a, w) => a + (Number(w.price) || 0), 0);
  return (
    <main>
      <TopBar title="Garantías" />
      <div className="s-pad">
        {!conn ? (
          <div className="connect-cta"><b>Tus garantías, en un solo lugar</b><p className="s-sub">Conecta tu correo y armamos la lista con tus facturas electrónicas.</p><Link className="btn btn-green" href="/app/connect">Conectar mi correo</Link></div>
        ) : ws.length === 0 ? (
          <div className="note">No encontramos productos con garantía vigente en tus facturas. Aparecen aquí cuando compras electrodomésticos, tecnología o muebles con factura electrónica.</div>
        ) : (
          <>
            <div className="bigcard"><div className="lbl">Compras protegidas por garantía</div><div className="amt num">{cop(total)}</div><div className="savings"><span>{ws.length} productos encontrados en tus facturas</span></div></div>
            <div className="grp">{ws.map((w) => <WarrantyItem key={w.id} w={w} />)}</div>
            <p className="hint">Si la factura no dice otra cosa, calculamos un año de garantía desde la compra. Revisa las condiciones de cada producto.</p>
          </>
        )}
      </div>
      <TabBar />
    </main>
  );
}
