import { useSyncExternalStore } from "react";

export type Role = "admin" | "user";

export interface User {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string; // "seed:plain" for first-time admin, else "sha256:<salt>:<hex>"
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
  | "USER_DEACTIVATE";

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

interface AuthDB {
  users: User[];
  audit: AuditEntry[];
  session: Session | null;
}

const KEY = "fichatec-auth-v1";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const seedAdmin = (): User => ({
  id: uid(),
  fullName: "Administrador",
  username: "admin",
  passwordHash: "seed:admin123",
  role: "admin",
  active: true,
  mustChangePassword: true,
  createdAt: Date.now(),
});

const initial: AuthDB = { users: [], audit: [], session: null };

function read(): AuthDB {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const seeded: AuthDB = { users: [seedAdmin()], audit: [], session: null };
      localStorage.setItem(KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as AuthDB;
    if (!parsed.users || parsed.users.length === 0) {
      parsed.users = [seedAdmin()];
    }
    return parsed;
  } catch {
    return { users: [seedAdmin()], audit: [], session: null };
  }
}

let state: AuthDB = initial;
let hydrated = false;
const listeners = new Set<() => void>();

function ensureHydrated() {
  if (!hydrated && typeof window !== "undefined") {
    state = read();
    hydrated = true;
  }
}

function write(next: AuthDB) {
  state = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  ensureHydrated();
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot(): AuthDB {
  ensureHydrated();
  return state;
}
function getServerSnapshot(): AuthDB {
  return initial;
}

export function useAuth() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string): Promise<string> {
  const salt = uid().replace(/-/g, "").slice(0, 16);
  const h = await sha256Hex(`${salt}:${password}`);
  return `sha256:${salt}:${h}`;
}

async function verifyPassword(user: User, password: string): Promise<boolean> {
  if (user.passwordHash.startsWith("seed:")) {
    return user.passwordHash.slice(5) === password;
  }
  const parts = user.passwordHash.split(":");
  if (parts.length !== 3 || parts[0] !== "sha256") return false;
  const salt = parts[1];
  const expected = parts[2];
  const h = await sha256Hex(`${salt}:${password}`);
  return h === expected;
}

function device(): string {
  if (typeof navigator === "undefined") return "server";
  const ua = navigator.userAgent;
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) return "Mobile";
  return "Desktop";
}

function audit(
  event: AuditEvent,
  username: string,
  userId: string | null,
  detail?: string,
) {
  const entry: AuditEntry = {
    id: uid(),
    userId,
    username,
    event,
    timestamp: Date.now(),
    device: device(),
    detail,
  };
  write({ ...state, audit: [entry, ...state.audit].slice(0, 1000) });
}

export const auth = {
  async login(username: string, password: string): Promise<{ ok: true } | { ok: false; error: "missing" | "not_found" | "inactive" | "bad_password" }> {
    ensureHydrated();
    const u = username.trim();
    if (!u || !password) return { ok: false, error: "missing" };
    const user = state.users.find((x) => x.username.toLowerCase() === u.toLowerCase());
    if (!user) {
      audit("LOGIN_FAIL", u, null, "Usuário não encontrado");
      return { ok: false, error: "not_found" };
    }
    if (!user.active) {
      audit("LOGIN_FAIL", u, user.id, "Usuário inativo");
      return { ok: false, error: "inactive" };
    }
    const ok = await verifyPassword(user, password);
    if (!ok) {
      audit("LOGIN_FAIL", u, user.id, "Senha inválida");
      return { ok: false, error: "bad_password" };
    }
    const session: Session = {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      startedAt: Date.now(),
    };
    write({ ...state, session });
    audit("LOGIN", user.username, user.id);
    return { ok: true };
  },
  logout() {
    ensureHydrated();
    const s = state.session;
    if (s) audit("LOGOUT", s.username, s.userId);
    write({ ...state, session: null });
  },
  async changePassword(userId: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
    ensureHydrated();
    if (newPassword.length < 4) return { ok: false, error: "Senha muito curta (mínimo 4 caracteres)." };
    const hash = await hashPassword(newPassword);
    const users = state.users.map((x) =>
      x.id === userId ? { ...x, passwordHash: hash, mustChangePassword: false } : x,
    );
    const target = users.find((x) => x.id === userId);
    write({ ...state, users });
    if (target) audit("PASSWORD_CHANGE", target.username, target.id);
    return { ok: true };
  },
  async createUser(input: { fullName: string; username: string; password: string; role: Role }): Promise<{ ok: boolean; error?: string }> {
    ensureHydrated();
    const username = input.username.trim();
    if (!input.fullName.trim() || !username || !input.password) return { ok: false, error: "Preencha todos os campos obrigatórios." };
    if (state.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return { ok: false, error: "Nome de usuário já existe." };
    const passwordHash = await hashPassword(input.password);
    const user: User = {
      id: uid(),
      fullName: input.fullName.trim(),
      username,
      passwordHash,
      role: input.role,
      active: true,
      mustChangePassword: false,
      createdAt: Date.now(),
    };
    write({ ...state, users: [...state.users, user] });
    audit("USER_CREATE", user.username, user.id, `Perfil: ${user.role}`);
    return { ok: true };
  },
  async updateUser(id: string, patch: Partial<Pick<User, "fullName" | "role">> & { newPassword?: string }) {
    ensureHydrated();
    let hash: string | undefined;
    if (patch.newPassword) hash = await hashPassword(patch.newPassword);
    const users = state.users.map((u) =>
      u.id === id
        ? {
            ...u,
            ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
            ...(patch.role !== undefined ? { role: patch.role } : {}),
            ...(hash ? { passwordHash: hash, mustChangePassword: false } : {}),
          }
        : u,
    );
    write({ ...state, users });
    const u = users.find((x) => x.id === id);
    if (u) audit("USER_UPDATE", u.username, u.id);
    if (u && hash) audit("PASSWORD_CHANGE", u.username, u.id, "Alterada por administrador");
  },
  toggleActive(id: string) {
    ensureHydrated();
    const users = state.users.map((u) => (u.id === id ? { ...u, active: !u.active } : u));
    const u = users.find((x) => x.id === id);
    write({ ...state, users });
    if (u) audit(u.active ? "USER_ACTIVATE" : "USER_DEACTIVATE", u.username, u.id);
  },
};

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR");
}