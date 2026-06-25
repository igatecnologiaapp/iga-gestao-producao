import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useDB, productCost, formatBRL, formatBRLOrEmpty } from "@/lib/store";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FichaTec — Custo real de produção" },
      { name: "description", content: "Cadastre matérias-primas, monte fichas técnicas e calcule o custo real de cada produto." },
    ],
  }),
  component: Index,
});

function Index() {
  const { materials, products } = useDB();
  const { session } = useAuth();
  const totalProducts = products.length;
  const totalMaterials = materials.length;
  const avgMargin =
    products.length === 0
      ? 0
      : products.reduce((acc, p) => {
          const cost = productCost(p, materials);
          if (!p.salePrice) return acc;
          return acc + ((p.salePrice - cost) / p.salePrice) * 100;
        }, 0) / products.length;

  const cards: { to: string; title: string; desc: string; emoji: string }[] = [
    { to: "/materias-primas", title: "Matérias-primas", desc: "Cadastre e calcule o custo unitário", emoji: "🌾" },
    { to: "/produtos", title: "Produtos", desc: "Cadastre seus produtos finais", emoji: "🧁" },
    { to: "/fichas", title: "Ficha técnica", desc: "Monte a receita de cada produto", emoji: "📋" },
    { to: "/relatorios", title: "Relatórios", desc: "Custos, lucro e margem por produto", emoji: "📊" },
  ];

  const adminCards: { to: string; title: string; desc: string; emoji: string }[] = [
    { to: "/backup", title: "Backup e Segurança", desc: "Criar, restaurar e baixar backups", emoji: "💾" },
    { to: "/unidades", title: "Unidades de Medida", desc: "kg, g, ml, un e personalizadas", emoji: "📏" },
    { to: "/usuarios", title: "Usuários e Permissões", desc: "Gerencie acessos do sistema", emoji: "👥" },
    { to: "/auditoria", title: "Auditoria", desc: "Histórico de acessos e ações", emoji: "🛡️" },
    { to: "/configuracoes", title: "Configurações", desc: "Preferências e atalhos do sistema", emoji: "⚙️" },
  ];
  const isAdmin = session?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">FichaTec</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-foreground">Ficha Técnica<br/>dos Produtos</h1>
            {session && (
              <p className="mt-1.5 text-sm text-muted-foreground">Olá, <b>{session.fullName}</b>.</p>
            )}
          </div>
          <UserMenu />
        </div>
      </header>

      <section className="mx-5 grid grid-cols-3 gap-3 rounded-2xl bg-card p-4 shadow-sm border border-border">
        <Stat label="Produtos" value={totalProducts} />
        <Stat label="Matérias" value={totalMaterials} />
        <Stat label="Margem méd." value={`${avgMargin.toFixed(0)}%`} />
      </section>

      <section className="mt-6 px-5 pb-24">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acesso rápido</h2>
        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition active:scale-[0.98] hover:border-primary/40"
            >
              <div className="text-3xl">{c.emoji}</div>
              <div className="mt-3 text-sm font-semibold text-foreground">{c.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground leading-snug">{c.desc}</div>
            </Link>
          ))}
        </div>

        {isAdmin && (
          <>
            <div className="mt-8 mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">🛠 Administração</h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">Admin</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {adminCards.map((c) => (
                <Link
                  key={c.to}
                  to={c.to}
                  className="group rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm transition active:scale-[0.98] hover:border-primary/60"
                >
                  <div className="text-3xl">{c.emoji}</div>
                  <div className="mt-3 text-sm font-semibold text-foreground">{c.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground leading-snug">{c.desc}</div>
                </Link>
              ))}
            </div>
          </>
        )}

        {products.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Últimos produtos</h2>
            <div className="space-y-2">
              {products.slice(-3).reverse().map((p) => {
                const cost = productCost(p, materials);
                return (
                  <Link
                    key={p.id}
                    to="/produto/$id"
                    params={{ id: p.id }}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{p.name}</div>
                      <div className="text-xs text-muted-foreground">Custo {formatBRL(cost)} · Venda {formatBRLOrEmpty(p.salePrice)}</div>
                    </div>
                    <span className="text-primary text-sm">›</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
