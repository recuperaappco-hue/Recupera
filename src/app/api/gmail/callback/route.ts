import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, gmailProfile, GMAIL_SCOPE } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/app/connect?${q}`, url.origin));
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));

  const state = url.searchParams.get("state");
  if (!state || state !== request.cookies.get("g_state")?.value) return back("error=state");
  if (url.searchParams.get("error")) return back("error=denied");
  const code = url.searchParams.get("code");
  if (!code) return back("error=code");

  try {
    const tok = await exchangeCode(code);
    if (!tok.scope.includes(GMAIL_SCOPE)) return back("error=scope");
    if (!tok.refresh_token) return back("error=refresh");
    const profile = await gmailProfile(tok.access_token);
    await adminClient().from("gmail_connections").upsert({
      user_id: user.id,
      google_email: profile.emailAddress,
      refresh_token_enc: encrypt(tok.refresh_token),
      scope: tok.scope,
      status: "active",
      connected_at: new Date().toISOString(),
    });
    await adminClient().from("audit_log").insert({ user_id: user.id, action: "gmail_connected", detail: { email: profile.emailAddress } });
    const res = NextResponse.redirect(new URL("/app/scan", url.origin));
    res.cookies.delete("g_state");
    return res;
  } catch (e) {
    console.error(e);
    return back("error=exchange");
  }
}
