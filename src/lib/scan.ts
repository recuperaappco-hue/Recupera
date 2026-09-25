import "server-only";
import { adminClient } from "./supabase/admin";
import { decrypt } from "./crypto";
import { accessTokenFromRefresh, fetchMessage, listCandidateIds, pool, ReconnectNeeded, type MailItem } from "./gmail";
import { extractBatch } from "./extract";
import { buildFindings, type EmailEvent } from "./rules";
import { todayISO } from "./dates";

const MAX_NEW_PER_SCAN = 160;
const BATCH = 6;

export type ScanStats = { checked: number; processed: number; relevant: number; findings: number; warranties: number; remaining: number };

export async function runScan(userId: string): Promise<ScanStats> {
  const db = adminClient();
  const { data: conn } = await db.from("gmail_connections").select("*").eq("user_id", userId).single();
  if (!conn) throw new ReconnectNeeded("no connection");

  let token: string;
  try {
    token = await accessTokenFromRefresh(decrypt(conn.refresh_token_enc));
  } catch (e) {
    if (e instanceof ReconnectNeeded) await db.from("gmail_connections").update({ status: "expired" }).eq("user_id", userId);
    throw e;
  }

  // 1. Candidate emails from narrow Gmail searches.
  const ids = await listCandidateIds(token);

  // 2. Skip emails already processed in earlier scans (saves AI cost).
  const done = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await db.from("email_events").select("gmail_id").eq("user_id", userId).in("gmail_id", ids.slice(i, i + 100));
    data?.forEach((r) => done.add(r.gmail_id));
  }
  const fresh = ids.filter((id) => !done.has(id));
  const now = fresh.slice(0, MAX_NEW_PER_SCAN);

  // 3. Fetch and read.
  const mails = (await pool(now, 8, (id) => fetchMessage(token, id).catch(() => null))).filter(Boolean) as MailItem[];
  const batches: MailItem[][] = [];
  for (let i = 0; i < mails.length; i += BATCH) batches.push(mails.slice(i, i + BATCH));
  const events = (await pool(batches, 4, (b) => extractBatch(b).catch((err) => { console.error("extract failed", err); return [] as EmailEvent[]; }))).flat();

  // 4. Store facts only. Emails without events get a marker row so they are not re-read.
  const withEvents = new Set(events.map((e) => e.gmail_id));
  const rows = [
    ...events.map((e) => ({ ...e, user_id: userId, item_key: `${e.product ?? ""}|${e.amount ?? ""}` })),
    ...mails.filter((m) => !withEvents.has(m.id)).map((m) => ({ user_id: userId, gmail_id: m.id, kind: "none", received_at: m.receivedAt, item_key: "" })),
  ];
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from("email_events").upsert(rows.slice(i, i + 200), { onConflict: "user_id,gmail_id,kind,item_key", ignoreDuplicates: true });
    if (error) console.error("email_events upsert", error.message);
  }

  // 5. Rebuild findings from all stored facts. Existing findings keep their status.
  const { data: all } = await db.from("email_events").select("*").eq("user_id", userId).neq("kind", "none");
  const { findings, warranties } = buildFindings((all ?? []) as EmailEvent[], todayISO());
  if (findings.length) {
    const { error } = await db.from("findings").upsert(findings.map((f) => ({ ...f, user_id: userId })), { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
    if (error) console.error("findings upsert", error.message);
  }
  if (warranties.length) {
    const { error } = await db.from("warranties").upsert(warranties.map((w) => ({ ...w, user_id: userId })), { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
    if (error) console.error("warranties upsert", error.message);
  }

  const stats: ScanStats = {
    checked: ids.length, processed: mails.length, relevant: withEvents.size,
    findings: findings.length, warranties: warranties.length, remaining: Math.max(0, fresh.length - now.length),
  };
  await db.from("gmail_connections").update({ last_scan_at: new Date().toISOString(), last_scan_stats: stats, status: "active" }).eq("user_id", userId);
  await db.from("audit_log").insert({ user_id: userId, action: "scan", detail: stats });
  return stats;
}
