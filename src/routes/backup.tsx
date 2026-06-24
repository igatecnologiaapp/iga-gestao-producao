import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { refreshDB } from "@/lib/store";
import {
  createBackup,
  listBackups,
  getBackupPayload,
  deleteBackup,
  restoreBackup,
} from "@/lib/backup.functions";

export const Route = createFileRoute("/backup")({
  head: () => ({ meta: [{ title: "Backup e Segurança — FichaTec" }] }),
  component: BackupPage,
});

type BackupRow = {
  id: string;
  label: string;
  materials_count: number;
  products_count: number;
  sheet_items_count: number;
  size_bytes: number;
  created_by_username: string | null;
  created_at: string;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function BackupPage() {
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";

  const listFn = useServerFn(listBackups);
  const createFn = useServerFn(createBackup);
  const getFn = useServerFn(getBackupPayload);
  const deleteFn = useServerFn(deleteBackup);
  const restoreFn = useServerFn(restoreBackup);

  const [items, setItems] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function reload() {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = (await listFn()) as BackupRow[];
      setItems(data);
    } catch (err: any) {
      setMessage({ tone: "err", text: err?.message ?? "Falha ao carregar histórico." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!session || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Backup e Segurança" backTo="/configuracoes" />
        <div className="p-6 text-center text-sm text-muted-foreground">
          Acesso restrito a administradores.
        </div>
      </div>
    );
  }

  async function handleCreate() {
    setBusy("create");
    setMessage(null);
    try {
      const res = await createFn({ data: { label } });
      setLabel("");
      setMessage({
        tone: "ok",
        text: `Backup criado (${res.counts.materials} matérias, ${res.counts.products} produtos, ${res.counts.sheet_items} itens).`,
      });
      await reload();
    } catch (err: any) {
      setMessage({ tone: "err", text: err?.message ?? "Falha ao criar backup." });
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload(row: BackupRow, format: "json" | "zip") {
    setBusy(`dl-${row.id}-${format}`);
    setMessage(null);
    try {
      const res = (await getFn({ data: { id: row.id } })) as { label: string; payload: any };
      const json = JSON.stringify(res.payload, null, 2);
      const base = `fichatec-${row.id.slice(0, 8)}-${row.created_at.slice(0, 10)}`;
      if (format === "json") {
        downloadBlob(new Blob([json], { type: "application/json" }), `${base}.json`);
      } else {
        const zip = new JSZip();
        zip.file(`${base}.json`, json);
        zip.file(
          "LEIA-ME.txt",
          `Backup FichaTec\nRótulo: ${row.label}\nGerado em: ${row.created_at}\nMatérias: ${row.materials_count}\nProdutos: ${row.products_count}\nItens de ficha: ${row.sheet_items_count}\n`,
        );
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(blob, `${base}.zip`);
      }
    } catch (err: any) {
      setMessage({ tone: "err", text: err?.message ?? "Falha no download." });
    } finally {
      setBusy(null);
    }
  }

  async function handleRestoreFromHistory(row: BackupRow) {
    if (
      !window.confirm(
        `Restaurar "${row.label}"?\n\nIsso SUBSTITUI todas as matérias-primas, produtos e fichas atuais.\nUm snapshot automático será salvo antes da restauração.`,
      )
    )
      return;
    setBusy(`rs-${row.id}`);
    setMessage(null);
    try {
      const res = await restoreFn({ data: { backupId: row.id } });
      refreshDB();
      setMessage({
        tone: "ok",
        text: `Restauração concluída (${res.counts.materials} matérias, ${res.counts.products} produtos, ${res.counts.sheet_items} itens).`,
      });
      await reload();
    } catch (err: any) {
      setMessage({ tone: "err", text: err?.message ?? "Falha ao restaurar." });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(row: BackupRow) {
    if (!window.confirm(`Excluir backup "${row.label}"? Esta ação não pode ser desfeita.`)) return;
    setBusy(`del-${row.id}`);
    setMessage(null);
    try {
      await deleteFn({ data: { id: row.id } });
      setMessage({ tone: "ok", text: "Backup excluído." });
      await reload();
    } catch (err: any) {
      setMessage({ tone: "err", text: err?.message ?? "Falha ao excluir." });
    } finally {
      setBusy(null);
    }
  }

  async function handleUploadRestore(file: File) {
    if (
      !window.confirm(
        `Restaurar a partir do arquivo "${file.name}"?\n\nIsso SUBSTITUI todos os dados atuais.\nUm snapshot automático será salvo antes da restauração.`,
      )
    ) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setBusy("upload");
    setMessage(null);
    try {
      let text: string;
      if (file.name.toLowerCase().endsWith(".zip")) {
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const jsonEntry = Object.values(zip.files).find(
          (f) => !f.dir && f.name.toLowerCase().endsWith(".json"),
        );
        if (!jsonEntry) throw new Error("ZIP não contém arquivo .json.");
        text = await jsonEntry.async("string");
      } else {
        text = await file.text();
      }
      const payload = JSON.parse(text);
      const res = await restoreFn({ data: { payload } });
      refreshDB();
      setMessage({
        tone: "ok",
        text: `Restauração concluída (${res.counts.materials} matérias, ${res.counts.products} produtos, ${res.counts.sheet_items} itens).`,
      });
      await reload();
    } catch (err: any) {
      setMessage({ tone: "err", text: err?.message ?? "Arquivo inválido." });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageHeader
        title="Backup e Segurança"
        subtitle={`${items.length} backup(s) no histórico`}
        backTo="/configuracoes"
      />

      <div className="space-y-4 px-4 pt-4">
        {message && (
          <div
            className={
              "rounded-2xl border p-3 text-sm " +
              (message.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-destructive/30 bg-destructive/10 text-destructive")
            }
          >
            {message.text}
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Criar backup manual</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Gera um snapshot completo de matérias-primas, produtos e fichas técnicas.
          </p>
          <div className="mt-3 flex gap-2">
            <Input
              placeholder="Rótulo (opcional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={120}
            />
            <Button onClick={handleCreate} disabled={busy === "create"}>
              {busy === "create" ? "Gerando…" : "Criar backup"}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Restaurar a partir de arquivo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Aceita arquivos <strong>.json</strong> ou <strong>.zip</strong> gerados por este sistema.
            Toda a base atual será substituída.
          </p>
          <div className="mt-3">
            <input
              ref={fileRef}
              type="file"
              accept=".json,.zip,application/json,application/zip"
              disabled={busy === "upload"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadRestore(f);
              }}
              className="text-sm"
            />
            {busy === "upload" && <span className="ml-2 text-xs text-muted-foreground">Restaurando…</span>}
          </div>
        </section>

        <section>
          <h2 className="px-1 pb-2 text-sm font-semibold">Histórico</h2>
          {loading && items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Carregando…
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum backup registrado ainda.
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((row) => (
                <li key={row.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{row.label}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(row.created_at)} · {row.created_by_username ?? "—"} ·{" "}
                        {formatBytes(row.size_bytes)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.materials_count} matérias · {row.products_count} produtos ·{" "}
                        {row.sheet_items_count} itens de ficha
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(row, "json")}
                      disabled={busy === `dl-${row.id}-json`}
                    >
                      {busy === `dl-${row.id}-json` ? "…" : "Baixar JSON"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(row, "zip")}
                      disabled={busy === `dl-${row.id}-zip`}
                    >
                      {busy === `dl-${row.id}-zip` ? "…" : "Baixar ZIP"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleRestoreFromHistory(row)}
                      disabled={busy === `rs-${row.id}`}
                    >
                      {busy === `rs-${row.id}` ? "Restaurando…" : "Restaurar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(row)}
                      disabled={busy === `del-${row.id}`}
                    >
                      {busy === `del-${row.id}` ? "…" : "Excluir"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}