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
  email text unique,
  phone text,
  note text,
  can_drive_default boolean not null default false,
  car_capacity_default integer not null default 4 check (car_capacity_default > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid references public.guardians(id) on delete set null,
  name text not null,
  grade text not null default '小1',
  family_group text not null default '',
  parent_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_guardians (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship_label text,
  display_order integer not null check (display_order in (1, 2)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, guardian_id),
  unique (player_id, display_order)
);

create table if not exists public.player_sibling_links (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  sibling_player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (player_id <> sibling_player_id),
  unique (player_id, sibling_player_id)
);

alter table public.guardians
add column if not exists note text;

alter table public.guardians
alter column email drop not null;

alter table public.players
alter column grade drop default;

alter table public.players
alter column grade type text
using (
  case
    when grade::text in ('1', '2', '3', '4', '5', '6') then '小' || grade::text
    when grade::text in ('7', '8', '9') then '中' || (grade::integer - 6)::text
    when grade::text in ('10', '11', '12') then '高' || (grade::integer - 9)::text
    when grade::text in ('年少', '年中', '年長', '小1', '小2', '小3', '小4', '小5', '小6', '中1', '中2', '中3', '高1', '高2', '高3') then grade::text
    else '小1'
  end
);

alter table public.players
alter column grade set default '小1';

insert into public.player_guardians (player_id, guardian_id, relationship_label, display_order)
select id, guardian_id, '保護者1', 1
from public.players
where guardian_id is not null
on conflict (player_id, display_order) do nothing;

insert into public.player_sibling_links (player_id, sibling_player_id)
select player_id, sibling_player_id
from (
  select
    p1.id as player_id,
    p2.id as sibling_player_id,
    row_number() over (partition by p1.id order by p2.name, p2.id) as sibling_order
  from public.players p1
  join public.players p2
    on p1.id <> p2.id
   and coalesce(nullif(p1.family_group, ''), p1.name) = coalesce(nullif(p2.family_group, ''), p2.name)
  where coalesce(nullif(p1.family_group, ''), p1.name) <> p1.name
) grouped_siblings
where sibling_order <= 3
on conflict (player_id, sibling_player_id) do nothing;

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
  staff_ids uuid[] not null default '{}',
  passenger_guardian_ids uuid[] not null default '{}',
  vehicle_type text not null default 'regular' check (vehicle_type in ('regular', 'staff', 'cargo')),
  cargo_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.allocations
add column if not exists staff_ids uuid[] not null default '{}';

alter table public.allocations
add column if not exists passenger_guardian_ids uuid[] not null default '{}';

alter table public.allocations
add column if not exists vehicle_type text not null default 'regular';

alter table public.allocations
add column if not exists cargo_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'allocations_vehicle_type_check'
  ) then
    alter table public.allocations
    add constraint allocations_vehicle_type_check
    check (vehicle_type in ('regular', 'staff', 'cargo'));
  end if;
end;
$$;

update public.allocations
set vehicle_type = 'regular'
where vehicle_type is null;

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'コーチ' check (role in ('監督', 'コーチ', 'その他スタッフ')),
  phone text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  attendance_status text not null default '未回答' check (attendance_status in ('参加', '欠席', '遅刻', '未回答')),
  can_drive boolean not null default false,
  capacity integer not null default 4 check (capacity > 0),
  driver_name text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, staff_id)
);

create index if not exists player_guardians_player_id_idx on public.player_guardians(player_id);
create index if not exists player_guardians_guardian_id_idx on public.player_guardians(guardian_id);
create index if not exists player_sibling_links_player_id_idx on public.player_sibling_links(player_id);
create index if not exists player_sibling_links_sibling_player_id_idx on public.player_sibling_links(sibling_player_id);
create index if not exists staff_attendance_event_id_idx on public.staff_attendance(event_id);
create index if not exists staff_attendance_staff_id_idx on public.staff_attendance(staff_id);
create index if not exists allocations_vehicle_type_idx on public.allocations(vehicle_type);

create or replace function public.enforce_player_guardians_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.player_guardians
    where player_id = new.player_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) >= 2 then
    raise exception '1選手に登録できる保護者は最大2名です。';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_player_guardians_limit_trigger on public.player_guardians;
create trigger enforce_player_guardians_limit_trigger
before insert or update on public.player_guardians
for each row execute function public.enforce_player_guardians_limit();

create or replace function public.enforce_player_siblings_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.player_sibling_links
    where player_id = new.player_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) >= 3 then
    raise exception '1選手に登録できる兄弟は最大3名です。';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_player_siblings_limit_trigger on public.player_sibling_links;
create trigger enforce_player_siblings_limit_trigger
before insert or update on public.player_sibling_links
for each row execute function public.enforce_player_siblings_limit();

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

