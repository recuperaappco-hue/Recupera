import { notFound, redirect } from "next/navigation";
import { ctx } from "@/lib/data";
import { buildLetter } from "@/lib/letters";
import { TopBar } from "@/components/TopBar";
import { ClaimForm } from "@/components/ClaimForm";
import type { Evidence } from "@/lib/rules";

export default async function Claim({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, name } = await ctx();
  const { data: f } = await supabase.from("findings").select("*").eq("id", id).maybeSingle();
  if (!f) notFound();
  if (f.status === "claimed") redirect("/app/cases");
  const ev = (f.evidence ?? []) as Evidence[];
  const { subject, body } = buildLetter({
    category: f.rule, merchant: f.merchant, amount: f.amount, name: name || "[Tu nombre]", email: user.email ?? "",
    orderRef: f.data?.order_ref ?? null, eventDate: f.data?.event_date ?? null, dueDate: f.due_date,
    priceFrom: f.price_from, priceTo: f.price_to, evidence: ev.map((e) => ({ subject: e.subject, date: e.date })),
  });
  return (
    <main>
      <TopBar title="Revisa y aprueba" back={`/app/f/${f.id}`} />
      <ClaimForm category={f.rule} merchant={f.merchant} amount={f.amount} subject={subject} body={body} findingId={f.id} feeable={f.grp === "money"} />
    </main>
  );
}
