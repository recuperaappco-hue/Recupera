import Link from "next/link";
import { ctx } from "@/lib/data";
import { cop, fmtDate } from "@/lib/dates";
import { CATEGORY_LABEL } from "@/lib/letters";
import { TabBar } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { RULE_ICON, STATUS } from "@/components/rows";


export default async function Cases() {
  const { supabase } = await ctx();
  const { data } = await supabase.from("cases").select("*").order("created_at", { ascending: false });
  const cases = data ?? [];
  return (
    <main>
      <TopBar title="Mis casos" />
      <div className="s-pad">
        {cases.length === 0 ? <div className="note">Todavía no tienes casos. Cuando reclames un hallazgo, aparece aquí.</div> : null}
        <div className="list">
          {cases.map((c) => {
            const st = STATUS[c.status] ?? STATUS.authorized;
            return (
              <Link key={c.id} className="casecard" href={`/app/cases/${c.id}`}>
                <span className="ic"><Icon id={RULE_ICON[c.category] ?? "i-file"} /></span>
                <span className="m"><b>{c.merchant ?? "Empresa"}</b><span className="a num">{c.amount ? cop(c.amount) : CATEGORY_LABEL[c.category]}</span><small>#{c.short_id} · {CATEGORY_LABEL[c.category]} · {fmtDate(c.created_at)}</small></span>
                <span className={`chip ${st[1]}`}>{st[0]}</span>
              </Link>
            );
          })}
        </div>
        <Link className="opt" href="/app/cases/new"><span className="ic"><Icon id="i-plus" /></span><span><b>Contar un caso a mano</b><span>Algo que no encontramos en tu correo</span></span><Icon id="i-chev" size={18} className="chev" /></Link>
      </div>
      <TabBar />
    </main>
  );
}
