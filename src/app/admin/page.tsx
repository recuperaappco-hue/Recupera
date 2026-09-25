import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { cop, fmtDate } from "@/lib/dates";
import { CATEGORY_LABEL } from "@/lib/letters";

export const dynamic = "force-dynamic";

// Pilot metrics. Only emails listed in ADMIN_EMAILS can open it.
export default async function Admin() {
  const user = await getUser();
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!user?.email || !admins.includes(user.email.toLowerCase())) notFound();
  const db = adminClient();
  const count = async (t: string, f?: (q: any) => any) => { let q = db.from(t).select("*", { count: "exact", head: true }); if (f) q = f(q); const { count } = await q; return count ?? 0; };
  const [users, connected, scans, cases, closed] = await Promise.all([
    count("profiles"), count("gmail_connections"), count("audit_log", (q) => q.eq("action", "scan")),
    count("cases"), count("cases", (q) => q.eq("status", "closed")),
  ]);
  const { data: findings } = await db.from("findings").select("rule,status,amount");
  const { data: recent } = await db.from("cases").select("short_id,category,merchant,amount,status,recovered_amount,created_at,closed_at").order("created_at", { ascending: false }).limit(30);
  const { data: rec } = await db.from("cases").select("recovered_amount").eq("status", "closed");
  const recovered = (rec ?? []).reduce((a, r) => a + (Number(r.recovered_amount) || 0), 0);
  const byRule: Record<string, { n: number; open: number; claimed: number; paid: number; dismissed: number; amount: number }> = {};
  for (const f of findings ?? []) {
    const r = (byRule[f.rule] ??= { n: 0, open: 0, claimed: 0, paid: 0, dismissed: 0, amount: 0 });
    r.n++; (r as any)[f.status]++; r.amount += Number(f.amount) || 0;
  }
  return (
    <div className="adm-wrap">
      <h1 style={{ fontSize: 32 }}>Recupera · Piloto</h1>
      <div className="kpis num">
        <div><b>{users}</b><span>Usuarios</span></div>
        <div><b>{connected}</b><span>Correos conectados</span></div>
        <div><b>{scans}</b><span>Escaneos</span></div>
        <div><b>{findings?.length ?? 0}</b><span>Hallazgos</span></div>
        <div><b>{cases}</b><span>Casos aprobados</span></div>
        <div><b>{closed}</b><span>Casos cerrados</span></div>
        <div><b>{cop(recovered)}</b><span>Recuperado</span></div>
      </div>
      <h2>Hallazgos por tipo</h2>
      <div style={{ overflowX: "auto" }}><table className="adm num"><thead><tr><th>Tipo</th><th>Total</th><th>Abiertos</th><th>Reclamados</th><th>Pagados</th><th>Descartados</th><th>Monto</th></tr></thead>
        <tbody>{Object.entries(byRule).map(([k, r]) => <tr key={k}><td>{CATEGORY_LABEL[k] ?? k}</td><td>{r.n}</td><td>{r.open}</td><td>{r.claimed}</td><td>{r.paid}</td><td>{r.dismissed}</td><td>{cop(r.amount)}</td></tr>)}</tbody></table></div>
      <p className="hint">&quot;Descartados&quot; = el usuario dijo que no era correcto. Es la mejor señal de falsos positivos de la IA.</p>
      <h2>Últimos casos</h2>
      <div style={{ overflowX: "auto" }}><table className="adm num"><thead><tr><th>#</th><th>Tipo</th><th>Empresa</th><th>Valor</th><th>Estado</th><th>Recuperado</th><th>Creado</th></tr></thead>
        <tbody>{(recent ?? []).map((c) => <tr key={c.short_id}><td>{c.short_id}</td><td>{CATEGORY_LABEL[c.category] ?? c.category}</td><td>{c.merchant}</td><td>{c.amount ? cop(c.amount) : "—"}</td><td>{c.status}</td><td>{c.recovered_amount ? cop(c.recovered_amount) : "—"}</td><td>{fmtDate(c.created_at)}</td></tr>)}</tbody></table></div>
    </div>
  );
}
