import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { auth, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/alterar-senha")({
  head: () => ({ meta: [{ title: "Alterar senha — FichaTec" }] }),
  component: AlterarSenhaPage,
});

function AlterarSenhaPage() {
  const { session, users } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  if (!session) {
    return (
      <div className="min-h-screen bg-background p-6 text-center text-sm text-muted-foreground">
        Sessão não encontrada.
      </div>
    );
  }

  const me = users.find((u) => u.id === session.userId);
  const force = !!me?.mustChangePassword;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!pw || pw.length < 4) return setError("A nova senha deve ter ao menos 4 caracteres.");
    if (pw !== pw2) return setError("As senhas não conferem.");
    if (pw === "admin123") return setError("Escolha uma senha diferente da padrão.");
    const res = await auth.changePassword(session!.userId, pw);
    if (!res.ok) return setError(res.error ?? "Falha ao alterar senha.");
    setOk(true);
    setTimeout(() => navigate({ to: "/" }), 800);
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {!force && <PageHeader title="Alterar senha" backTo="/" />}
      {force && (
        <header className="border-b border-border bg-primary/10 px-5 py-6">
          <h1 className="text-xl font-bold">Defina uma nova senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">Por segurança, é necessário substituir a senha padrão antes de continuar.</p>
        </header>
      )}
      <form onSubmit={save} className="mx-auto max-w-sm space-y-4 px-5 pt-6">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Nova senha</span>
          <input className="input" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Confirmar senha</span>
          <input className="input" type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Mostrar senha
        </label>
        {error && <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        {ok && <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Senha alterada com sucesso. Redirecionando…</p>}
        <button type="submit" className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-[0.98]">
          Salvar nova senha
        </button>
      </form>
    </div>
  );
}