import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useDB, productCost, formatBRL } from "@/lib/store";

export const Route = createFileRoute("/fichas")({
  head: () => ({ meta: [{ title: "Fichas técnicas — FichaTec" }] }),
  component: FichasIndex,
});

function FichasIndex() {
  const { products, materials } = useDB();
  return (
    <div className="min-h-screen bg-background pb-12">
      <PageHeader title="Fichas técnicas" subtitle="Escolha um produto" />
      <div className="px-4 pt-4 space-y-2">
        {products.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="text-3xl">📋</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre um produto antes de montar a ficha técnica.
            </p>
            <Link to="/produtos" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Cadastrar produto</Link>
          </div>
        )}
        {products.map((p) => {
          const cost = productCost(p, materials);
          return (
            <Link key={p.id} to="/ficha/$id" params={{ id: p.id }} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.99]">
              <div className="min-w-0">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.sheet.length} ingrediente(s) · custo {formatBRL(cost)}</div>
              </div>
              <span className="text-primary">›</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}