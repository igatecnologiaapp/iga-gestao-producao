import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — FichaTec" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string; global?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      navigate({ to: session.userId && needsChange() ? "/alterar-senha" : "/" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function needsChange(): boolean {
    // Lazy check via auth store
    try {
      const raw = localStorage.getItem("fichatec-auth-v1");
      if (!raw) return false;
      const db = JSON.parse(raw);
      const u = db.users?.find((x: any) => x.id === db.session?.userId);
      return !!u?.mustChangePassword;
    } catch {
      return false;
    }
  }

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
      else if (res.error === "bad_password") setErrors({ password: "Senha inválida.", global: "Senha inválida." });
      else if (res.error === "inactive") setErrors({ global: "Usuário desativado. Contate o administrador." });
      else setErrors({ global: "Preencha todos os campos obrigatórios." });
      return;
    }
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

          <p className="text-center text-[11px] text-muted-foreground">
            Acesso inicial: <b>admin</b> / <b>admin123</b><br />
            A senha padrão deverá ser alterada no primeiro acesso.
          </p>
        </form>
      </div>
    </div>
  );
}