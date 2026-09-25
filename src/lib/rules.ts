// Deterministic rules that turn extracted email events into findings.
// Kept free of server-only imports so they can be unit tested (npm test).
import { addBusinessDays, addDays, cop, daysBetween, fmtDate, iso, parseISO } from "./dates";

export type EventKind =
  | "refund_promised" | "refund_received" | "charge" | "price_increase" | "trial_started"
  | "purchase_invoice" | "flight_cancelled" | "order_not_delivered";

export type EmailEvent = {
  gmail_id: string;
  kind: EventKind;
  merchant: string | null;
  amount: number | null;
  currency: string | null;
  event_date: string | null;
  due_date: string | null;
  promised_business_days: number | null;
  promised_calendar_days: number | null;
  order_ref: string | null;
  product: string | null;
  price_from: number | null;
  price_to: number | null;
  warranty_months: number | null;
  received_at: string;
  subject: string;
  sender: string;
  snippet: string;
};

export type Evidence = { gmail_id: string; subject: string; sender: string; date: string; snippet: string };
export type Finding = {
  rule: "refund_pending" | "duplicate_charge" | "flight_cancelled" | "order_not_delivered" | "price_increase" | "trial_ending";
  grp: "money" | "alert";
  title: string;
  merchant: string | null;
  amount: number | null;
  amount_monthly: number | null;
  price_from: number | null;
  price_to: number | null;
  due_date: string | null;
  confidence: "high" | "medium";
  summary: string;
  checks: [boolean, string][];
  evidence: Evidence[];
  data: Record<string, unknown>;
  dedupe_key: string;
};
export type WarrantyItem = { item: string; store: string | null; price: number | null; bought_on: string; until: string; gmail_id: string; dedupe_key: string };

