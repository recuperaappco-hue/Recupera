"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

type Stats = { checked: number; processed: number; relevant: number; findings: number; warranties: number; remaining: number };
const STEPS = ["Buscando facturas electrónicas", "Leyendo alertas del banco", "Revisando devoluciones y reembolsos", "Revisando suscripciones y tarifas", "Armando tu inventario de garantías"];

export default function Scan() {
  const [state, setState] = useState<"running" | "done" | "reconnect" | "error">("running");
  const [stats, setStats] = useState<Stats | null>(null);
  const [step, setStep] = useState(0);
  const started = useRef(false);

  async function run() {
    setState("running"); setStep(0);
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 6000);
    try {
      const r = await fetch("/api/scan", { method: "POST" });
      if (r.status === 409) return setState("reconnect");
      if (!r.ok) return setState("error");
      setStats(await r.json()); setStep(STEPS.length); setState("done");
    } catch { setState("error"); } finally { clearInterval(tick); }
  }
  useEffect(() => { if (!started.current) { started.current = true; run(); } }, []);

  return (
    <main>
      <div className={`scan ${state !== "running" ? "done" : ""}`}>
        <div className="radar"><Icon id="i-mail" /></div>
        <div style={{ textAlign: "center" }}>
          <h2 className="s-title">
            {state === "running" && "Revisando tu correo…"}
            {state === "done" && (stats!.findings + stats!.warranties > 0 ? `Encontramos ${stats!.findings + stats!.warranties} cosas` : "Revisión terminada")}
            {state === "reconnect" && "Necesitamos que vuelvas a conectar tu correo"}
            {state === "error" && "No pudimos terminar la revisión"}
          </h2>
          {state === "running" && <p className="s-sub" style={{ marginTop: 6 }}>Puede tardar uno o dos minutos. No cierres esta pantalla.</p>}
        </div>
        {stats && (
          <div className="counters num">
            <div><b>{stats.checked}</b><span>Correos revisados</span></div>
            <div><b>{stats.relevant}</b><span>Con datos útiles</span></div>
            <div><b>{stats.findings + stats.warranties}</b><span>Hallazgos</span></div>
          </div>
        )}
        <ul className="scanlog">
          {STEPS.map((t, i) => (
            <li key={t} className={i < step || state === "done" ? "ok" : ""}><i>{i < step || state === "done" ? "✓" : ""}</i>{t}</li>
          ))}
        </ul>
      </div>
      <div className="foot">
        {state === "done" && <Link className="btn btn-green btn-block" href="/app">Ver lo que encontramos</Link>}
        {state === "done" && stats!.remaining > 0 && <button className="btn btn-ghost btn-block" onClick={run}>Revisar {stats!.remaining} correos más</button>}
        {state === "reconnect" && <Link className="btn btn-green btn-block" href="/app/connect">Conectar de nuevo</Link>}
        {state === "error" && <button className="btn btn-green btn-block" onClick={run}>Intentar de nuevo</button>}
        {state === "running" && <button className="btn btn-green btn-block" disabled>Revisando…</button>}
      </div>
    </main>
  );
}
