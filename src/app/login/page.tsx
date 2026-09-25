import Link from "next/link";
import { GoogleButton } from "./GoogleButton";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="center">
      <div className="card">
        <Link className="logo" href="/">Recupera</Link>
        <h1 className="s-title">Entra a Recupera</h1>
        <p className="s-sub">Usa tu cuenta de Google. Después te pedimos permiso, aparte, para revisar tus correos de compras.</p>
        {sp.error ? <p className="err">No pudimos iniciar sesión. Intenta de nuevo.</p> : null}
        <GoogleButton />
        <p className="hint">Al continuar aceptas los <Link href="/privacidad">términos y la política de privacidad</Link>. Piloto privado: solo pueden entrar personas invitadas.</p>
      </div>
    </div>
  );
}
