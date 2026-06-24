import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureAdminSeed,
  adminCreateUser,
  adminUpdateUser,
  adminSetActive,
  resetAdminPassword,
  logLoginFail,
  getLoginIdentityStatus,
} from "@/lib/admin.functions";

export type Role = "admin" | "user";

export interface User {
  id: string;
  fullName: string;
  username: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: number;
}

export type AuditEvent =
  | "LOGIN"
  | "LOGIN_FAIL"
  | "LOGOUT"
  | "PASSWORD_CHANGE"
  | "USER_CREATE"
  | "USER_UPDATE"
  | "USER_ACTIVATE"
  | "USER_DEACTIVATE"
  | "BACKUP_CREATE"
  | "BACKUP_DOWNLOAD"
  | "BACKUP_RESTORE"
  | "BACKUP_DELETE"
  | "BACKUP_SCHEDULE_UPDATE"
  | "BACKUP_AUTO_RUN";

export interface AuditEntry {
  id: string;
  userId: string | null;
  username: string;
  event: AuditEvent;
  timestamp: number;
  device: string;
  detail?: string;
}

export interface Session {
  userId: string;
  username: string;
  fullName: string;
  role: Role;
  startedAt: number;
}

interface AuthState {
  session: Session | null;
  users: User[];
  audit: AuditEntry[];
  ready: boolean;
}

