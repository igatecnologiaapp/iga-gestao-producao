import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { db, useDB, UNITS, productCost, formatBRL, type Product, type Unit } from "@/lib/store";

export const Route = createFileRoute("/produtos")({
  head: () => ({ meta: [{ title: "Produtos — FichaTec" }] }),
  component: ProdutosPage,
});

const emptyForm = { name: "", unit: "unidade" as Unit, salePrice: "" };

function ProdutosPage() {
  const { products, materials } = useDB();
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
    setForm({ name: p.name, unit: p.unit, salePrice: String(p.salePrice).replace(".", ",") });
    setError("");
    setOpen(true);
  }

  function save() {
    const name = form.name.trim();
    const price = parseFloat(form.salePrice.replace(",", "."));
    if (!name) return setError("Informe o nome do produto.");
    if (!isFinite(price) || price < 0) return setError("Valor de venda inválido.");
    if (editing) {
      db.updateProduct(editing.id, { name, unit: form.unit, salePrice: price });
    } else {
      db.addProduct({ name, unit: form.unit, salePrice: price });
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
          const profit = p.salePrice - cost;
          const margin = p.salePrice > 0 ? (profit / p.salePrice) * 100 : 0;
          return (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">por {p.unit} · {p.sheet.length} ingrediente(s)</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-muted-foreground">Venda</div>
                  <div className="font-bold">{formatBRL(p.salePrice)}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Mini label="Custo" value={formatBRL(cost)} />
                <Mini label="Lucro" value={formatBRL(profit)} tone={profit >= 0 ? "good" : "bad"} />
                <Mini label="Margem" value={`${margin.toFixed(0)}%`} tone={margin >= 0 ? "good" : "bad"} />
              </div>
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
          <div className="w-full rounded-t-3xl bg-card p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <h2 className="text-lg font-bold">{editing ? "Editar" : "Novo"} produto</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Nome do produto</span>
                <input className="input" placeholder="Ex.: Bolo Simples" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Unidade</span>
                  <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as Unit })}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Valor de venda (R$)</span>
                  <input className="input" inputMode="decimal" placeholder="0,00" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} />
                </label>
              </div>
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