import Link from "next/link";
import { Icon } from "./Icon";
import { cop, daysBetween, todayISO } from "@/lib/dates";

export type FindingRow = {
  id: string; rule: string; grp: string; title: string; merchant: string | null; amount: number | null;
  amount_monthly: number | null; price_from: number | null; price_to: number | null; due_date: string | null;
  confidence: string | null; summary: string | null; status: string; remind: boolean;
};
export type WarrantyRow = { id: string; item: string; store: string | null; price: number | null; bought_on: string; until: string };

export const STATUS: Record<string, [string, string]> = {
  authorized: ["Por enviar", "chip-gray"], sent: ["Enviado", "chip-amber"], response: ["Respuesta recibida", "chip-green"], closed: ["Cerrado", "chip-green"],
};

export const RULE_ICON: Record<string, string> = {
  refund_pending: "i-refund", duplicate_charge: "i-dup", flight_cancelled: "i-plane", order_not_delivered: "i-box",
  price_increase: "i-trend", trial_ending: "i-clock", warranty: "i-shield",
};

export function FindingItem({ f }: { f: FindingRow }) {
  let v: React.ReactNode;
  if (f.grp === "money") {
    v = <><b className="num">{f.amount ? cop(f.amount) : "Por confirmar"}</b>
      {f.status === "claimed" ? <span className="chip chip-amber">Reclamo en curso</span>
        : <span className={`chip ${f.confidence === "high" ? "chip-green" : "chip-amber"}`}>{f.confidence === "high" ? "Alta" : "Media"}</span>}</>;
  } else if (f.rule === "trial_ending") {
    const d = f.due_date ? daysBetween(todayISO(), f.due_date) : null;
    v = <><b className="num">{d != null ? `${d} días` : ""}</b>{f.remind ? <span className="chip chip-green">Recordatorio</span> : <span className="chip chip-red">Pronto</span>}</>;
  } else {
    v = <><b className="num">{f.amount_monthly ? `+${cop(f.amount_monthly)}/mes` : "Sube"}</b>
      {f.status === "claimed" ? <span className="chip chip-amber">Solicitud enviada</span> : f.price_from && f.price_to ? <span className="chip chip-amber">+{((f.price_to / f.price_from - 1) * 100).toFixed(1).replace(".", ",")}%</span> : null}</>;
  }
  return (
    <Link className="find" href={`/app/f/${f.id}`}>
      <span className={`ic ${f.grp === "money" ? "g" : "a"}`}><Icon id={RULE_ICON[f.rule] ?? "i-spark"} /></span>
      <span className="t"><b>{f.title}</b><small>{f.merchant ?? "Comercio por confirmar"}</small><small>{f.summary}</small></span>
      <span className="v">{v}</span>
    </Link>
  );
}

export function WarrantyItem({ w }: { w: WarrantyRow }) {
  const d = daysBetween(todayISO(), w.until);
  const total = Math.max(1, daysBetween(w.bought_on, w.until));
  const pct = Math.max(0, Math.min(100, (d / total) * 100));
  const warn = d <= 30;
  return (
    <Link className="find" href={`/app/warranties/${w.id}`}>
      <span className={`ic ${warn ? "r" : "g"}`}><Icon id="i-shield" /></span>
      <span className="t"><b>{w.item}</b><small>{w.store ?? ""}{w.price ? ` · ${cop(w.price)}` : ""}</small>
        <span className={`wbar ${warn ? "warn" : ""}`} style={{ display: "block" }}><i style={{ width: `${pct}%` }} /></span></span>
      <span className="v"><b className="num">{d} días</b><span className={`chip ${warn ? "chip-red" : "chip-gray"}`}>{warn ? "Vence pronto" : "Vigente"}</span></span>
    </Link>
  );
}
