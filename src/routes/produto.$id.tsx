import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useDB, unitCost, productCost, formatBRL, formatQty } from "@/lib/store";

export const Route = createFileRoute("/produto/$id")({
  head: () => ({ meta: [{ title: "Detalhes do produto — FichaTec" }] }),
  component: ProdutoDetalhe,
});

function ProdutoDetalhe() {
  const { id } = Route.useParams();
  const { products, materials } = useDB();
  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Produto" />
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">Produto não encontrado.</div>
      </div>
    );
  }

  const cost = productCost(product, materials);
  const profit = product.salePrice - cost;
  const margin = product.salePrice > 0 ? (profit / product.salePrice) * 100 : 0;
  const costPct = product.salePrice > 0 ? (cost / product.salePrice) * 100 : 0;

  return (
    <div className="min-h-screen bg-background pb-12">
      <PageHeader title={product.name} subtitle={`por ${product.unit}`} backTo="/produtos" />

      <section className="mx-4 mt-4 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/30 p-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Custo total real</div>
        <div className="mt-1 text-3xl font-bold text-primary">{formatBRL(cost)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Venda {formatBRL(product.salePrice)} · Lucro {formatBRL(profit)}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="Margem" value={`${margin.toFixed(1)}%`} />
          <Mini label="Custo/Venda" value={`${costPct.toFixed(1)}%`} />
          <Mini label="Itens" value={product.sheet.length} />
        </div>
      </section>

      <div className="mt-6 px-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Composição</h2>
          <Link to="/ficha/$id" params={{ id: product.id }} className="text-xs font-semibold text-primary">Editar ficha →</Link>
        </div>
        {product.sheet.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum item na ficha técnica.
          </div>
        )}
        <div className="space-y-2">
          {product.sheet.map((item) => {
            const m = materials.find((x) => x.id === item.materialId);
            if (!m) return null;
            const itemCost = unitCost(m) * item.quantity;
            const share = cost > 0 ? (itemCost / cost) * 100 : 0;
            return (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{formatQty(item.quantity)} {m.unit}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold text-primary">{formatBRL(itemCost)}</div>
                    <div className="text-[10px] text-muted-foreground">{share.toFixed(0)}% do custo</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${share}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-card/70 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}