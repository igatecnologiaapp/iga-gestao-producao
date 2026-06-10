import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { auth, useAuth, type Role, type User } from "@/lib/auth";

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Usuários — FichaTec" }] }),
  component: UsuariosPage,
});

const emptyForm = { fullName: "", username: "", password: "", password2: "", role: "user" as Role };

function UsuariosPage() {
  const { users, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  if (!session || session.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Usuários" backTo="/" />
        <div className="p-6 text-center text-sm text-muted-foreground">
          Acesso restrito a administradores.
        </div>
      </div>
    );
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }
  function openEdit(u: User) {
    setEditing(u);
    setForm({ fullName: u.fullName, username: u.username, password: "", password2: "", role: u.role });
    setError("");
    setOpen(true);
  }

  async function save() {
    setError("");
    if (!form.fullName.trim() || !form.username.trim()) return setError("Preencha todos os campos obrigatórios.");
    if (!editing) {
      if (!form.password) return setError("Informe uma senha.");
      if (form.password !== form.password2) return setError("As senhas não conferem.");
      const r = await auth.createUser({ fullName: form.fullName, username: form.username, password: form.password, role: form.role });
      if (!r.ok) return setError(r.error ?? "Erro");
    } else {
      if (form.password && form.password !== form.password2) return setError("As senhas não conferem.");
      await auth.updateUser(editing.id, {
        fullName: form.fullName.trim(),
        role: form.role,
        newPassword: form.password || undefined,
      });
    }
    setOpen(false);
  }

  const filtered = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageHeader title="Usuários" subtitle={`${users.length} cadastrado(s)`} backTo="/configuracoes" />

      <div className="space-y-2 px-4 pt-4">
        <input className="input" placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        {filtered.map((u) => (
          <div key={u.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate font-semibold">{u.fullName}</div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.role === "admin" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {u.role === "admin" ? "Administrador" : "Usuário"}
                  </span>
                  {!u.active && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Inativo</span>}
                </div>
                <div className="text-xs text-muted-foreground">@{u.username}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(u)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium">Editar</button>
                {u.id !== session.userId && (
                  <button
                    onClick={() => auth.toggleActive(u.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${u.active ? "border border-destructive/30 bg-destructive/10 text-destructive" : "border border-emerald-300 bg-emerald-50 text-emerald-700"}`}
                  >
                    {u.active ? "Desativar" : "Ativar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={openNew}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg active:scale-95 md:bottom-6"
      >
        + Novo usuário
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-foreground/40" onClick={() => setOpen(false)}>
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <h2 className="text-lg font-bold">{editing ? "Editar" : "Novo"} usuário</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Nome completo *</span>
                <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Nome de usuário *</span>
                <input className="input" autoCapitalize="none" disabled={!!editing} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">{editing ? "Nova senha (opcional)" : "Senha *"}</span>
                  <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Confirmar</span>
                  <input className="input" type="password" value={form.password2} onChange={(e) => setForm({ ...form, password2: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Perfil *</span>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                </select>
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