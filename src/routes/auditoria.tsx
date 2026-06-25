import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useAuth, formatDateTime, type AuditEvent } from "@/lib/auth";

export const Route = createFileRoute("/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — FichaTec" }] }),
  component: AuditoriaPage,
});

const labels: Record<AuditEvent, string> = {
  LOGIN: "Login",
  LOGIN_FAIL: "Falha de login",
  LOGOUT: "Logout",
  PASSWORD_CHANGE: "Alteração de senha",
  USER_CREATE: "Criação de usuário",
  USER_UPDATE: "Edição de usuário",
  USER_ACTIVATE: "Usuário ativado",
  USER_DEACTIVATE: "Usuário desativado",
  BACKUP_CREATE: "Backup criado",
  BACKUP_DOWNLOAD: "Backup baixado",
  BACKUP_RESTORE: "Backup restaurado",
  BACKUP_DELETE: "Backup excluído",
  BACKUP_SCHEDULE_UPDATE: "Agendamento de backup",
  BACKUP_AUTO_RUN: "Backup automático executado",
  UNIT_CREATE: "Unidade criada",
  UNIT_UPDATE: "Unidade editada",
  UNIT_DEACTIVATE: "Unidade inativada",
  UNIT_DELETE: "Unidade excluída",
  UNIT_MIGRATION: "Migração de unidades",
};

const tones: Record<AuditEvent, string> = {
  LOGIN: "bg-emerald-100 text-emerald-700",
  LOGIN_FAIL: "bg-destructive/10 text-destructive",
  LOGOUT: "bg-muted text-muted-foreground",
  PASSWORD_CHANGE: "bg-amber-100 text-amber-800",
  USER_CREATE: "bg-primary/10 text-primary",
  USER_UPDATE: "bg-primary/10 text-primary",
  USER_ACTIVATE: "bg-emerald-100 text-emerald-700",
  USER_DEACTIVATE: "bg-destructive/10 text-destructive",
  BACKUP_CREATE: "bg-primary/10 text-primary",
  BACKUP_DOWNLOAD: "bg-muted text-muted-foreground",
  BACKUP_RESTORE: "bg-amber-100 text-amber-800",
  BACKUP_DELETE: "bg-destructive/10 text-destructive",
  BACKUP_SCHEDULE_UPDATE: "bg-primary/10 text-primary",
  BACKUP_AUTO_RUN: "bg-emerald-100 text-emerald-700",
  UNIT_CREATE: "bg-primary/10 text-primary",
  UNIT_UPDATE: "bg-primary/10 text-primary",
  UNIT_DEACTIVATE: "bg-amber-100 text-amber-800",
  UNIT_DELETE: "bg-destructive/10 text-destructive",
  UNIT_MIGRATION: "bg-muted text-muted-foreground",
};

function AuditoriaPage() {
  const { audit, session } = useAuth();

  if (!session || session.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader title="Auditoria" backTo="/" />
        <div className="p-6 text-center text-sm text-muted-foreground">Acesso restrito a administradores.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageHeader title="Auditoria" subtitle={`${audit.length} evento(s) registrados`} backTo="/configuracoes" />
      <div className="space-y-2 px-4 pt-4">
        {audit.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum evento registrado ainda.
          </div>
        )}
        {audit.map((e) => (
          <div key={e.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[e.event]}`}>
                  {labels[e.event]}
                </span>
                <div className="mt-1 truncate text-sm font-semibold">@{e.username}</div>
                {e.detail && <div className="text-xs text-muted-foreground">{e.detail}</div>}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs text-muted-foreground">{formatDateTime(e.timestamp)}</div>
                <div className="text-[10px] text-muted-foreground">{e.device}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}