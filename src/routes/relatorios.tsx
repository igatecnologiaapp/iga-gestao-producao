import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useDB, productCost, formatBRL } from "@/lib/store";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — FichaTec" }] }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const { products, materials } = useDB();

  const rows = products.map((p) => {
    const cost = productCost(p, materials);
    const profit = p.salePrice - cost;
    const margin = p.salePrice > 0 ? (profit / p.salePrice) * 100 : 0;
    const costPct = p.salePrice > 0 ? (cost / p.salePrice) * 100 : 0;
    return { p, cost, profit, margin, costPct };
  });

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalSale = rows.reduce((s, r) => s + r.p.salePrice, 0);
  const totalProfit = totalSale - totalCost;
  const avgMargin = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;

  return (
    <div className="min-h-screen bg-background pb-12">
      <PageHeader title="Relatórios" subtitle="Custo, lucro e margem" />

      <section className="mx-4 mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <Block label="Custo total" value={formatBRL(totalCost)} />
          <Block label="Venda total" value={formatBRL(totalSale)} />
          <Block label="Lucro bruto" value={formatBRL(totalProfit)} tone={totalProfit >= 0 ? "good" : "bad"} />
          <Block label="Margem média" value={`${avgMargin.toFixed(1)}%`} tone={avgMargin >= 0 ? "good" : "bad"} />
        </div>
      </section>

      <div className="mt-5 px-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Por produto</h2>
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="text-3xl">📊</div>
            <p className="mt-2 text-sm text-muted-foreground">Nenhum produto cadastrado ainda.</p>
          </div>
        )}
        <div className="space-y-2">
          {rows.map(({ p, cost, profit, margin, costPct }) => (
            <Link key={p.id} to="/produto/$id" params={{ id: p.id }} className="block rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.99]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">Custo {formatBRL(cost)} · Venda {formatBRL(p.salePrice)}</div>
                </div>
                <div className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${margin >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
                  {margin.toFixed(0)}%
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Mini label="Lucro" value={formatBRL(profit)} tone={profit >= 0 ? "good" : "bad"} />
                <Mini label="Margem" value={`${margin.toFixed(1)}%`} />
                <Mini label="Custo/Venda" value={`${costPct.toFixed(1)}%`} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Block({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
function Mini({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/50 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}