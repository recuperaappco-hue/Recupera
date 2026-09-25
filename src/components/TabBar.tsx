"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

const TABS = [
  { href: "/app", label: "Hallazgos", icon: "i-spark" },
  { href: "/app/warranties", label: "Garantías", icon: "i-shield" },
  { href: "/app/cases", label: "Casos", icon: "i-folder" },
  { href: "/app/profile", label: "Perfil", icon: "i-user" },
];

export function TabBar({ badge }: { badge?: number }) {
  const path = usePathname();
  return (
    <nav className="tabbar four" aria-label="Navegación">
      {TABS.map((t) => {
        const on = t.href === "/app" ? path === "/app" || path.startsWith("/app/f/") : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={on ? "on" : ""}>
            <Icon id={t.icon} />
            {t.label}
            {t.href === "/app" && badge ? <span className="badge">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
