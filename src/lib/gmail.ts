import "server-only";
import { unzipSync, strFromU8 } from "fflate";
import { htmlToText, invoiceFromXml } from "./mailparse";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export class ReconnectNeeded extends Error {}

export function googleAuthUrl(state: string, loginHint?: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/gmail/callback`,
    response_type: "code",
    scope: `openid email ${GMAIL_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) p.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(code: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/gmail/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!r.ok) throw new Error("token_exchange_failed: " + (await r.text()));
  return (await r.json()) as { access_token: string; refresh_token?: string; scope: string };
}

export async function accessTokenFromRefresh(refreshToken: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (r.status === 400 || r.status === 401) throw new ReconnectNeeded("refresh token expired or revoked");
  if (!r.ok) throw new Error("token_refresh_failed: " + r.status);
  return ((await r.json()) as { access_token: string }).access_token;
}

export async function revokeToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}

async function gget<T>(token: string, path: string): Promise<T> {
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) throw new ReconnectNeeded("access token rejected");
  if (!r.ok) throw new Error(`gmail ${r.status} ${path.slice(0, 60)}`);
  return r.json() as Promise<T>;
}

export async function gmailProfile(token: string) {
  return gget<{ emailAddress: string }>(token, "/profile");
}

/** Searches narrow enough to skip personal mail. Spanish + English wording used by Colombian merchants and banks. */
export const SEARCHES = [
  'newer_than:1y (reembolso OR devolución OR devolucion OR reintegro OR "nota crédito" OR "nota credito" OR refund)',
  'newer_than:6m ("compra aprobada" OR "compra por" OR "transacción aprobada" OR "transaccion aprobada" OR "realizaste una compra" OR "pago aprobado")',
  'newer_than:1y ("factura electrónica" OR "factura electronica" OR "factura de venta" OR "documento electrónico" OR "documento electronico")',
  'newer_than:6m ("nuevo precio" OR "cambio de precio" OR "ajuste de tarifa" OR "actualización de precio" OR "actualizacion de precio" OR "cambios en tu plan" OR "price increase" OR "precio de tu plan")',
  'newer_than:4m ("prueba gratis" OR "periodo de prueba" OR "período de prueba" OR "free trial" OR "mes gratis" OR "días gratis")',
  'newer_than:1y ("vuelo cancelado" OR "ha sido cancelado" OR "fue cancelado" OR "flight cancelled" OR "flight canceled" OR "no ha sido entregado" OR "retraso en tu pedido" OR "pedido cancelado")',
];

export async function listCandidateIds(token: string, maxTotal = 220): Promise<string[]> {
  const ids = new Set<string>();
  for (const q of SEARCHES) {
    const res = await gget<{ messages?: { id: string }[] }>(token, `/messages?maxResults=60&q=${encodeURIComponent(q)}`);
    for (const m of res.messages ?? []) ids.add(m.id);
    if (ids.size >= maxTotal) break;
  }
  return [...ids].slice(0, maxTotal);
}

type Part = { mimeType?: string; filename?: string; body?: { data?: string; attachmentId?: string; size?: number }; parts?: Part[]; headers?: { name: string; value: string }[] };
type Msg = { id: string; internalDate: string; snippet: string; payload: Part };

const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

function walk(p: Part, out: { plain: string[]; html: string[]; atts: { id: string; name: string; size: number }[] }) {
  if (p.filename && p.body?.attachmentId) out.atts.push({ id: p.body.attachmentId, name: p.filename, size: p.body.size ?? 0 });
  else if (p.mimeType === "text/plain" && p.body?.data) out.plain.push(b64(p.body.data).toString("utf8"));
  else if (p.mimeType === "text/html" && p.body?.data) out.html.push(b64(p.body.data).toString("utf8"));
  p.parts?.forEach((c) => walk(c, out));
}

async function readInvoiceAttachment(token: string, msgId: string, att: { id: string; name: string; size: number }) {
  if (att.size > 1_500_000) return "";
  const name = att.name.toLowerCase();
  if (!name.endsWith(".zip") && !name.endsWith(".xml")) return "";
  const res = await gget<{ data: string }>(token, `/messages/${msgId}/attachments/${att.id}`);
  const buf = b64(res.data);
  if (name.endsWith(".xml")) return invoiceFromXml(buf.toString("utf8"));
  try {
    const files = unzipSync(new Uint8Array(buf));
    const xmlName = Object.keys(files).find((f) => f.toLowerCase().endsWith(".xml"));
    return xmlName ? invoiceFromXml(strFromU8(files[xmlName])) : "";
  } catch {
    return "";
  }
}

export type MailItem = { id: string; receivedAt: string; subject: string; from: string; snippet: string; text: string };

export async function fetchMessage(token: string, id: string): Promise<MailItem> {
  const m = await gget<Msg>(token, `/messages/${id}?format=full`);
  const h = (n: string) => m.payload.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
  const out = { plain: [] as string[], html: [] as string[], atts: [] as { id: string; name: string; size: number }[] };
  walk(m.payload, out);
  let text = out.plain.join("\n").trim();
  if (text.length < 80 && out.html.length) text = htmlToText(out.html.join("\n"));
  const inv = out.atts.find((a) => /\.(zip|xml)$/i.test(a.name));
  if (inv) {
    const invText = await readInvoiceAttachment(token, id, inv).catch(() => "");
    if (invText) text = invText + "\n\n" + text;
  }
  return {
    id,
    receivedAt: new Date(Number(m.internalDate)).toISOString(),
    subject: h("subject").slice(0, 200),
    from: h("from").slice(0, 200),
    snippet: (m.snippet ?? "").slice(0, 300),
    text: text.replace(/\s+\n/g, "\n").slice(0, 3500),
  };
}

/** Runs async work with a concurrency limit. */
export async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}
