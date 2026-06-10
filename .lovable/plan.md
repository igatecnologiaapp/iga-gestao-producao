
# Migração para Lovable Cloud — Plano de Execução

## 1. Ativação do Cloud
- Habilitar Lovable Cloud (provisiona Postgres + Auth + Realtime).
- Desativar confirmação de e-mail (auth via username + senha apenas).

## 2. Schema do banco (migration SQL)

**Enum e tabelas:**
- `app_role` enum: `admin`, `user`
- `profiles` (1:1 com `auth.users`): `id (uuid PK = auth.users.id)`, `username (unique)`, `full_name`, `active`, `must_change_password`, `created_at`
- `user_roles`: `id`, `user_id → auth.users`, `role app_role`, unique(user_id, role)
- `materials`: `id`, `owner_id` (auditoria), `name`, `unit`, `purchase_price`, `purchase_qty`, `category`, `notes`, `created_at`, `updated_at`
- `products`: `id`, `owner_id`, `name`, `unit`, `sale_price`, `category`, `description`, `internal_code`, `barcode`, `notes`, `created_at`, `updated_at`
- `sheet_items`: `id`, `product_id → products (cascade)`, `material_id → materials`, `quantity`, `created_at`
- `audit_log`: `id`, `user_id`, `username`, `event`, `detail`, `device`, `created_at`
- `settings`: `key`, `value jsonb` (preparação para configurações futuras)

**Função SECURITY DEFINER:** `has_role(_user_id, _role)` para evitar recursão em RLS.

**Trigger:** `handle_new_user()` cria automaticamente `profiles` e role padrão `user` ao criar `auth.users`.

## 3. GRANTs e RLS (modelo de acesso compartilhado)

Como o sistema é multiusuário **com dados compartilhados** entre todos os usuários autenticados (ficha técnica de uma empresa), o modelo será:

- `materials`, `products`, `sheet_items`: **todos os usuários autenticados leem e escrevem**; apenas admin pode excluir (ou todos podem — confirmar abaixo).
- `profiles`: usuário lê o próprio; admin lê/edita todos.
- `user_roles`: apenas admin gerencia.
- `audit_log`: apenas admin lê; insert via serverFn.
- `settings`: leitura para autenticados; escrita apenas admin.

GRANTs explícitos para `authenticated` e `service_role` em todas as tabelas. Nenhum acesso `anon`.

## 4. Camada de acesso no app

- Criar `src/lib/cloud/` com hooks tipados que substituem o `useDB()` atual:
  - `useMaterials()`, `useProducts()`, `useAuditLog()`, `useUsers()`
  - Cada hook usa **TanStack Query + Supabase Realtime channels** para invalidar cache em INSERT/UPDATE/DELETE.
- Substituir `db.*` (store local) por funções async que chamam Supabase.
- Manter assinatura próxima do atual para minimizar mudanças nas telas.

## 5. Autenticação username/senha

- `auth.login(username, password)` → `supabase.auth.signInWithPassword({ email: synthEmail(username), password })`
- `auth.createUser(...)` (admin) → serverFn protegida que verifica `has_role('admin')` e usa `supabaseAdmin.auth.admin.createUser({ email: synthEmail(username), password, email_confirm: true, user_metadata: { username, full_name } })`, então insere em `profiles` e `user_roles`.
- `auth.changePassword` → `supabase.auth.updateUser({ password })`
- `auth.toggleActive` → admin atualiza `profiles.active`; login bloqueia se inativo.
- Seed do admin inicial (`admin` / `admin123`, `must_change_password=true`) via migration usando `auth.admin` — ou criado on-demand pela primeira tela de login se ausente.

## 6. Auditoria
- Eventos LOGIN/LOGOUT/CRUD escritos via serverFn `logAudit()` em `audit_log`.
- Tela `/auditoria` consulta tabela ao invés de localStorage.

## 7. Realtime
- Canal único `public:fichatec` ouvindo `materials`, `products`, `sheet_items`, `profiles`, `user_roles`.
- Em cada evento → `queryClient.invalidateQueries(['table_name'])`.

## 8. Migração de dados do localStorage
- Ao primeiro login pós-migração, se houver `fichatec-db-v1` no localStorage e o usuário for admin, oferecer botão "Importar dados locais" em `/configuracoes` que faz upload em lote para o Cloud. Usuários nunca terão dados perdidos sem opção de recuperação.

## 9. Arquivos afetados

**Criados:**
- migration SQL (tabelas, enum, trigger, RLS, GRANTs, seed admin)
- `src/integrations/supabase/...` (gerado pela ativação do Cloud)
- `src/lib/cloud/materials.ts`, `products.ts`, `audit.ts`, `users.ts`
- `src/lib/cloud/realtime.ts`
- `src/lib/admin.functions.ts` (serverFn para criar/editar usuários como admin)
- `src/lib/import-local.ts` (migração localStorage → Cloud)

**Reescritos:**
- `src/lib/store.ts` → wrapper sobre os novos hooks Cloud
- `src/lib/auth.ts` → Supabase Auth com username sintético
- Telas: `materias-primas.tsx`, `produtos.tsx`, `produto.$id.tsx`, `ficha.$id.tsx`, `fichas.tsx`, `relatorios.tsx`, `usuarios.tsx`, `auditoria.tsx`, `login.tsx`, `alterar-senha.tsx`, `configuracoes.tsx`, `__root.tsx`, `index.tsx` — ajuste para async/loading states e Realtime.

## 10. Decisões a confirmar (2 perguntas)

Antes de gerar o código preciso confirmar duas regras de negócio que mudam a forma do RLS:

**A. Visibilidade dos dados:** os cadastros (matérias-primas, produtos, fichas) devem ser:
- (i) **compartilhados** entre todos os usuários da instalação (recomendado — é o caso comum de "uma empresa, vários funcionários"), OU
- (ii) **privados por usuário** (cada um vê só os próprios).

**B. Exclusão:** usuários comuns podem **excluir** matérias-primas / produtos, ou apenas admin?

---

Após confirmação de A e B eu executo a migração inteira em sequência: ativar Cloud → criar schema → reescrever camada de dados → reescrever auth → ativar Realtime → migrar localStorage → validar.
