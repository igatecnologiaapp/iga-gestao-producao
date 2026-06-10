import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  db,
  useDB,
  UNITS,
  unitCost,
  formatBRL,
  type Material,
  type Unit,
} from "@/lib/store";

export const Route = createFileRoute("/materias-primas")({
  head: () => ({ meta: [{ title: "Matérias-primas — FichaTec" }] }),
  component: MateriasPrimasPage,
});

const emptyForm = {
  name: "",
  unit: "" as Unit | "",
  purchasePrice: "",
  purchaseQty: "",
  category: "",
  notes: "",
};

function MateriasPrimasPage() {
  const { materials } = useDB();
  const [editing, setEditing] = useState<Material | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }
  function openEdit(m: Material) {
    setEditing(m);
    setForm({
      name: m.name,
      unit: m.unit ?? "",
      purchasePrice: m.purchasePrice == null ? "" : String(m.purchasePrice).replace(".", ","),
      purchaseQty: m.purchaseQty == null ? "" : String(m.purchaseQty).replace(".", ","),
      category: m.category ?? "",
      notes: m.notes ?? "",
    });
    setError("");
    setOpen(true);
  }

  function parseNum(v: string) {
    return parseFloat(v.replace(",", "."));
  }

  function save() {
    const name = form.name.trim();
    if (!name) return setError("Informe o nome da matéria-prima.");
    const priceRaw = form.purchasePrice.trim();
    const qtyRaw = form.purchaseQty.trim();
    const price = priceRaw === "" ? null : parseNum(priceRaw);
    const qty = qtyRaw === "" ? null : parseNum(qtyRaw);
    if (price !== null && (!isFinite(price) || price < 0))
      return setError("Valor de compra inválido.");
    if (qty !== null && (!isFinite(qty) || qty < 0))
      return setError("Quantidade comprada inválida.");
    const unit: Unit | null = form.unit === "" ? null : (form.unit as Unit);
    const payload = {
      name,
      unit,
      purchasePrice: price,
      purchaseQty: qty,
      category: form.category.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) {
      db.updateMaterial(editing.id, payload);
    } else {
      db.addMaterial(payload);
    }
    setOpen(false);
  }

  function remove(m: Material) {
    if (confirm(`Excluir "${m.name}"? Será removida de todas as fichas técnicas.`)) {
      db.deleteMaterial(m.id);
    }
  }

  const previewUnit = (() => {
    if (!form.purchasePrice.trim() || !form.purchaseQty.trim()) return null;
    const price = parseNum(form.purchasePrice);
    const qty = parseNum(form.purchaseQty);
    if (!isFinite(price) || !isFinite(qty) || qty <= 0) return null;
    return price / qty;
  })();

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageHeader title="Matérias-primas" subtitle={`${materials.length} cadastradas`} />

      <div className="px-4 pt-4 space-y-2">
        {materials.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="text-3xl">🌾</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhuma matéria-prima cadastrada.<br />Toque em <b>+ Nova</b> para começar.
            </p>
          </div>
        )}

        {materials.map((m) => (
          <div key={m.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-foreground">{m.name}</div>
                <div className="text-xs text-muted-foreground">
                  {m.purchaseQty != null && m.unit
                    ? `${m.purchaseQty.toLocaleString("pt-BR")} ${m.unit}`
                    : "Quantidade não informada"}
                  {" · "}
                  {m.purchasePrice != null ? formatBRL(m.purchasePrice) : "Valor não informado"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Unitário</div>
                <div className="font-bold text-primary">
                  {m.purchasePrice != null && m.purchaseQty
                    ? formatBRL(unitCost(m))
                    : "—"}
                  {m.unit && (
                    <span className="text-xs text-muted-foreground font-normal"> /{m.unit}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => openEdit(m)} className="flex-1 rounded-lg border border-border bg-background py-2 text-sm font-medium active:scale-95">Editar</button>
              <button onClick={() => remove(m)} className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive active:scale-95">Excluir</button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={openNew}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg active:scale-95"
      >
        + Nova matéria-prima
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/40" onClick={() => setOpen(false)}>
          <div className="w-full rounded-t-3xl bg-card p-5 pb-8 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <h2 className="text-lg font-bold">{editing ? "Editar" : "Nova"} matéria-prima</h2>
            <div className="mt-4 space-y-3">
              <Field label="Nome">
                <input
                  className="input"
                  placeholder="Ex.: Farinha de trigo"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Unidade de medida">
                <select
                  className="input"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value as Unit })}
                >
                  <option value="">— Não informada —</option>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor de compra (R$) — opcional">
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="25,00"
                    value={form.purchasePrice}
                    onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                  />
                </Field>
                <Field label={`Quantidade${form.unit ? ` (${form.unit})` : ""} — opcional`}>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="5"
                    value={form.purchaseQty}
                    onChange={(e) => setForm({ ...form, purchaseQty: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Categoria — opcional">
                <input
                  className="input"
                  placeholder="Ex.: Secos, Laticínios"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </Field>
              <Field label="Observações — opcional">
                <textarea
                  className="input min-h-[72px]"
                  placeholder="Notas internas"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
              {previewUnit !== null && (
                <div className="rounded-xl bg-accent/40 p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo unitário</div>
                  <div className="text-lg font-bold text-primary">
                    {formatBRL(previewUnit)}{form.unit ? ` /${form.unit}` : ""}
                  </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}