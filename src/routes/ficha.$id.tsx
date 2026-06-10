import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  db,
  useDB,
  unitCost,
  productCost,
  formatBRL,
  formatQty,
  type SheetItem,
} from "@/lib/store";

export const Route = createFileRoute("/ficha/$id")({
  head: () => ({ meta: [{ title: "Ficha técnica — FichaTec" }] }),
  component: FichaPage,
});

function FichaPage() {
  const { id } = Route.useParams();
  const { products, materials } = useDB();
  const product = products.find((p) => p.id === id);

  const [editing, setEditing] = useState<SheetItem | null>(null);
  const [open, setOpen] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Ficha técnica" />
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">Produto não encontrado.</p>
          <Link to="/produtos" className="mt-4 inline-block text-primary font-medium">Voltar para produtos</Link>
        </div>
      </div>
    );
  }

  const cost = productCost(product, materials);
  const hasSale = product.salePrice != null && product.salePrice > 0;
  const sale = product.salePrice ?? 0;
  const profit = hasSale ? sale - cost : null;
  const margin = hasSale ? ((sale - cost) / sale) * 100 : null;
  const costPct = hasSale ? (cost / sale) * 100 : null;

  function openNew() {
    if (materials.length === 0) {
      alert("Cadastre uma matéria-prima antes.");
      return;
    }
    setEditing(null);
    setMaterialId(materials[0].id);
    setQty("");
    setError("");
    setOpen(true);
  }
  function openEdit(item: SheetItem) {
    setEditing(item);
    setMaterialId(item.materialId);
    setQty(String(item.quantity).replace(".", ","));
    setError("");
    setOpen(true);
  }
  function save() {
    const q = parseFloat(qty.replace(",", "."));
    if (!materialId) return setError("Selecione uma matéria-prima.");
    if (!isFinite(q) || q <= 0) return setError("Quantidade deve ser maior que zero.");
    if (editing) {
      db.updateSheetItem(product!.id, editing.id, { materialId, quantity: q });
    } else {
      db.addSheetItem(product!.id, { materialId, quantity: q });
    }
    setOpen(false);
  }
  function remove(item: SheetItem) {
    if (confirm("Remover este item da ficha?")) db.removeSheetItem(product!.id, item.id);
  }

  const selectedMaterial = materials.find((m) => m.id === materialId);
  const previewCost =
    selectedMaterial && isFinite(parseFloat(qty.replace(",", ".")))
      ? unitCost(selectedMaterial) * parseFloat(qty.replace(",", "."))
      : null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageHeader title={product.name} subtitle={`Ficha técnica${product.unit ? ` · por ${product.unit}` : ""}`} backTo="/produtos" />

      <section className="mx-4 mt-4 rounded-2xl bg-card border border-border p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <Block label="Custo total" value={formatBRL(cost)} accent />
          <Block label="Valor de venda" value={hasSale ? formatBRL(sale) : "Não informado"} />
          <Block
            label="Lucro bruto"
            value={profit == null ? "—" : formatBRL(profit)}
            tone={profit == null ? undefined : profit >= 0 ? "good" : "bad"}
          />
          <Block
            label="Margem bruta"
            value={margin == null ? "—" : `${margin.toFixed(1)}%`}
            tone={margin == null ? undefined : margin >= 0 ? "good" : "bad"}
          />
        </div>
        <div className="mt-3 text-center text-xs text-muted-foreground">
          {hasSale ? (
            <>Custo sobre venda: <b className="text-foreground">{(costPct as number).toFixed(1)}%</b></>
          ) : (
            <>Valor de venda não informado.</>
          )}
        </div>
      </section>

      <div className="mt-5 px-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ingredientes ({product.sheet.length})
        </h2>
        {product.sheet.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum item adicionado. Toque em <b>+ Adicionar</b>.
          </div>
        )}
        <div className="space-y-2">
          {product.sheet.map((item) => {
            const m = materials.find((x) => x.id === item.materialId);
            if (!m) return null;
            const itemCost = unitCost(m) * item.quantity;
            return (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{m.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatQty(item.quantity)} {m.unit ?? "un"} × {formatBRL(unitCost(m))}/{m.unit ?? "un"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-muted-foreground">Custo</div>
                    <div className="font-bold text-primary">{formatBRL(itemCost)}</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => openEdit(item)} className="flex-1 rounded-lg border border-border bg-background py-2 text-sm font-medium active:scale-95">Editar</button>
                  <button onClick={() => remove(item)} className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive active:scale-95">Remover</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={openNew} className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg active:scale-95">
        + Adicionar matéria-prima
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/40" onClick={() => setOpen(false)}>
          <div className="w-full rounded-t-3xl bg-card p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <h2 className="text-lg font-bold">{editing ? "Editar" : "Adicionar"} item</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Matéria-prima</span>
                <select className="input" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({formatBRL(unitCost(m))}/{m.unit ?? "un"})</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Quantidade utilizada {selectedMaterial && `(${selectedMaterial.unit})`}
                </span>
                <input className="input" inputMode="decimal" placeholder="0,300" value={qty} onChange={(e) => setQty(e.target.value)} />
              </label>
              {previewCost !== null && (
                <div className="rounded-xl bg-accent/40 p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo na ficha</div>
                  <div className="text-lg font-bold text-primary">{formatBRL(previewCost)}</div>
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium">Cancelar</button>
                <button onClick={save} className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-95">Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Block({
  label,
  value,
  tone,
  accent,
}: { label: string; value: string; tone?: "good" | "bad"; accent?: boolean }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-destructive" : accent ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}