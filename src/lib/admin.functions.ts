import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const USER_DOMAIN = "fichatec.app";
const DEFAULT_ADMIN = {
  username: "admin",
  email: "admin@fichatec.app",
  password: "admin123",
  fullName: "Administrador",
} as const;

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USER_DOMAIN}`;
}

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function adminPasswordWorks(): Promise<boolean> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return false;
    const client = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.signInWithPassword({
      email: DEFAULT_ADMIN.email,
      password: DEFAULT_ADMIN.password,
    });
    if (data.session) await client.auth.signOut();
    return !error && !!data.user;
  } catch (err) {
    console.error("adminPasswordWorks", err);
    return false;
  }
}

async function findAuthUserByEmail(supabaseAdmin: any, email: string) {
  const normalized = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const found = data?.users?.find((u: any) => u.email?.toLowerCase() === normalized);
    if (found || !data?.users || data.users.length < 1000) return found ?? null;
  }
  return null;
}

async function ensureAdminRows(supabaseAdmin: any, userId: string, mustChangePassword: boolean) {
  const { data: staleProfile, error: staleErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("username", DEFAULT_ADMIN.username)
    .maybeSingle();
  if (staleErr) throw new Error(staleErr.message);
  if (staleProfile && staleProfile.id !== userId) {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ username: `admin_recuperado_${Date.now()}` })
      .eq("id", staleProfile.id);
    if (error) throw new Error(error.message);
  }

  const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      username: DEFAULT_ADMIN.username,
      full_name: DEFAULT_ADMIN.fullName,
      active: true,
      must_change_password: mustChangePassword,
    },
    { onConflict: "id" },
  );
  if (profileErr) throw new Error(profileErr.message);

  const { error: delErr } = await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);
  const { error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userId, role: "admin" });
  if (roleErr) throw new Error(roleErr.message);
}

async function restoreDefaultAdmin(options: { resetPassword: boolean; event: string; detail: string }) {
  const supabaseAdmin = await loadAdmin();
  let user = await findAuthUserByEmail(supabaseAdmin, DEFAULT_ADMIN.email);

  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: DEFAULT_ADMIN.email,
      password: DEFAULT_ADMIN.password,
      email_confirm: true,
      user_metadata: {
        username: DEFAULT_ADMIN.username,
        full_name: DEFAULT_ADMIN.fullName,
        role: "admin",
        must_change_password: true,
      },
    });
    if (error) throw new Error(error.message);
    user = data.user;
  } else {
    const updatePayload: any = {
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        username: DEFAULT_ADMIN.username,
        full_name: DEFAULT_ADMIN.fullName,
        role: "admin",
        must_change_password: true,
      },
    };
    if (options.resetPassword) updatePayload.password = DEFAULT_ADMIN.password;
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, updatePayload);
    if (error) throw new Error(error.message);
    user = data.user ?? user;
  }

  if (!user?.id) throw new Error("Falha ao localizar o usuário administrador.");
  await ensureAdminRows(supabaseAdmin, user.id, true);
  await supabaseAdmin.from("audit_log").insert({
    event: options.event,
    username: DEFAULT_ADMIN.username,
    user_id: user.id,
    detail: options.detail,
  });
  return { ok: true, userId: user.id, email: DEFAULT_ADMIN.email };
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("Falha ao verificar permissão");
  if (!data) throw new Error("Acesso negado: apenas administradores.");
}

/**
 * Idempotent admin seed. If no admin role exists, creates the default
 * admin user (admin / admin123) with must_change_password = true.
 * Safe to call from anywhere because it no-ops once any admin exists.
 */
export const ensureAdminSeed = createServerFn({ method: "POST" }).handler(async () => {
  const supabaseAdmin = await loadAdmin();
  const existingAdmin = await findAuthUserByEmail(supabaseAdmin, DEFAULT_ADMIN.email);
  if (existingAdmin?.id) {
    const passwordOk = await adminPasswordWorks();
    if (!passwordOk) {
      return restoreDefaultAdmin({
        resetPassword: true,
        event: "ADMIN_RESET",
        detail: "Senha do administrador padrão corrigida automaticamente para admin123.",
      });
    }
    await ensureAdminRows(supabaseAdmin, existingAdmin.id, true);
    return { seeded: false, userId: existingAdmin.id };
  }

  const { count, error: cErr } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) > 0) return restoreDefaultAdmin({
    resetPassword: true,
    event: "ADMIN_RESTORE",
    detail: "Administrador padrão criado porque não existia em Auth.",
  });

  return restoreDefaultAdmin({
    resetPassword: true,
    event: "ADMIN_SEED",
    detail: "Administrador inicial criado com credenciais padrão.",
  });
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { fullName: string; username: string; password: string; role: "admin" | "user" }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const supabaseAdmin = await loadAdmin();
    const username = data.username.trim().toLowerCase();
    if (!username || !data.fullName.trim() || !data.password)
      throw new Error("Preencha todos os campos obrigatórios.");
    if (data.password.length < 6) throw new Error("Senha deve ter ao menos 6 caracteres.");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: usernameToEmail(username),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: data.fullName.trim(),
        role: data.role,
        must_change_password: false,
      },
    });
    if (error) throw new Error(error.message);
    return { id: created.user?.id };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      fullName?: string;
      role?: "admin" | "user";
      newPassword?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const supabaseAdmin = await loadAdmin();
    if (data.fullName !== undefined) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.fullName })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    if (data.role !== undefined) {
      const { error: delErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.id);
      if (delErr) throw new Error(delErr.message);
      const { error: insErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.id, role: data.role });
      if (insErr) throw new Error(insErr.message);
    }
    if (data.newPassword) {
      if (data.newPassword.length < 6) throw new Error("Senha deve ter ao menos 6 caracteres.");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
        password: data.newPassword,
      });
      if (error) throw new Error(error.message);
      await supabaseAdmin
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", data.id);
    }
    return { ok: true };
  });

export const adminSetActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const supabaseAdmin = await loadAdmin();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Emergency reset for the default `admin` user. Sets password back to
 * `admin123` and forces a password change on next login. Intended as a
 * recovery path when no administrator can access the system.
 */
export const resetAdminPassword = createServerFn({ method: "POST" }).handler(async () => {
  return restoreDefaultAdmin({
    resetPassword: true,
    event: "ADMIN_RESET",
    detail: "Acesso do administrador restaurado para admin/admin123.",
  });
});

/**
 * Logs an unauthenticated login failure. Uses the admin client to bypass
 * RLS (the audit policy requires authenticated inserts).
 */
export const logLoginFail = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string; device?: string; detail?: string }) => input)
  .handler(async ({ data }) => {
    const supabaseAdmin = await loadAdmin();
    await supabaseAdmin.from("audit_log").insert({
      event: "LOGIN_FAIL",
      username: data.username.slice(0, 64),
      user_id: null,
      device: data.device ?? null,
      detail: data.detail?.slice(0, 200) ?? null,
    });
    return { ok: true };
  });