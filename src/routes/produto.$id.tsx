import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import {
  useDB,
  unitCost,
  productCost,
  formatBRL,
  formatBRLOrEmpty,
  formatQty,
  missingProductFields,
  productStatus,
} from "@/lib/store";
import { exportProductSheet } from "@/lib/pdf-reports";

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
  const hasSale = product.salePrice != null && product.salePrice > 0;
  const sale = product.salePrice ?? 0;
  const profit = hasSale ? sale - cost : null;
  const margin = hasSale ? ((sale - cost) / sale) * 100 : null;
  const costPct = hasSale ? (cost / sale) * 100 : null;
  const missing = missingProductFields(product);
  const status = productStatus(product);

  return (
    <div className="min-h-screen bg-background pb-12">
      <PageHeader title={product.name} subtitle={product.unit ? `por ${product.unit}` : "unidade não informada"} backTo="/produtos" />

      <div className="px-4 pt-3">
        <button
          onClick={() => exportProductSheet(product, materials)}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm active:scale-95"
        >
          📄 Exportar Ficha Técnica (PDF)
        </button>
      </div>

      {missing.length > 0 && (
        <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="font-semibold">
            {status === "incomplete" ? "Cadastro incompleto" : "Cadastro pendente"}
          </div>
          <p className="mt-0.5">
            Este produto possui informações pendentes de preenchimento. Você pode completar os dados a qualquer momento.
          </p>
          <p className="mt-1 text-amber-800/80">
            Pendente: {missing.join(", ")}
          </p>
        </div>
      )}

      <section className="mx-4 mt-4 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-accent/30 p-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Custo total real</div>
        <div className="mt-1 text-3xl font-bold text-primary">{formatBRL(cost)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {hasSale ? (
            <>Venda {formatBRL(sale)} · Lucro {formatBRL(profit as number)}</>
          ) : (
            <>Valor de venda não informado.</>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Mini label="Margem" value={margin == null ? "—" : `${margin.toFixed(1)}%`} />
          <Mini label="Custo/Venda" value={costPct == null ? "—" : `${costPct.toFixed(1)}%`} />
          <Mini label="Itens" value={product.sheet.length} />
        </div>
        {!hasSale && (
          <div className="mt-3 text-center text-[11px] text-muted-foreground">
            Defina um valor de venda para calcular margem e lucro.
          </div>
        )}
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
                    <div className="text-xs text-muted-foreground">{formatQty(item.quantity)} {m.unit ?? "un"}</div>
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