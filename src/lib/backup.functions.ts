import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BACKUP_VERSION = 1;

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

async function resolveUsername(supabaseAdmin: any, userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  return data?.username ?? "desconhecido";
}

async function buildSnapshot(supabaseAdmin: any) {
  const [matsRes, prodsRes, itemsRes] = await Promise.all([
    supabaseAdmin.from("materials").select("*").order("name"),
    supabaseAdmin.from("products").select("*").order("name"),
    supabaseAdmin.from("sheet_items").select("*"),
  ]);
  if (matsRes.error) throw new Error(matsRes.error.message);
  if (prodsRes.error) throw new Error(prodsRes.error.message);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  return {
    version: BACKUP_VERSION,
    generatedAt: new Date().toISOString(),
    materials: matsRes.data ?? [],
    products: prodsRes.data ?? [],
    sheet_items: itemsRes.data ?? [],
  };
}

export const getBackupSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const supabaseAdmin = await loadAdmin();
    const { data, error } = await supabaseAdmin
      .from("backup_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateBackupSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      enabled: boolean;
      frequency: "daily" | "weekly";
      weekday: number;
      hour_utc: number;
      retention_count: number;
      retention_days: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const supabaseAdmin = await loadAdmin();
    const username = await resolveUsername(supabaseAdmin, context.userId);
    const payload = {
      id: 1,
      enabled: !!data.enabled,
      frequency: data.frequency === "weekly" ? "weekly" : "daily",
      weekday: Math.min(6, Math.max(0, Math.floor(data.weekday))),
      hour_utc: Math.min(23, Math.max(0, Math.floor(data.hour_utc))),
      retention_count: Math.max(1, Math.floor(data.retention_count)),
      retention_days: Math.max(1, Math.floor(data.retention_days)),
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };
    const { error } = await supabaseAdmin
      .from("backup_settings")
      .upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      event: "BACKUP_SCHEDULE_UPDATE",
      username,
      user_id: context.userId,
      detail: `enabled=${payload.enabled} freq=${payload.frequency} weekday=${payload.weekday} hour=${payload.hour_utc}UTC retention=${payload.retention_count}/${payload.retention_days}d`,
    });
    return { ok: true };
  });

export const runAutoBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const supabaseAdmin = await loadAdmin();
    const { runAutoBackup } = await import("@/lib/backup-runner.server");
    return runAutoBackup(supabaseAdmin, { force: true, trigger: `manual:${context.userId.slice(0, 8)}` });
  });

export const createBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { label?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const supabaseAdmin = await loadAdmin();
    const snapshot = await buildSnapshot(supabaseAdmin);
    const label = (data.label?.trim() || `Backup ${new Date().toLocaleString("pt-BR")}`).slice(0, 120);
    const payloadStr = JSON.stringify(snapshot);
    const username = await resolveUsername(supabaseAdmin, context.userId);
    const counts = {
      materials: snapshot.materials.length,
      products: snapshot.products.length,
      sheet_items: snapshot.sheet_items.length,
    };
    const { data: inserted, error } = await supabaseAdmin
      .from("backups")
      .insert({
        label,
        payload: snapshot,
        materials_count: counts.materials,
        products_count: counts.products,
        sheet_items_count: counts.sheet_items,
        size_bytes: payloadStr.length,
        created_by: context.userId,
        created_by_username: username,
      })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_log").insert({
      event: "BACKUP_CREATE",
      username,
      user_id: context.userId,
      detail: `${label} — ${counts.materials} matérias, ${counts.products} produtos, ${counts.sheet_items} itens`,
    });
    return { id: inserted.id, label, createdAt: inserted.created_at, counts, sizeBytes: payloadStr.length };
  });

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const supabaseAdmin = await loadAdmin();
    const { data, error } = await supabaseAdmin
      .from("backups")
      .select("id, label, materials_count, products_count, sheet_items_count, size_bytes, created_by_username, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getBackupPayload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const supabaseAdmin = await loadAdmin();
    const { data: row, error } = await supabaseAdmin
      .from("backups")
      .select("id, label, payload, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Backup não encontrado.");
    const username = await resolveUsername(supabaseAdmin, context.userId);
    await supabaseAdmin.from("audit_log").insert({
      event: "BACKUP_DOWNLOAD",
      username,
      user_id: context.userId,
      detail: `Download de ${row.label}`,
    });
    return row;
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const supabaseAdmin = await loadAdmin();
    const { data: row } = await supabaseAdmin.from("backups").select("label").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin.from("backups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    const username = await resolveUsername(supabaseAdmin, context.userId);
    await supabaseAdmin.from("audit_log").insert({
      event: "BACKUP_DELETE",
      username,
      user_id: context.userId,
      detail: `Excluído ${row?.label ?? data.id}`,
    });
    return { ok: true };
  });

