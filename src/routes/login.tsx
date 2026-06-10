import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — FichaTec" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { session, users } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string; global?: string }>({});
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    // Garante criação do admin inicial (idempotente — no-op após primeiro seed)
    void auth.ensureAdminSeed();
  }, []);

  useEffect(() => {
    if (session) {
      const me = users.find((u) => u.id === session.userId);
      navigate({ to: me?.mustChangePassword ? "/alterar-senha" : "/" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, users]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (!username.trim() || !password) {
      setErrors({
        username: !username.trim() ? "Obrigatório" : undefined,
        password: !password ? "Obrigatório" : undefined,
        global: "Preencha todos os campos obrigatórios.",
      });
      return;
    }
    setLoading(true);
    const res = await auth.login(username, password);
    setLoading(false);
    if (!res.ok) {
      if (res.error === "not_found") setErrors({ username: "Usuário não encontrado.", global: "Usuário não encontrado." });
      else if (res.error === "bad_password")
        setErrors({
          password: "Senha incorreta.",
          global: "Senha incorreta. Consulte o Administrador.",
        });
      else if (res.error === "inactive") setErrors({ global: "Usuário desativado. Contate o administrador." });
      else setErrors({ global: "Preencha todos os campos obrigatórios." });
      return;
    }
  }

  async function doResetAdmin() {
    setResetLoading(true);
    setResetMsg(null);
    const r = await auth.resetAdminPassword();
    setResetLoading(false);
    if (r.ok) setResetMsg("Senha do administrador redefinida para admin / admin123. Faça login e altere imediatamente.");
    else setResetMsg(r.error ?? "Falha ao redefinir senha do admin.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/15 via-background to-accent/30 px-5 py-12">
      <div className="mx-auto max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-primary text-3xl text-primary-foreground shadow-lg">📋</div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">FichaTec</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entre com seu usuário e senha</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Nome de usuário</span>
            <input
              className="input"
              style={errors.username ? { borderColor: "var(--destructive)" } : undefined}
              autoCapitalize="none"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="seu.usuario"
            />
            {errors.username && <span className="mt-1 block text-xs text-destructive">{errors.username}</span>}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Senha</span>
            <div className="relative">
              <input
                className="input pr-12"
                style={errors.password ? { borderColor: "var(--destructive)" } : undefined}
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                {show ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {errors.password && <span className="mt-1 block text-xs text-destructive">{errors.password}</span>}
          </label>

          {errors.global && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errors.global}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            type="button"
            onClick={() => { setForgotOpen(true); setResetMsg(null); }}
            className="block w-full text-center text-xs font-medium text-primary hover:underline"
          >
            Esqueci minha senha
          </button>

          <p className="text-center text-[11px] text-muted-foreground">
            Acesso inicial: <b>admin</b> / <b>admin123</b><br />
            A senha padrão deverá ser alterada no primeiro acesso.
          </p>
        </form>

        {forgotOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4" onClick={() => setForgotOpen(false)}>
            <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-base font-bold">Recuperação de senha</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Para redefinir sua senha, consulte o <b>Administrador do sistema</b>.
              </p>
              <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs font-semibold text-foreground">Sou o administrador e perdi o acesso</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Esta ação redefine a senha do usuário <b>admin</b> para <b>admin123</b> e exige troca no próximo login.
                </p>
                <button
                  type="button"
                  onClick={doResetAdmin}
                  disabled={resetLoading}
                  className="mt-2 w-full rounded-lg border border-destructive/40 bg-destructive/10 py-2 text-xs font-semibold text-destructive disabled:opacity-60"
                >
                  {resetLoading ? "Redefinindo..." : "Redefinir senha do admin"}
                </button>
                {resetMsg && <p className="mt-2 text-[11px] text-foreground">{resetMsg}</p>}
              </div>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="mt-4 w-full rounded-xl border border-border py-2 text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}