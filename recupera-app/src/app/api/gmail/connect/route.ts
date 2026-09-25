import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getUser } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { googleAuthUrl } from "@/lib/gmail";

const CONSENT_VERSION = "gmail-v0.1";

// Records the user's consent and sends them to Google to grant read-only Gmail access.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  const form = await request.formData();
  if (form.get("consent") !== "yes") return NextResponse.redirect(new URL("/app/connect?consent=1", request.url), { status: 303 });

  await adminClient().from("profiles").update({ consent_version: CONSENT_VERSION, consent_at: new Date().toISOString() }).eq("id", user.id);
  await adminClient().from("audit_log").insert({ user_id: user.id, action: "consent", detail: { version: CONSENT_VERSION } });

  const state = randomBytes(24).toString("hex");
  const res = NextResponse.redirect(googleAuthUrl(state, user.email ?? undefined), { status: 303 });
  res.cookies.set("g_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
