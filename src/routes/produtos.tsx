import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  db,
  useDB,
  productCost,
  formatBRL,
  formatBRLOrEmpty,
  productStatus,
  missingProductFields,
  unitOptionsFor,
  type Product,
  type Unit,
} from "@/lib/store";

export const Route = createFileRoute("/produtos")({
  head: () => ({ meta: [{ title: "Produtos — FichaTec" }] }),
  component: ProdutosPage,
});

const emptyForm = {
  name: "",
  unit: "" as Unit | "",
  salePrice: "",
  category: "",
  description: "",
  internalCode: "",
  barcode: "",
  notes: "",
};

function ProdutosPage() {
  const { products, materials, units } = useDB();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      unit: (p.unit ?? "") as Unit | "",
      salePrice: p.salePrice == null ? "" : String(p.salePrice).replace(".", ","),
      category: p.category ?? "",
      description: p.description ?? "",
      internalCode: p.internalCode ?? "",
      barcode: p.barcode ?? "",
      notes: p.notes ?? "",
    });
    setError("");
    setOpen(true);
  }

  function save() {
    const name = form.name.trim();
    if (!name) return setError("Informe o nome do produto.");
    let price: number | null = null;
    if (form.salePrice.trim() !== "") {
      const p = parseFloat(form.salePrice.replace(",", "."));
      if (!isFinite(p) || p < 0) return setError("Valor de venda inválido.");
      price = p;
    }
    const unit: Unit | null = form.unit === "" ? null : (form.unit as Unit);
    const patch = {
      name,
      unit,
      salePrice: price,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      internalCode: form.internalCode.trim() || null,
      barcode: form.barcode.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      db.updateProduct(editing.id, patch);
    } else {
      db.addProduct(patch);
    }
    setOpen(false);
  }

  function remove(p: Product) {
    if (confirm(`Excluir "${p.name}"?`)) db.deleteProduct(p.id);
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageHeader title="Produtos" subtitle={`${products.length} cadastrados`} />

      <div className="px-4 pt-4 space-y-2">
        {products.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="text-3xl">🧁</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum produto cadastrado.<br />Toque em <b>+ Novo</b> para começar.
            </p>
          </div>
        )}

        {products.map((p) => {
          const cost = productCost(p, materials);
          const hasSale = p.salePrice != null && p.salePrice > 0;
          const profit = hasSale ? (p.salePrice as number) - cost : null;
          const margin = hasSale ? ((profit as number) / (p.salePrice as number)) * 100 : null;
          const status = productStatus(p);
          const missing = missingProductFields(p);
          return (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate font-semibold">{p.name}</div>
                    <StatusBadge status={status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.unit ? `por ${p.unit}` : "unidade não informada"} · {p.sheet.length} ingrediente(s)
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-muted-foreground">Venda</div>
                  <div className="font-bold">{formatBRLOrEmpty(p.salePrice)}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Mini label="Custo" value={formatBRL(cost)} />
                <Mini
                  label="Lucro"
                  value={profit == null ? "—" : formatBRL(profit)}
                  tone={profit == null ? undefined : profit >= 0 ? "good" : "bad"}
                />
                <Mini
                  label="Margem"
                  value={margin == null ? "—" : `${margin.toFixed(0)}%`}
                  tone={margin == null ? undefined : margin >= 0 ? "good" : "bad"}
                />
              </div>
              {missing.length > 0 && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Pendente: <span className="text-foreground/80">{missing.slice(0, 3).join(", ")}{missing.length > 3 ? "…" : ""}</span>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Link to="/ficha/$id" params={{ id: p.id }} className="flex-1 rounded-lg bg-primary py-2 text-center text-sm font-semibold text-primary-foreground active:scale-95">Ficha técnica</Link>
                <Link to="/produto/$id" params={{ id: p.id }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium active:scale-95">Detalhes</Link>
                <button onClick={() => openEdit(p)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium active:scale-95">✎</button>
                <button onClick={() => remove(p)} className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive active:scale-95">✕</button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={openNew}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg active:scale-95"
      >
        + Novo produto
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/40" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <h2 className="text-lg font-bold">{editing ? "Editar" : "Novo"} produto</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Apenas o nome é obrigatório. Você pode completar os demais dados depois.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Nome do produto *</span>
                <input className="input" placeholder="Ex.: Bolo Simples" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Unidade (opcional)</span>
                  <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as Unit })}>
                    <option value="">—</option>
                    {unitOptionsFor(units, form.unit || null).map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Valor de venda (opcional)</span>
                  <input className="input" inputMode="decimal" placeholder="0,00" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Categoria</span>
                  <input className="input" placeholder="Ex.: Bolos" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Código interno</span>
                  <input className="input" placeholder="SKU" value={form.internalCode} onChange={(e) => setForm({ ...form, internalCode: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Código de barras</span>
                <input className="input" placeholder="EAN/UPC" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</span>
                <textarea className="input min-h-20" placeholder="Detalhes do produto" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Observações</span>
                <textarea className="input min-h-16" placeholder="Anotações internas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
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

function Mini({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/60 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: "complete" | "partial" | "incomplete" }) {
  const map = {
    complete: { label: "Completo", cls: "bg-emerald-100 text-emerald-700" },
    partial: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
    incomplete: { label: "Incompleto", cls: "bg-destructive/10 text-destructive" },
  } as const;
  const it = map[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${it.cls}`}>{it.label}</span>;
}