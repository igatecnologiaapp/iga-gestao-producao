import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — FichaTec" }] }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";
  const items = [
    { to: "/alterar-senha", title: "Alterar senha", desc: "Atualize sua senha de acesso", icon: "🔑", show: true },
    { to: "/usuarios", title: "Usuários", desc: "Gerencie usuários e permissões", icon: "👥", show: isAdmin },
    { to: "/auditoria", title: "Auditoria", desc: "Histórico de acessos e ações", icon: "🛡️", show: isAdmin },
  ];
  return (
    <div className="min-h-screen bg-background pb-28">
      <PageHeader title="Configurações" backTo="/" />
      <div className="space-y-2 px-4 pt-4">
        {items.filter((i) => i.show).map((i) => (
          <Link key={i.to} to={i.to} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 active:scale-[0.99]">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-2xl">{i.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{i.title}</div>
              <div className="truncate text-xs text-muted-foreground">{i.desc}</div>
            </div>
            <span className="text-primary">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}