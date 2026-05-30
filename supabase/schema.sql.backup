-- 少年野球遠征配車アプリ Supabase schema
-- Supabase SQL Editorでこのファイル全体を実行してください。

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type text not null check (event_type in ('練習', '試合', '遠征')),
  starts_at timestamptz not null,
  place text not null default '',
  share_note text,
  allocation_status text not null default 'draft' check (allocation_status in ('draft', 'confirmed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  can_drive_default boolean not null default false,
  car_capacity_default integer not null default 4 check (car_capacity_default > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid references public.guardians(id) on delete set null,
  name text not null,
  grade integer not null default 0,
  family_group text not null default '',
  parent_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  status text not null default '未回答' check (status in ('参加', '欠席', '遅刻', '未回答')),
  guardian_status text not null default '未回答' check (guardian_status in ('参加', '欠席', '遅刻', '未回答')),
  guardian_can_drive boolean not null default false,
  driver_name text,
  car_capacity integer not null default 4 check (car_capacity > 0),
  note text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, player_id)
);

alter table public.attendance
add column if not exists guardian_status text not null default '未回答';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_guardian_status_check'
  ) then
    alter table public.attendance
    add constraint attendance_guardian_status_check
    check (guardian_status in ('参加', '欠席', '遅刻', '未回答'));
  end if;
end;
$$;

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  driver_name text not null,
  car_name text not null,
  capacity integer not null check (capacity > 0),
  player_ids uuid[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_events_updated_at on public.events;
create trigger touch_events_updated_at
before update on public.events
for each row execute function public.touch_updated_at();

drop trigger if exists touch_guardians_updated_at on public.guardians;
create trigger touch_guardians_updated_at
before update on public.guardians
for each row execute function public.touch_updated_at();

drop trigger if exists touch_players_updated_at on public.players;
create trigger touch_players_updated_at
before update on public.players
for each row execute function public.touch_updated_at();

drop trigger if exists touch_attendance_updated_at on public.attendance;
create trigger touch_attendance_updated_at
before update on public.attendance
for each row execute function public.touch_updated_at();

drop trigger if exists touch_allocations_updated_at on public.allocations;
create trigger touch_allocations_updated_at
before update on public.allocations
for each row execute function public.touch_updated_at();

alter table public.events enable row level security;
alter table public.guardians enable row level security;
alter table public.players enable row level security;
alter table public.attendance enable row level security;
alter table public.allocations enable row level security;

-- MVP運用方針:
-- 管理者はSupabase Authログイン済みユーザー。保護者回答URLはanonでも入力可能にしています。
-- 本番で保護者にもAuthを必須化する場合は、anon insert/update policyを削除し、
-- auth.email() = guardians.email の条件に変更してください。

drop policy if exists "authenticated admins can manage events" on public.events;
create policy "authenticated admins can manage events"
on public.events for all
to authenticated
using (true)
with check (true);

drop policy if exists "public can read events" on public.events;
create policy "public can read events"
on public.events for select
to anon, authenticated
using (true);

drop policy if exists "authenticated admins can manage guardians" on public.guardians;
create policy "authenticated admins can manage guardians"
on public.guardians for all
to authenticated
using (true)
with check (true);

drop policy if exists "public can read guardians for response links" on public.guardians;
create policy "public can read guardians for response links"
on public.guardians for select
to anon, authenticated
using (true);

drop policy if exists "authenticated admins can manage players" on public.players;
create policy "authenticated admins can manage players"
on public.players for all
to authenticated
using (true)
with check (true);

drop policy if exists "public can read players for response links" on public.players;
create policy "public can read players for response links"
on public.players for select
to anon, authenticated
using (true);

drop policy if exists "authenticated admins can manage attendance" on public.attendance;
create policy "authenticated admins can manage attendance"
on public.attendance for all
to authenticated
using (true)
with check (true);

drop policy if exists "public can read attendance" on public.attendance;
create policy "public can read attendance"
on public.attendance for select
to anon, authenticated
using (true);

drop policy if exists "public can submit attendance" on public.attendance;
create policy "public can submit attendance"
on public.attendance for insert
to anon, authenticated
with check (true);

drop policy if exists "public can update attendance" on public.attendance;
create policy "public can update attendance"
on public.attendance for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "authenticated admins can manage allocations" on public.allocations;
create policy "authenticated admins can manage allocations"
on public.allocations for all
to authenticated
using (true)
with check (true);

drop policy if exists "public can read confirmed allocations" on public.allocations;
create policy "public can read confirmed allocations"
on public.allocations for select
to anon, authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = allocations.event_id
      and e.allocation_status = 'confirmed'
  )
);

-- サンプルデータ。不要なら実行後に削除してください。
insert into public.guardians (name, email, can_drive_default, car_capacity_default)
values
  ('太郎の保護者', 'taro-parent@example.com', true, 4),
  ('湊の保護者', 'minato-parent@example.com', false, 4),
  ('陽翔の保護者', 'haruto-parent@example.com', true, 5),
  ('結翔の保護者', 'yuito-parent@example.com', true, 4)
on conflict (email) do update set
  name = excluded.name,
  can_drive_default = excluded.can_drive_default,
  car_capacity_default = excluded.car_capacity_default;

insert into public.players (name, grade, family_group, parent_name, guardian_id)
select '太郎', 5, '佐藤', '太郎の保護者', id from public.guardians where email = 'taro-parent@example.com'
on conflict do nothing;
insert into public.players (name, grade, family_group, parent_name, guardian_id)
select '蓮', 5, '佐藤', '太郎の保護者', id from public.guardians where email = 'taro-parent@example.com'
on conflict do nothing;
insert into public.players (name, grade, family_group, parent_name, guardian_id)
select '湊', 4, '田中', '湊の保護者', id from public.guardians where email = 'minato-parent@example.com'
on conflict do nothing;
insert into public.players (name, grade, family_group, parent_name, guardian_id)
select '陽翔', 6, '山本', '陽翔の保護者', id from public.guardians where email = 'haruto-parent@example.com'
on conflict do nothing;
insert into public.players (name, grade, family_group, parent_name, guardian_id)
select '結翔', 4, '高橋', '結翔の保護者', id from public.guardians where email = 'yuito-parent@example.com'
on conflict do nothing;
insert into public.players (name, grade, family_group, parent_name, guardian_id)
select '大翔', 4, '高橋', '結翔の保護者', id from public.guardians where email = 'yuito-parent@example.com'
on conflict do nothing;

insert into public.events (title, event_type, starts_at, place)
values
  ('春季リーグ 第3戦', '試合', '2026-05-24 13:00+09', '市民球場'),
  ('県外交流 遠征', '遠征', '2026-05-30 07:30+09', '中央スポーツ公園')
on conflict do nothing;