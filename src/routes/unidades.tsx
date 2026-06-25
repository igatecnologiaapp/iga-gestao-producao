import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
import { useDB, refreshDB, type UnitOfMeasure } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/unidades")({
  head: () => ({ meta: [{ title: "Unidades de Medida — FichaTec" }] }),
  component: UnidadesPage,
});

interface FormState {
  name: string;
  abbreviation: string;
  description: string;
  active: boolean;
  displayOrder: string;
}

const emptyForm: FormState = {
  name: "",
  abbreviation: "",
  description: "",
  active: true,
  displayOrder: "100",
};

async function logUnitAudit(
  event: "UNIT_CREATE" | "UNIT_UPDATE" | "UNIT_DEACTIVATE" | "UNIT_DELETE",
  username: string,
  userId: string,
  detail: string,
) {
  try {
    await supabase.from("audit_log").insert({
      event,
      username,
      user_id: userId,
      device:
        typeof navigator !== "undefined" &&
        /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)
          ? "Mobile"
          : "Desktop",
      detail,
    });
  } catch {
    // best effort
  }
}

function UnidadesPage() {
  const { session } = useAuth();
  const { units, materials, products } = useDB();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UnitOfMeasure | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const usageMap = useMemo(() => {
    const map = new Map<string, number>();
    function inc(abbr: string | null | undefined) {
      if (!abbr) return;
      const k = abbr.toLowerCase();
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    materials.forEach((m) => inc(m.unit));
    products.forEach((p) => inc(p.unit));
    return map;
  }, [materials, products]);

  function usageCount(u: UnitOfMeasure) {
    return usageMap.get(u.abbreviation.toLowerCase()) ?? 0;
  }

  if (!session || session.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Unidades de Medida" backTo="/configuracoes" />
        <div className="p-6 text-center text-sm text-muted-foreground">
          Acesso restrito a administradores.
        </div>
      </div>
    );
  }

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm, displayOrder: String((units.at(-1)?.displayOrder ?? 100) + 10) });
    setError("");
    setOpen(true);
  }

  function openEdit(u: UnitOfMeasure) {
    setEditing(u);
    setForm({
      name: u.name,
      abbreviation: u.abbreviation,
      description: u.description ?? "",
      active: u.active,
      displayOrder: String(u.displayOrder),
    });
    setError("");
    setOpen(true);
  }

  async function save() {
    const name = form.name.trim();
    const abbr = form.abbreviation.trim();
    if (!name) return setError("Informe o nome da unidade.");
    if (!abbr) return setError("Informe a sigla.");
    const order = parseInt(form.displayOrder, 10);
    if (!isFinite(order)) return setError("Ordem inválida.");
    // Conflict check (case-insensitive)
    const conflict = units.find(
      (u) =>
        u.abbreviation.toLowerCase() === abbr.toLowerCase() &&
        u.id !== editing?.id,
    );
    if (conflict) return setError("Já existe uma unidade com essa sigla.");

    setBusy(true);
    try {
      if (editing) {
        const wasActive = editing.active;
        const { error: upErr } = await supabase
          .from("units_of_measure")
          .update({
            name,
            abbreviation: abbr,
            description: form.description.trim() || null,
            active: form.active,
            display_order: order,
          })
          .eq("id", editing.id);
        if (upErr) throw upErr;
        await logUnitAudit(
          "UNIT_UPDATE",
          session!.username,
          session!.userId,
          `${editing.abbreviation} → ${abbr} (${name})`,
        );
        if (wasActive && !form.active) {
          await logUnitAudit(
            "UNIT_DEACTIVATE",
            session!.username,
            session!.userId,
            `${abbr} inativada`,
          );
        }
      } else {
        const { error: insErr } = await supabase.from("units_of_measure").insert({
          name,
          abbreviation: abbr,
          description: form.description.trim() || null,
          active: form.active,
          display_order: order,
          created_by: session!.userId,
        });
        if (insErr) throw insErr;
        await logUnitAudit(
          "UNIT_CREATE",
          session!.username,
          session!.userId,
          `${abbr} — ${name}`,
        );
      }
      setOpen(false);
      refreshDB();
    } catch (err: any) {
      setError(err?.message ?? "Erro ao salvar unidade.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(u: UnitOfMeasure) {
    const uses = usageCount(u);
    if (uses > 0) {
      alert("Esta unidade de medida está sendo utilizada e não pode ser excluída.");
      return;
    }
    if (!confirm(`Excluir a unidade "${u.abbreviation}"?`)) return;
    const { error: delErr } = await supabase
      .from("units_of_measure")
      .delete()
      .eq("id", u.id);
    if (delErr) {
      alert(delErr.message);
      return;
    }
    await logUnitAudit(
      "UNIT_DELETE",
      session!.username,
      session!.userId,
      `${u.abbreviation} — ${u.name}`,
    );
    refreshDB();
  }

  async function toggleActive(u: UnitOfMeasure) {
    const next = !u.active;
    const { error: upErr } = await supabase
      .from("units_of_measure")
      .update({ active: next })
      .eq("id", u.id);
    if (upErr) {
      alert(upErr.message);
      return;
    }
    await logUnitAudit(
      next ? "UNIT_UPDATE" : "UNIT_DEACTIVATE",
      session!.username,
      session!.userId,
      `${u.abbreviation} ${next ? "reativada" : "inativada"}`,
    );
    refreshDB();
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageHeader
        title="Unidades de Medida"
        subtitle={`${units.length} cadastrada(s)`}
        backTo="/configuracoes"
      />

      <div className="px-4 pt-4 space-y-2">
        {units.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma unidade cadastrada.
          </div>
        )}
        {units.map((u) => {
          const uses = usageCount(u);
          return (
            <div key={u.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {u.abbreviation}
                    </span>
                    <span className="truncate font-semibold">{u.name}</span>
                    {!u.active && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        Inativa
                      </span>
                    )}
                  </div>
                  {u.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{u.description}</div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Ordem {u.displayOrder} ·{" "}
                    {uses > 0 ? (
                      <span className="text-foreground/80">
                        em uso ({uses} {uses === 1 ? "registro" : "registros"})
                      </span>
                    ) : (
                      "não utilizada"
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => openEdit(u)}
                  className="flex-1 rounded-lg border border-border bg-background py-2 text-sm font-medium active:scale-95"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleActive(u)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium active:scale-95"
                >
                  {u.active ? "Inativar" : "Reativar"}
                </button>
                <button
                  onClick={() => remove(u)}
                  disabled={uses > 0}
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive active:scale-95 disabled:opacity-40"
                  title={uses > 0 ? "Unidade em uso não pode ser excluída" : "Excluir"}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={openNew}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg active:scale-95"
      >
        + Nova unidade
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/40" onClick={() => setOpen(false)}>
          <div
            className="w-full max-h-[92vh] overflow-y-auto rounded-t-3xl bg-card p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <h2 className="text-lg font-bold">
              {editing ? "Editar unidade" : "Nova unidade"}
            </h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Nome</span>
                <input
                  className="input"
                  placeholder="Ex.: Quilograma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Sigla</span>
                  <input
                    className="input"
                    placeholder="Ex.: kg"
                    value={form.abbreviation}
                    onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Ordem de exibição</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={form.displayOrder}
                    onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</span>
                <textarea
                  className="input min-h-[72px]"
                  placeholder="Descrição opcional"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span className="text-sm">
                  Ativa (disponível para novos cadastros)
                </span>
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-border py-3 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={save}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-60"
                >
                  {busy ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}