const USER_DOMAIN = "fichatec.app";

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USER_DOMAIN}`;
}

const initial: AuthState = { session: null, users: [], audit: [], ready: false };
let state: AuthState = initial;
const listeners = new Set<() => void>();
let bootstrapped = false;

function emit(next: Partial<AuthState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function device(): string {
  if (typeof navigator === "undefined") return "server";
  return /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? "Mobile" : "Desktop";
}

async function loadProfile(userId: string): Promise<Session | null> {
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, active").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  if (!profile) return null;
  if (profile.active === false) return null;
  return {
    userId: profile.id,
    username: profile.username,
    fullName: profile.full_name ?? profile.username,
    role: (roleRow?.role as Role) ?? "user",
    startedAt: Date.now(),
  };
}

async function loadUsers(): Promise<User[]> {
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (!profiles) return [];
  const roleMap = new Map<string, Role>();
  (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
  return profiles.map((p: any) => ({
    id: p.id,
    fullName: p.full_name ?? p.username,
    username: p.username,
    role: roleMap.get(p.id) ?? "user",
    active: p.active !== false,
    mustChangePassword: !!p.must_change_password,
    createdAt: new Date(p.created_at).getTime(),
  }));
}

async function loadAudit(isAdmin: boolean): Promise<AuditEntry[]> {
  if (!isAdmin) return [];
  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((e: any) => ({
    id: e.id,
    userId: e.user_id,
    username: e.username,
    event: e.event as AuditEvent,
    timestamp: new Date(e.created_at).getTime(),
    device: e.device ?? "",
    detail: e.detail ?? undefined,
  }));
}

async function refresh(userId: string | null) {
  const session = userId ? await loadProfile(userId) : null;
  if (userId && !session) {
    // Profile missing or inactive — sign out
    await supabase.auth.signOut();
    emit({ session: null, users: [], audit: [], ready: true });
    return;
  }
  const isAdmin = session?.role === "admin";
  const [users, audit] = session
    ? await Promise.all([loadUsers(), loadAudit(isAdmin)])
    : [[], []];
  emit({ session, users, audit, ready: true });
}

async function logAudit(event: AuditEvent, username: string, userId: string | null, detail?: string) {
  try {
    await supabase.from("audit_log").insert({
      event,
      username,
      user_id: userId,
      device: device(),
      detail: detail ?? null,
    });
  } catch {
    // best effort
  }
}

function bootstrap() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;
  supabase.auth.getSession().then(({ data }) => {
    refresh(data.session?.user.id ?? null);
  });
  supabase.auth.onAuthStateChange((event, sess) => {
    if (event === "SIGNED_OUT") {
      emit({ session: null, users: [], audit: [], ready: true });
      return;
    }
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
      refresh(sess?.user.id ?? null);
    }
  });
}

function subscribe(l: () => void) {
  bootstrap();
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot(): AuthState {
  return state;
}
function getServerSnapshot(): AuthState {
  return initial;
}

export function useAuth() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const auth = {
  async ensureAdminSeed(): Promise<void> {
    try {
      await ensureAdminSeed();
    } catch (err) {
      console.error("ensureAdminSeed", err);
      throw err;
    }
  },

  async resetAdminPassword(): Promise<{ ok: boolean; error?: string }> {
    try {
      await resetAdminPassword();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Falha ao redefinir senha do admin." };
    }
  },

  async login(
    username: string,
    password: string,
  ): Promise<{ ok: true } | { ok: false; error: "missing" | "not_found" | "inactive" | "bad_password" | "profile_error" | "role_error" | "seed_error" | "auth_error" }> {
    const u = username.trim();
    if (!u || !password) return { ok: false, error: "missing" };
    const email = usernameToEmail(u);
    if (u.toLowerCase() === "admin") {
      try {
        await ensureAdminSeed();
      } catch (err) {
        console.error("Falha ao criar/restaurar admin antes do login", err);
        return { ok: false, error: "seed_error" };
      }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      console.error("Falha técnica de autenticação", { username: u, email, error });
      try {
        await logLoginFail({ data: { username: u, device: device(), detail: error?.message } });
      } catch {
        // ignore
      }
      try {
        const status = await getLoginIdentityStatus({ data: { username: u } });
        if (!status.exists) return { ok: false, error: "not_found" };
        if (!status.active) return { ok: false, error: "inactive" };
        if (!status.hasRole) return { ok: false, error: "role_error" };
      } catch (statusErr: any) {
        console.error("Falha ao diagnosticar login", statusErr);
        const detail = String(statusErr?.message ?? "").toLowerCase();
        if (detail.includes("profile")) return { ok: false, error: "profile_error" };
        if (detail.includes("role")) return { ok: false, error: "role_error" };
        return { ok: false, error: "auth_error" };
      }
      return { ok: false, error: "bad_password" };
    }
    // Verify profile is active
    const [{ data: profile, error: profileErr }, { data: roleRow, error: roleErr }] = await Promise.all([
      supabase
      .from("profiles")
      .select("active, username")
      .eq("id", data.user.id)
      .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle(),
    ]);
    if (profileErr || !profile) {
      console.error("Falha ao buscar profile após login", profileErr);
      await supabase.auth.signOut();
      return { ok: false, error: "profile_error" };
    }
    if (roleErr || !roleRow) {
      console.error("Falha ao buscar role após login", roleErr);
      await supabase.auth.signOut();
      return { ok: false, error: "role_error" };
    }
    if (profile.active === false) {
      await supabase.auth.signOut();
      return { ok: false, error: "inactive" };
    }
    await logAudit("LOGIN", profile?.username ?? u, data.user.id);
    await refresh(data.user.id);
    return { ok: true };
  },

  async logout(): Promise<void> {
    const s = state.session;
    if (s) await logAudit("LOGOUT", s.username, s.userId);
    await supabase.auth.signOut();
    emit({ session: null, users: [], audit: [], ready: true });
  },

  async changePassword(_userId: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
    if (newPassword.length < 6) return { ok: false, error: "Senha muito curta (mínimo 6 caracteres)." };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    const s = state.session;
    if (s) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", s.userId);
      await logAudit("PASSWORD_CHANGE", s.username, s.userId);
      await refresh(s.userId);
    }
    return { ok: true };
  },

  async createUser(input: { fullName: string; username: string; password: string; role: Role }): Promise<{ ok: boolean; error?: string }> {
    try {
      await adminCreateUser({ data: input });
      const s = state.session;
      await logAudit("USER_CREATE", input.username, s?.userId ?? null, `Perfil: ${input.role}`);
      if (s) await refresh(s.userId);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Erro ao criar usuário." };
    }
  },

  async updateUser(id: string, patch: Partial<Pick<User, "fullName" | "role">> & { newPassword?: string }): Promise<{ ok: boolean; error?: string }> {
    try {
      await adminUpdateUser({
        data: {
          id,
          fullName: patch.fullName,
          role: patch.role,
          newPassword: patch.newPassword,
        },
      });
      const target = state.users.find((u) => u.id === id);
      if (target) {
        await logAudit("USER_UPDATE", target.username, target.id);
        if (patch.newPassword) await logAudit("PASSWORD_CHANGE", target.username, target.id, "Alterada por administrador");
      }
      const s = state.session;
      if (s) await refresh(s.userId);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Erro ao atualizar usuário." };
    }
  },

  async toggleActive(id: string): Promise<void> {
    const target = state.users.find((u) => u.id === id);
    if (!target) return;
    const nextActive = !target.active;
    try {
      await adminSetActive({ data: { id, active: nextActive } });
      await logAudit(nextActive ? "USER_ACTIVATE" : "USER_DEACTIVATE", target.username, target.id);
      const s = state.session;
      if (s) await refresh(s.userId);
    } catch (err) {
      console.error("toggleActive", err);
    }
  },
};

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR");
}