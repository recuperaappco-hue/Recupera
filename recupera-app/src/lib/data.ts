import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { adminClient } from "./supabase/admin";

/** Signed-in user plus Gmail connection status (never the token). */
export async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");
  const { data: conn } = await adminClient()
    .from("gmail_connections")
    .select("google_email,status,connected_at,last_scan_at,last_scan_stats")
    .eq("user_id", user.id)
    .maybeSingle();
  const name = (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "";
  return { supabase, user, conn, name };
}

export async function audit(userId: string, action: string, detail?: Record<string, unknown>) {
  await adminClient().from("audit_log").insert({ user_id: userId, action, detail: detail ?? null });
}
