"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { revokeToken } from "@/lib/gmail";
import { audit } from "@/lib/data";
import { TEMPLATE_VERSION } from "@/lib/letters";

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

export async function setFindingStatus(id: string, status: "paid" | "dismissed" | "open") {
  const { supabase, user } = await me();
  await supabase.from("findings").update({ status }).eq("id", id);
  await audit(user.id, "finding_" + status, { id });
  revalidatePath("/app");
  redirect("/app");
}

export async function toggleFindingRemind(id: string, remind: boolean) {
  const { supabase } = await me();
  await supabase.from("findings").update({ remind }).eq("id", id);
  revalidatePath(`/app/f/${id}`);
}

export async function toggleWarrantyRemind(id: string, remind: boolean) {
  const { supabase } = await me();
  await supabase.from("warranties").update({ remind }).eq("id", id);
  revalidatePath(`/app/warranties/${id}`);
}

/** User reviewed the letter and authorized it. Creates the case. */
export async function createCase(form: FormData) {
  const { supabase, user } = await me();
  if (form.get("c1") !== "on" || form.get("c2") !== "on") throw new Error("Consent missing");
  const findingId = (form.get("finding_id") as string) || null;
  const warrantyId = (form.get("warranty_id") as string) || null;
  const amountRaw = String(form.get("amount") ?? "").replace(/\D/g, "");
  const { data, error } = await supabase
    .from("cases")
    .insert({
      user_id: user.id,
      finding_id: findingId,
      warranty_id: warrantyId,
      category: String(form.get("category")),
      merchant: String(form.get("merchant") ?? "") || null,
      merchant_contact: String(form.get("merchant_contact") ?? "").trim() || null,
      amount: amountRaw ? Number(amountRaw) : null,
      subject: String(form.get("subject") ?? "").slice(0, 200),
      letter: String(form.get("letter") ?? "").slice(0, 8000),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el caso");
  if (findingId) await supabase.from("findings").update({ status: "claimed" }).eq("id", findingId);
  await audit(user.id, "case_authorized", { case: data.id, finding: findingId, warranty: warrantyId, template: TEMPLATE_VERSION });
  redirect(`/app/cases/${data.id}`);
}

export async function updateCase(form: FormData) {
  const { supabase, user } = await me();
  const id = String(form.get("id"));
  const step = String(form.get("step"));
  const now = new Date().toISOString();
  if (step === "sent") await supabase.from("cases").update({ status: "sent", sent_at: now }).eq("id", id);
  if (step === "response") await supabase.from("cases").update({ status: "response", response_at: now, response_summary: String(form.get("response_summary") ?? "").slice(0, 2000) || null }).eq("id", id);
  if (step === "closed") {
    const amt = String(form.get("recovered") ?? "").replace(/\D/g, "");
    await supabase.from("cases").update({ status: "closed", closed_at: now, recovered_amount: amt ? Number(amt) : 0 }).eq("id", id);
    const { data: c } = await supabase.from("cases").select("finding_id").eq("id", id).single();
    if (c?.finding_id) await supabase.from("findings").update({ status: "paid" }).eq("id", c.finding_id);
  }
  await audit(user.id, "case_" + step, { case: id });
  revalidatePath(`/app/cases/${id}`);
}

/** Revokes Google access and deletes everything read from the mailbox. Cases stay. */
export async function disconnectGmail() {
  const { user } = await me();
  const db = adminClient();
  const { data: conn } = await db.from("gmail_connections").select("refresh_token_enc").eq("user_id", user.id).maybeSingle();
  if (conn) {
    try { await revokeToken(decrypt(conn.refresh_token_enc)); } catch { /* token may already be invalid */ }
  }
  await db.from("gmail_connections").delete().eq("user_id", user.id);
  await db.from("email_events").delete().eq("user_id", user.id);
  await db.from("findings").delete().eq("user_id", user.id).neq("status", "claimed");
  await db.from("warranties").delete().eq("user_id", user.id);
  await audit(user.id, "gmail_disconnected");
  revalidatePath("/app");
  redirect("/app/profile?disconnected=1");
}

/** Deletes the account and all data (cascades from auth.users). */
export async function deleteAccount() {
  const { supabase, user } = await me();
  await disconnectGmailSilently(user.id);
  await adminClient().auth.admin.deleteUser(user.id);
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}

async function disconnectGmailSilently(userId: string) {
  const db = adminClient();
  const { data: conn } = await db.from("gmail_connections").select("refresh_token_enc").eq("user_id", userId).maybeSingle();
  if (conn) {
    try { await revokeToken(decrypt(conn.refresh_token_enc)); } catch { /* ignore */ }
  }
}
