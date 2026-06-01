-- 掌柜 AI — Supabase schema + RLS（多租户隔离）
-- 在 Supabase 控制台 → SQL Editor 贴上整段执行即可。可重复执行（幂等）。

-- ───────────────────────── profiles ─────────────────────────
-- 一个登入帐号一行；tenant_id 代表「这家餐厅」。
-- 老板注册 → tenant_id = 自己的 user id；日后要加员工，把员工 profile 的 tenant_id 设成老板的即可共用资料。
create table if not exists public.profiles (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  tenant_id       uuid not null,
  email           text,
  restaurant_name text,
  created_at      timestamptz not null default now()
);

create index if not exists profiles_tenant_idx on public.profiles (tenant_id);

-- ──────────────────────── data_documents ────────────────────────
-- 每个 localStorage key 在云端存成一行 jsonb；按 (tenant_id, key) 唯一。
create table if not exists public.data_documents (
  tenant_id  uuid not null,
  key        text not null,
  payload    jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- ─────────────────────────── RLS ───────────────────────────
alter table public.profiles      enable row level security;
alter table public.data_documents enable row level security;

-- profiles：只能读写自己那一行
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (user_id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- data_documents：只能读写「属于自己 tenant」的资料
drop policy if exists "documents_rw_own_tenant" on public.data_documents;
create policy "documents_rw_own_tenant" on public.data_documents
  for all
  using (tenant_id in (select p.tenant_id from public.profiles p where p.user_id = auth.uid()))
  with check (tenant_id in (select p.tenant_id from public.profiles p where p.user_id = auth.uid()));

-- ───────────────── 注册时自动建立 profile ─────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, tenant_id, email)
  values (new.id, new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
