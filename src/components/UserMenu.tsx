import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { auth, useAuth } from "@/lib/auth";

export function UserMenu({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!session) return null;
  const initials = (session.fullName || session.username).slice(0, 2).toUpperCase();

  async function doLogout() {
    await auth.logout();
    setConfirm(false);
    setOpen(false);
    navigate({ to: "/login", replace: true });
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu do usuário"
          className={`flex h-9 items-center gap-2 rounded-full border px-2 pr-3 text-xs font-semibold active:scale-95 ${
            variant === "dark"
              ? "border-white/20 bg-white/10 text-white"
              : "border-border bg-card text-foreground"
          }`}
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {initials}
          </span>
          <span className="hidden max-w-24 truncate sm:inline">{session.fullName}</span>
          <span className="opacity-60">▾</span>
        </button>
        {open && (
          <div className="absolute right-0 top-11 z-40 w-60 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
            <div className="border-b border-border px-4 py-3">
              <div className="truncate text-sm font-semibold">{session.fullName}</div>
              <div className="truncate text-xs text-muted-foreground">@{session.username} · {session.role === "admin" ? "Administrador" : "Usuário"}</div>
            </div>
            <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent">
              <span>🏠</span> Página inicial
            </Link>
            {session.role === "admin" && (
              <>
                <Link to="/usuarios" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent">
                  <span>👥</span> Usuários
                </Link>
                <Link to="/auditoria" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent">
                  <span>🛡️</span> Auditoria
                </Link>
              </>
            )}
            <Link to="/alterar-senha" onClick={() => setOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent">
              <span>🔑</span> Alterar senha
            </Link>
            <button
              onClick={() => { setOpen(false); setConfirm(true); }}
              className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              <span>🚪</span> Sair
            </button>
          </div>
        )}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4" onClick={() => setConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-3xl">🚪</div>
            <h2 className="mt-2 text-lg font-bold">Sair do sistema</h2>
            <p className="mt-1 text-sm text-muted-foreground">Deseja realmente sair do sistema? Sua sessão será encerrada.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium">Cancelar</button>
              <button onClick={doLogout} className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground active:scale-95">Sim, sair</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}