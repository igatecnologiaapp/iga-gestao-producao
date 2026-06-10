import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { UserMenu } from "@/components/UserMenu";

export function PageHeader({
  title,
  subtitle,
  action,
  backTo = "/",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  backTo?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link
          to={backTo}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground active:scale-95"
          aria-label="Voltar"
        >
          ‹
        </Link>
        <Link
          to="/"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground active:scale-95"
          aria-label="Página inicial"
          title="Página inicial"
        >
          🏠
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight text-foreground">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
        <UserMenu />
      </div>
    </header>
  );
}