export function normMerchant(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\b(s\.?a\.?s?|ltda|inc|llc|colombia|co|com|sucursal)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function sameMerchant(a: string | null, b: string | null) {
  const x = normMerchant(a), y = normMerchant(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const fx = x.split(" ")[0], fy = y.split(" ")[0];
  return fx.length >= 4 && fx === fy;
}
const sameAmount = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) <= Math.max(1, a * 0.01);
const ev = (e: EmailEvent): Evidence => ({ gmail_id: e.gmail_id, subject: e.subject, sender: e.sender, date: e.received_at.slice(0, 10), snippet: e.snippet });
const key = (...p: (string | number | null | undefined)[]) => p.map((x) => normMerchant(String(x ?? ""))).join("|");

function refundedAfter(events: EmailEvent[], e: EmailEvent) {
  const since = e.event_date ?? e.received_at.slice(0, 10);
  return events.some(
    (r) => r.kind === "refund_received" && (r.event_date ?? r.received_at.slice(0, 10)) >= since &&
      (sameMerchant(r.merchant, e.merchant) || sameAmount(r.amount, e.amount))
  );
}

export function buildFindings(events: EmailEvent[], today: string): { findings: Finding[]; warranties: WarrantyItem[] } {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  const push = (f: Finding) => { if (!seen.has(f.dedupe_key)) { seen.add(f.dedupe_key); findings.push(f); } };

  // 1) Refund promised, deadline passed, no refund seen.
  for (const e of events.filter((x) => x.kind === "refund_promised")) {
    const base = e.event_date ?? e.received_at.slice(0, 10);
    let due: string, rule: string, assumed = false;
    if (e.due_date) { due = e.due_date; rule = `La tienda prometió el reembolso para el ${fmtDate(due)}`; }
    else if (e.promised_business_days) { due = addBusinessDays(base, e.promised_business_days); rule = `El plazo de ${e.promised_business_days} días hábiles venció el ${fmtDate(due)}`; }
    else if (e.promised_calendar_days) { due = iso(addDays(parseISO(base), e.promised_calendar_days)); rule = `El plazo de ${e.promised_calendar_days} días venció el ${fmtDate(due)}`; }
    else { due = addBusinessDays(base, 15); assumed = true; rule = `El correo no da plazo. Tomamos 15 días hábiles como referencia: venció el ${fmtDate(due)}`; }
    if (due >= today || daysBetween(due, today) > 300) continue;
    if (refundedAfter(events, e)) continue;
    const high = e.amount != null && !assumed;
    const checks: [boolean, string][] = [
      [true, `La tienda confirmó la devolución el ${fmtDate(base)}`],
      [!assumed, rule],
      [true, "No encontramos correo de reembolso ni abono del banco después de esa fecha"],
    ];
    if (e.amount == null) checks.push([false, "El correo no dice el monto: confírmalo antes de reclamar"]);
    push({
      rule: "refund_pending", grp: "money", title: "Reembolso pendiente", merchant: e.merchant, amount: e.amount,
      amount_monthly: null, price_from: null, price_to: null, due_date: due, confidence: high ? "high" : "medium",
      summary: `Devolución confirmada el ${fmtDate(base)} · el plazo venció el ${fmtDate(due)}`,
      checks, evidence: [ev(e)], data: { order_ref: e.order_ref, event_date: base, promised_business_days: e.promised_business_days },
      dedupe_key: key("refund", e.merchant, e.amount, e.order_ref || base.slice(0, 7)),
    });
  }

  // 2) Duplicate charge: same merchant and amount within 15 minutes.
  const charges = events.filter((x) => x.kind === "charge" && x.amount != null).sort((a, b) => a.received_at.localeCompare(b.received_at));
  for (let i = 0; i < charges.length; i++) {
    for (let j = i + 1; j < charges.length; j++) {
      const a = charges[i], b = charges[j];
      const mins = (Date.parse(b.received_at) - Date.parse(a.received_at)) / 60000;
      if (mins > 15) break;
      if (a.gmail_id === b.gmail_id || !sameAmount(a.amount, b.amount) || !sameMerchant(a.merchant, b.merchant)) continue;
      if (refundedAfter(events, b)) continue;
      const d = a.received_at.slice(0, 10);
      push({
        rule: "duplicate_charge", grp: "money", title: "Cobro duplicado", merchant: a.merchant, amount: a.amount,
        amount_monthly: null, price_from: null, price_to: null, due_date: null, confidence: mins <= 5 ? "high" : "medium",
        summary: `Dos cobros iguales el ${fmtDate(d)}, con ${Math.max(1, Math.round(mins))} minutos de diferencia`,
        checks: [
          [true, `Dos alertas del banco por ${cop(a.amount)} en ${a.merchant ?? "el mismo comercio"}`],
          [mins <= 5, `Separadas por ${Math.max(1, Math.round(mins))} minutos`],
          [false, "Confirma que no hiciste dos compras a propósito"],
        ],
        evidence: [ev(a), ev(b)], data: { event_date: d },
        dedupe_key: key("dup", a.merchant, a.amount, d),
      });
    }
  }

  // 3) Flight cancelled with no refund.
  for (const e of events.filter((x) => x.kind === "flight_cancelled")) {
    const d = e.event_date ?? e.received_at.slice(0, 10);
    if (daysBetween(d, today) > 365 || refundedAfter(events, e)) continue;
    push({
      rule: "flight_cancelled", grp: "money", title: "Vuelo cancelado sin reembolso", merchant: e.merchant, amount: e.amount,
      amount_monthly: null, price_from: null, price_to: null, due_date: null, confidence: "medium",
      summary: `Vuelo del ${fmtDate(d)} cancelado · no vemos reembolso`,
      checks: [[true, "La aerolínea confirmó la cancelación"], [true, "No hay correo de reembolso después de la cancelación"], [false, "Confirma que no aceptaste un bono o un cambio de vuelo"]],
      evidence: [ev(e)], data: { order_ref: e.order_ref, event_date: d },
      dedupe_key: key("flight", e.merchant, e.order_ref, d),
    });
  }

  // 4) Order not delivered.
  for (const e of events.filter((x) => x.kind === "order_not_delivered")) {
    const d = e.event_date ?? e.received_at.slice(0, 10);
    if (daysBetween(d, today) > 120 || refundedAfter(events, e)) continue;
    push({
      rule: "order_not_delivered", grp: "money", title: "Pedido no entregado", merchant: e.merchant, amount: e.amount,
      amount_monthly: null, price_from: null, price_to: null, due_date: e.due_date, confidence: "medium",
      summary: `La tienda reportó un problema con tu pedido el ${fmtDate(d)}`,
      checks: [[true, "La tienda avisó que el pedido está retrasado, perdido o cancelado"], [true, "No vemos reembolso después de ese aviso"], [false, "Confirma que el pedido no te llegó"]],
      evidence: [ev(e)], data: { order_ref: e.order_ref, event_date: d },
      dedupe_key: key("order", e.merchant, e.order_ref || e.amount, d.slice(0, 7)),
    });
  }

  // 5) Price increases that start soon or started in the last 30 days.
  for (const e of events.filter((x) => x.kind === "price_increase")) {
    if (!e.due_date || daysBetween(e.due_date, today) > 30) continue;
    if (e.price_from != null && e.price_to != null && e.price_to <= e.price_from) continue;
    const diff = e.price_from != null && e.price_to != null ? e.price_to - e.price_from : null;
    push({
      rule: "price_increase", grp: "alert", title: "Aumento de tarifa", merchant: e.merchant, amount: null,
      amount_monthly: diff, price_from: e.price_from, price_to: e.price_to, due_date: e.due_date, confidence: "high",
      summary: e.price_from != null && e.price_to != null ? `Sube de ${cop(e.price_from)} a ${cop(e.price_to)} desde el ${fmtDate(e.due_date)}` : `Cambia de precio desde el ${fmtDate(e.due_date)}`,
      checks: [], evidence: [ev(e)], data: {},
      dedupe_key: key("price", e.merchant, e.due_date),
    });
  }

  // 6) Free trials that end in the next 45 days.
  for (const e of events.filter((x) => x.kind === "trial_started")) {
    if (!e.due_date || e.due_date < today || daysBetween(today, e.due_date) > 45) continue;
    push({
      rule: "trial_ending", grp: "alert", title: "Prueba gratis termina", merchant: e.merchant, amount: null,
      amount_monthly: e.amount, price_from: null, price_to: null, due_date: e.due_date, confidence: "high",
      summary: `Termina el ${fmtDate(e.due_date)}${e.amount ? ` · después cobran ${cop(e.amount)} al mes` : ""}`,
      checks: [], evidence: [ev(e)], data: {},
      dedupe_key: key("trial", e.merchant, e.due_date),
    });
  }

  // Warranties from invoices of durable goods.
  const warranties: WarrantyItem[] = [];
  const wseen = new Set<string>();
  for (const e of events.filter((x) => x.kind === "purchase_invoice" && x.product)) {
    if ((e.currency ?? "COP") === "COP" && e.amount != null && e.amount < 150000) continue;
    const bought = e.event_date ?? e.received_at.slice(0, 10);
    const d = parseISO(bought);
    d.setUTCMonth(d.getUTCMonth() + (e.warranty_months || 12));
    const until = iso(d);
    if (until < today) continue;
    const k = key("w", e.product, bought);
    if (wseen.has(k)) continue;
    wseen.add(k);
    warranties.push({ item: e.product!, store: e.merchant, price: e.amount, bought_on: bought, until, gmail_id: e.gmail_id, dedupe_key: k });
  }
  return { findings, warranties };
}
