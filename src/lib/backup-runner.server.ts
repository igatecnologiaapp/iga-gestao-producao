import type { SupabaseClient } from "@supabase/supabase-js";

const BACKUP_VERSION = 1;

async function buildSnapshot(supabaseAdmin: SupabaseClient<any>) {
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

export type AutoBackupOutcome = {
  ran: boolean;
  reason?: string;
  backupId?: string;
  removed?: number;
  counts?: { materials: number; products: number; sheet_items: number };
};

/**
 * Executes one cycle of automatic backup.
 * - When `force` is false, respects schedule + last_run_at (24h cooldown).
 * - Applies retention by count and by age (whichever removes more).
 */
export async function runAutoBackup(
  supabaseAdmin: SupabaseClient<any>,
  opts: { force?: boolean; trigger?: string } = {},
): Promise<AutoBackupOutcome> {
  const { data: settings, error: sErr } = await supabaseAdmin
    .from("backup_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!settings) return { ran: false, reason: "settings-missing" };

  const force = !!opts.force;
  if (!force && !settings.enabled) return { ran: false, reason: "disabled" };

  const now = new Date();
  if (!force) {
    if (settings.frequency === "weekly" && now.getUTCDay() !== settings.weekday) {
      return { ran: false, reason: "wrong-weekday" };
    }
    if (now.getUTCHours() < settings.hour_utc) {
      return { ran: false, reason: "before-hour" };
    }
    if (settings.last_run_at) {
      const last = new Date(settings.last_run_at).getTime();
      const minGap = settings.frequency === "weekly" ? 6 * 24 * 3600_000 : 20 * 3600_000;
      if (now.getTime() - last < minGap) return { ran: false, reason: "cooldown" };
    }
  }

  const snapshot = await buildSnapshot(supabaseAdmin);
  const payloadStr = JSON.stringify(snapshot);
  const label = `Backup automático — ${now.toLocaleString("pt-BR")}${opts.trigger ? ` (${opts.trigger})` : ""}`;
  const counts = {
    materials: snapshot.materials.length,
    products: snapshot.products.length,
    sheet_items: snapshot.sheet_items.length,
  };
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("backups")
    .insert({
      label,
      payload: snapshot,
      materials_count: counts.materials,
      products_count: counts.products,
      sheet_items_count: counts.sheet_items,
      size_bytes: payloadStr.length,
      created_by_username: "sistema",
      is_auto: true,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);

  // Retention: list all auto backups newest-first
  const { data: autos } = await supabaseAdmin
    .from("backups")
    .select("id, created_at")
    .eq("is_auto", true)
    .order("created_at", { ascending: false });
  const toDelete = new Set<string>();
  const cutoff = Date.now() - settings.retention_days * 24 * 3600_000;
  (autos ?? []).forEach((row, idx) => {
    if (idx >= settings.retention_count) toDelete.add(row.id);
    if (new Date(row.created_at).getTime() < cutoff) toDelete.add(row.id);
  });
  // never delete the one we just created
  toDelete.delete(inserted.id);
  let removed = 0;
  if (toDelete.size > 0) {
    const ids = Array.from(toDelete);
    const { error: delErr } = await supabaseAdmin.from("backups").delete().in("id", ids);
    if (!delErr) removed = ids.length;
  }

  await supabaseAdmin
    .from("backup_settings")
    .update({ last_run_at: now.toISOString(), last_status: `ok (${counts.materials}/${counts.products}/${counts.sheet_items})` })
    .eq("id", 1);

  await supabaseAdmin.from("audit_log").insert({
    event: "BACKUP_AUTO_RUN",
    username: "sistema",
    detail: `${label} · removidos: ${removed} · trigger: ${opts.trigger ?? "cron"}`,
  });

  return { ran: true, backupId: inserted.id, removed, counts };
}