function validateSnapshot(snapshot: any): asserts snapshot is {
  version: number;
  materials: any[];
  products: any[];
  sheet_items: any[];
} {
  if (!snapshot || typeof snapshot !== "object") throw new Error("Arquivo inválido.");
  if (!Array.isArray(snapshot.materials)) throw new Error("Backup sem matérias-primas.");
  if (!Array.isArray(snapshot.products)) throw new Error("Backup sem produtos.");
  if (!Array.isArray(snapshot.sheet_items)) throw new Error("Backup sem itens de ficha.");
}

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { backupId?: string; payload?: any; mode?: "replace" }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const supabaseAdmin = await loadAdmin();

    let snapshot: any = data.payload;
    let sourceLabel = "Upload de arquivo";
    if (data.backupId) {
      const { data: row, error } = await supabaseAdmin
        .from("backups")
        .select("label, payload")
        .eq("id", data.backupId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Backup não encontrado.");
      snapshot = row.payload;
      sourceLabel = row.label;
    }
    validateSnapshot(snapshot);

    // Snapshot atual antes de restaurar (rollback de segurança)
    const safety = await buildSnapshot(supabaseAdmin);
    const username = await resolveUsername(supabaseAdmin, context.userId);
    await supabaseAdmin.from("backups").insert({
      label: `Snapshot automático antes de restauração — ${new Date().toLocaleString("pt-BR")}`,
      payload: safety,
      materials_count: safety.materials.length,
      products_count: safety.products.length,
      sheet_items_count: safety.sheet_items.length,
      size_bytes: JSON.stringify(safety).length,
      created_by: context.userId,
      created_by_username: username,
    });

    // Limpa em ordem segura (FKs)
    const delItems = await supabaseAdmin.from("sheet_items").delete().not("id", "is", null);
    if (delItems.error) throw new Error(`Limpando itens: ${delItems.error.message}`);
    const delProds = await supabaseAdmin.from("products").delete().not("id", "is", null);
    if (delProds.error) throw new Error(`Limpando produtos: ${delProds.error.message}`);
    const delMats = await supabaseAdmin.from("materials").delete().not("id", "is", null);
    if (delMats.error) throw new Error(`Limpando matérias: ${delMats.error.message}`);

    // Reinsere
    if (snapshot.materials.length) {
      const rows = snapshot.materials.map((m: any) => ({ ...m, created_by: m.created_by ?? context.userId }));
      const { error } = await supabaseAdmin.from("materials").insert(rows);
      if (error) throw new Error(`Restaurando matérias: ${error.message}`);
    }
    if (snapshot.products.length) {
      const rows = snapshot.products.map((p: any) => ({ ...p, created_by: p.created_by ?? context.userId }));
      const { error } = await supabaseAdmin.from("products").insert(rows);
      if (error) throw new Error(`Restaurando produtos: ${error.message}`);
    }
    if (snapshot.sheet_items.length) {
      const { error } = await supabaseAdmin.from("sheet_items").insert(snapshot.sheet_items);
      if (error) throw new Error(`Restaurando itens: ${error.message}`);
    }

    await supabaseAdmin.from("audit_log").insert({
      event: "BACKUP_RESTORE",
      username,
      user_id: context.userId,
      detail: `Restaurado: ${sourceLabel} (${snapshot.materials.length} matérias, ${snapshot.products.length} produtos, ${snapshot.sheet_items.length} itens)`,
    });

    return {
      ok: true,
      counts: {
        materials: snapshot.materials.length,
        products: snapshot.products.length,
        sheet_items: snapshot.sheet_items.length,
      },
    };
  });