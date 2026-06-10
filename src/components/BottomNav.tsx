import { Link, useRouterState } from "@tanstack/react-router";

const items = [
  { to: "/", label: "Home", icon: "🏠", match: (p: string) => p === "/" },
  { to: "/produtos", label: "Produtos", icon: "📦", match: (p: string) => p.startsWith("/produto") },
  { to: "/fichas", label: "Fichas", icon: "📋", match: (p: string) => p.startsWith("/ficha") },
  { to: "/relatorios", label: "Relatórios", icon: "📊", match: (p: string) => p.startsWith("/relatorios") },
  { to: "/configuracoes", label: "Config.", icon: "⚙️", match: (p: string) => p.startsWith("/configuracoes") || p.startsWith("/usuarios") || p.startsWith("/auditoria") || p.startsWith("/alterar-senha") },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Navegação principal"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = it.match(pathname);
          return (
            <li key={it.to}>
              <Link
                to={it.to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="text-lg leading-none">{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}