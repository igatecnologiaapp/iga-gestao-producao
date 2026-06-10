import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const USER_DOMAIN = "fichatec.app";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USER_DOMAIN}`;
}

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
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
  const { count, error: cErr } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) > 0) return { seeded: false };

  const email = usernameToEmail("admin");
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: "admin123",
    email_confirm: true,
    user_metadata: {
      username: "admin",
      full_name: "Administrador",
      role: "admin",
      must_change_password: true,
    },
  });
  if (error) {
    // Provavelmente o usuário já existe sem role; tente garantir o role
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === email);
    if (existing) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: existing.id, role: "admin" }, { onConflict: "user_id,role" });
      return { seeded: true };
    }
    throw new Error(error.message);
  }
  // Trigger handle_new_user já criou profile + role conforme metadata.
  return { seeded: true, userId: data.user?.id };
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
  const supabaseAdmin = await loadAdmin();
  const email = usernameToEmail("admin");
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw new Error(listErr.message);
  const target = list?.users.find((u) => u.email === email);
  if (!target) throw new Error("Usuário admin não encontrado.");
  const { error: pErr } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
    password: "admin123",
  });
  if (pErr) throw new Error(pErr.message);
  await supabaseAdmin
    .from("profiles")
    .update({ active: true, must_change_password: true })
    .eq("id", target.id);
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: target.id, role: "admin" }, { onConflict: "user_id,role" });
  await supabaseAdmin.from("audit_log").insert({
    event: "ADMIN_RESET",
    username: "admin",
    user_id: target.id,
    detail: "Senha do administrador redefinida para padrão (admin123).",
  });
  return { ok: true };
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