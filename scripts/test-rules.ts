// Unit tests for the deterministic parts: Colombian holidays, business days and finding rules.
import assert from "node:assert/strict";
import { addBusinessDays, holidays } from "../src/lib/dates";
import { buildFindings, sameMerchant, type EmailEvent } from "../src/lib/rules";
import { invoiceFromXmlForTest } from "./xml-fixture";

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log("ok -", name); };

t("2026 Colombian holidays", () => {
  const h = holidays(2026);
  for (const d of ["2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25"]) {
    assert.ok(h.has(d), "missing " + d);
  }
  assert.equal(h.size, 18);
});

t("business days skip weekends and holidays", () => {
  assert.equal(addBusinessDays("2026-08-19", 10), "2026-09-02");
  assert.equal(addBusinessDays("2026-09-24", 15), "2026-10-16"); // skips Oct 12
});

t("merchant matching", () => {
  assert.ok(sameMerchant("Falabella de Colombia S.A.", "falabella"));
  assert.ok(!sameMerchant("Claro", "Tigo"));
});

const base: Omit<EmailEvent, "kind" | "gmail_id"> = {
  merchant: null, amount: null, currency: "COP", event_date: null, due_date: null, promised_business_days: null,
  promised_calendar_days: null, order_ref: null, product: null, price_from: null, price_to: null, warranty_months: null,
  received_at: "2026-08-19T15:00:00.000Z", subject: "s", sender: "x@y.co", snippet: "",
};
const E = (o: Partial<EmailEvent> & Pick<EmailEvent, "kind" | "gmail_id">): EmailEvent => ({ ...base, ...o });
const TODAY = "2026-09-25";

t("refund pending when deadline passed and no refund", () => {
  const { findings } = buildFindings([E({ gmail_id: "a", kind: "refund_promised", merchant: "Tienda X", amount: 479900, event_date: "2026-08-19", promised_business_days: 10 })], TODAY);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "refund_pending");
  assert.equal(findings[0].due_date, "2026-09-02");
  assert.equal(findings[0].confidence, "high");
});

t("no refund finding when refund received later", () => {
  const { findings } = buildFindings([
    E({ gmail_id: "a", kind: "refund_promised", merchant: "Tienda X", amount: 479900, event_date: "2026-08-19", promised_business_days: 10 }),
    E({ gmail_id: "b", kind: "refund_received", merchant: "Tienda X S.A.S.", amount: 479900, event_date: "2026-08-30" }),
  ], TODAY);
  assert.equal(findings.length, 0);
});

t("no refund finding before the deadline", () => {
  const { findings } = buildFindings([E({ gmail_id: "a", kind: "refund_promised", merchant: "Tienda X", amount: 1, event_date: "2026-09-20", promised_business_days: 10 })], TODAY);
  assert.equal(findings.length, 0);
});

t("refund without stated deadline assumes 15 business days, medium confidence", () => {
  const { findings } = buildFindings([E({ gmail_id: "a", kind: "refund_promised", merchant: "Tienda X", amount: 5000, event_date: "2026-08-01" })], TODAY);
  assert.equal(findings[0].confidence, "medium");
});

t("duplicate charge within minutes", () => {
  const { findings } = buildFindings([
    E({ gmail_id: "c1", kind: "charge", merchant: "APP DOMICILIOS", amount: 62000, received_at: "2026-09-14T19:42:00.000Z" }),
    E({ gmail_id: "c2", kind: "charge", merchant: "App Domicilios", amount: 62000, received_at: "2026-09-14T19:45:00.000Z" }),
    E({ gmail_id: "c3", kind: "charge", merchant: "App Domicilios", amount: 62000, received_at: "2026-09-15T19:45:00.000Z" }),
  ], TODAY);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "duplicate_charge");
  assert.equal(findings[0].confidence, "high");
  assert.equal(findings[0].evidence.length, 2);
});

t("different amounts are not duplicates", () => {
  const { findings } = buildFindings([
    E({ gmail_id: "c1", kind: "charge", merchant: "Cafe", amount: 9000, received_at: "2026-09-14T19:42:00.000Z" }),
    E({ gmail_id: "c2", kind: "charge", merchant: "Cafe", amount: 12000, received_at: "2026-09-14T19:44:00.000Z" }),
  ], TODAY);
  assert.equal(findings.length, 0);
});

t("price increase and trial alerts", () => {
  const { findings } = buildFindings([
    E({ gmail_id: "p", kind: "price_increase", merchant: "Streaming", price_from: 38900, price_to: 44900, due_date: "2026-10-15" }),
    E({ gmail_id: "q", kind: "price_increase", merchant: "Old", price_from: 1, price_to: 2, due_date: "2026-06-01" }),
    E({ gmail_id: "r", kind: "trial_started", merchant: "Musica", amount: 16900, due_date: "2026-09-28" }),
    E({ gmail_id: "s", kind: "trial_started", merchant: "Pasada", amount: 16900, due_date: "2026-09-01" }),
  ], TODAY);
  assert.deepEqual(findings.map((f) => f.rule).sort(), ["price_increase", "trial_ending"]);
  assert.equal(findings.find((f) => f.rule === "price_increase")!.amount_monthly, 6000);
});

t("warranties from invoices", () => {
  const { warranties } = buildFindings([
    E({ gmail_id: "i", kind: "purchase_invoice", merchant: "Almacen", product: "Portátil 14", amount: 3899000, event_date: "2025-10-10" }),
    E({ gmail_id: "j", kind: "purchase_invoice", merchant: "Almacen", product: "Cable USB", amount: 25000, event_date: "2026-05-10" }),
    E({ gmail_id: "k", kind: "purchase_invoice", merchant: "Almacen", product: "Nevera", amount: 2450000, event_date: "2024-01-10" }),
  ], TODAY);
  assert.equal(warranties.length, 1);
  assert.equal(warranties[0].until, "2026-10-10");
});

t("DIAN AttachedDocument XML parsing", () => {
  const txt = invoiceFromXmlForTest();
  assert.match(txt, /Vendedor: ALMACENES EJEMPLO S\.A\.S/);
  assert.match(txt, /Total a pagar: 3899000\.00/);
  assert.match(txt, /PORTATIL 14 PULGADAS = 3276470\.59/);
});

console.log(`\n${passed} tests passed`);
