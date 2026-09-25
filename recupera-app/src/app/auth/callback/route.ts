import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

// Google login (basic profile only) returns here through Supabase.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const u = data.user;
      await adminClient().from("profiles").upsert(
        { id: u.id, email: u.email, full_name: (u.user_metadata?.full_name as string) ?? null },
        { onConflict: "id", ignoreDuplicates: false }
      );
      const { data: conn } = await adminClient().from("gmail_connections").select("user_id").eq("user_id", u.id).maybeSingle();
      return NextResponse.redirect(new URL(conn ? "/app" : "/app/connect", url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=1", url.origin));
}