drop trigger if exists touch_player_guardians_updated_at on public.player_guardians;
create trigger touch_player_guardians_updated_at
before update on public.player_guardians
for each row execute function public.touch_updated_at();

drop trigger if exists touch_attendance_updated_at on public.attendance;
create trigger touch_attendance_updated_at
before update on public.attendance
for each row execute function public.touch_updated_at();

drop trigger if exists touch_allocations_updated_at on public.allocations;
create trigger touch_allocations_updated_at
before update on public.allocations
for each row execute function public.touch_updated_at();

drop trigger if exists touch_staff_updated_at on public.staff;
create trigger touch_staff_updated_at
before update on public.staff
for each row execute function public.touch_updated_at();

drop trigger if exists touch_staff_attendance_updated_at on public.staff_attendance;
create trigger touch_staff_attendance_updated_at
before update on public.staff_attendance
for each row execute function public.touch_updated_at();

alter table public.events enable row level security;
alter table public.guardians enable row level security;
alter table public.players enable row level security;
alter table public.player_guardians enable row level security;
alter table public.player_sibling_links enable row level security;
alter table public.attendance enable row level security;
alter table public.allocations enable row level security;
alter table public.staff enable row level security;
alter table public.staff_attendance enable row level security;

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

drop policy if exists "authenticated admins can manage player guardians" on public.player_guardians;
create policy "authenticated admins can manage player guardians"
on public.player_guardians for all
to authenticated
using (true)
with check (true);

drop policy if exists "public can read player guardians for response links" on public.player_guardians;
create policy "public can read player guardians for response links"
on public.player_guardians for select
to anon, authenticated
using (true);

drop policy if exists "authenticated admins can manage sibling links" on public.player_sibling_links;
create policy "authenticated admins can manage sibling links"
on public.player_sibling_links for all
to authenticated
using (true)
with check (true);

drop policy if exists "public can read sibling links" on public.player_sibling_links;
create policy "public can read sibling links"
on public.player_sibling_links for select
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

drop policy if exists "authenticated admins can manage staff" on public.staff;
create policy "authenticated admins can manage staff"
on public.staff for all
to authenticated
using (true)
with check (true);

drop policy if exists "public can read staff" on public.staff;
create policy "public can read staff"
on public.staff for select
to anon, authenticated
using (true);

drop policy if exists "authenticated admins can manage staff attendance" on public.staff_attendance;
create policy "authenticated admins can manage staff attendance"
on public.staff_attendance for all
to authenticated
using (true)
with check (true);

drop policy if exists "public can read staff attendance" on public.staff_attendance;
create policy "public can read staff attendance"
on public.staff_attendance for select
to anon, authenticated
using (true);

-- 既存環境に入っているデモデータを削除する場合のみ、以下をSQL Editorで個別に実行してください。
-- delete from public.allocations
-- where event_id in (
--   select id from public.events
--   where title in ('春季リーグ 第3戦', '県外交流 遠征')
-- );
--
-- delete from public.attendance
-- where event_id in (
--   select id from public.events
--   where title in ('春季リーグ 第3戦', '県外交流 遠征')
-- )
-- or player_id in (
--   select p.id
--   from public.players p
--   left join public.guardians g on g.id = p.guardian_id
--   where g.email in (
--     'taro-parent@example.com',
--     'minato-parent@example.com',
--     'haruto-parent@example.com',
--     'yuito-parent@example.com'
--   )
-- );
--
-- delete from public.players
-- where guardian_id in (
--   select id from public.guardians
--   where email in (
--     'taro-parent@example.com',
--     'minato-parent@example.com',
--     'haruto-parent@example.com',
--     'yuito-parent@example.com'
--   )
-- )
-- or (name, parent_name) in (
--   ('太郎', '太郎の保護者'),
--   ('蓮', '太郎の保護者'),
--   ('湊', '湊の保護者'),
--   ('陽翔', '陽翔の保護者'),
--   ('結翔', '結翔の保護者'),
--   ('大翔', '結翔の保護者')
-- );
--
-- delete from public.events
-- where title in ('春季リーグ 第3戦', '県外交流 遠征');
--
-- delete from public.guardians
-- where email in (
--   'taro-parent@example.com',
--   'minato-parent@example.com',
--   'haruto-parent@example.com',
--   'yuito-parent@example.com'
-- );

-- 本番データ投入前にデモデータを全削除する場合のみ実行してください。
-- 注意: 以下を実行すると events / guardians / players / attendance / allocations の全データが消えます。
-- delete from public.allocations;
-- delete from public.attendance;
-- delete from public.players;
-- delete from public.guardians;
-- delete from public.events;
