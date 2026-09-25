import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { runScan } from "@/lib/scan";
import { ReconnectNeeded } from "@/lib/gmail";

export const maxDuration = 300;

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  try {
    const stats = await runScan(user.id);
    return NextResponse.json(stats);
  } catch (e) {
    if (e instanceof ReconnectNeeded) return NextResponse.json({ error: "reconnect" }, { status: 409 });
    console.error("scan failed", e);
    return NextResponse.json({ error: "scan_failed" }, { status: 500 });
  }
}
