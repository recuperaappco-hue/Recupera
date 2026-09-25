import Link from "next/link";
import { Icon } from "./Icon";

export function TopBar({ title, back }: { title: string; back?: string }) {
  return (
    <div className="topbar">
      {back ? (
        <Link className="iconbtn" href={back} aria-label="Atrás"><Icon id="i-back" /></Link>
      ) : (
        <span className="spacer" />
      )}
      <h2>{title}</h2>
      <span className="spacer" />
    </div>
  );
}
