create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type text not null default '遠征',
  starts_at timestamptz not null default now(),
  place text not null default '',
  share_note text,
  allocation_status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  note text,
  can_drive_default boolean not null default false,
  car_capacity_default integer not null default 4,
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
  updated_at timestamptz not null default now()
);

create table if not exists public.player_sibling_links (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  sibling_player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (player_id <> sibling_player_id)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  status text not null default '未回答',
  guardian_status text not null default '未回答',
  guardian_can_drive boolean not null default false,
  driver_name text,
  car_capacity integer not null default 4,
  note text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.allocations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  driver_name text not null default '',
  car_name text not null default '',
  capacity integer not null default 4,
  player_ids uuid[] not null default '{}',
  staff_ids uuid[] not null default '{}',
  passenger_guardian_ids uuid[] not null default '{}',
  vehicle_type text not null default 'regular',
  cargo_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'コーチ',
  phone text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  attendance_status text not null default '未回答',
  can_drive boolean not null default false,
  capacity integer not null default 4,
  driver_name text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events add column if not exists event_type text not null default '遠征';
alter table public.events add column if not exists starts_at timestamptz not null default now();
alter table public.events add column if not exists place text not null default '';
alter table public.events add column if not exists share_note text;
alter table public.events add column if not exists allocation_status text not null default 'draft';
alter table public.events add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.events add column if not exists created_at timestamptz not null default now();
alter table public.events add column if not exists updated_at timestamptz not null default now();

alter table public.guardians add column if not exists email text;
alter table public.guardians add column if not exists phone text;
alter table public.guardians add column if not exists note text;
alter table public.guardians add column if not exists can_drive_default boolean not null default false;
alter table public.guardians add column if not exists car_capacity_default integer not null default 4;
alter table public.guardians add column if not exists created_at timestamptz not null default now();
alter table public.guardians add column if not exists updated_at timestamptz not null default now();

alter table public.players add column if not exists guardian_id uuid references public.guardians(id) on delete set null;
alter table public.players add column if not exists grade text not null default '小1';
alter table public.players add column if not exists family_group text not null default '';
alter table public.players add column if not exists parent_name text not null default '';
alter table public.players add column if not exists created_at timestamptz not null default now();
alter table public.players add column if not exists updated_at timestamptz not null default now();

alter table public.attendance add column if not exists guardian_id uuid references public.guardians(id) on delete set null;
alter table public.attendance add column if not exists status text not null default '未回答';
alter table public.attendance add column if not exists guardian_status text not null default '未回答';
alter table public.attendance add column if not exists guardian_can_drive boolean not null default false;
alter table public.attendance add column if not exists driver_name text;
alter table public.attendance add column if not exists car_capacity integer not null default 4;
alter table public.attendance add column if not exists note text;
alter table public.attendance add column if not exists submitted_at timestamptz;
alter table public.attendance add column if not exists created_at timestamptz not null default now();
alter table public.attendance add column if not exists updated_at timestamptz not null default now();

alter table public.allocations add column if not exists guardian_id uuid references public.guardians(id) on delete set null;
alter table public.allocations add column if not exists driver_name text not null default '';
alter table public.allocations add column if not exists car_name text not null default '';
alter table public.allocations add column if not exists capacity integer not null default 4;
alter table public.allocations add column if not exists player_ids uuid[] not null default '{}';
alter table public.allocations add column if not exists staff_ids uuid[] not null default '{}';
alter table public.allocations add column if not exists passenger_guardian_ids uuid[] not null default '{}';
alter table public.allocations add column if not exists vehicle_type text not null default 'regular';
alter table public.allocations add column if not exists cargo_note text;
alter table public.allocations add column if not exists sort_order integer not null default 0;
alter table public.allocations add column if not exists created_at timestamptz not null default now();
alter table public.allocations add column if not exists updated_at timestamptz not null default now();

alter table public.staff add column if not exists role text not null default 'コーチ';
alter table public.staff add column if not exists phone text;
alter table public.staff add column if not exists note text;
alter table public.staff add column if not exists created_at timestamptz not null default now();
alter table public.staff add column if not exists updated_at timestamptz not null default now();

alter table public.staff_attendance add column if not exists attendance_status text not null default '未回答';
alter table public.staff_attendance add column if not exists can_drive boolean not null default false;
alter table public.staff_attendance add column if not exists capacity integer not null default 4;
alter table public.staff_attendance add column if not exists driver_name text;
alter table public.staff_attendance add column if not exists note text;
alter table public.staff_attendance add column if not exists created_at timestamptz not null default now();
alter table public.staff_attendance add column if not exists updated_at timestamptz not null default now();

create index if not exists player_guardians_player_id_idx on public.player_guardians(player_id);
create index if not exists player_guardians_guardian_id_idx on public.player_guardians(guardian_id);
create unique index if not exists player_guardians_player_guardian_unique_idx on public.player_guardians(player_id, guardian_id);
create unique index if not exists player_guardians_player_display_order_unique_idx on public.player_guardians(player_id, display_order);

create index if not exists player_sibling_links_player_id_idx on public.player_sibling_links(player_id);
create index if not exists player_sibling_links_sibling_player_id_idx on public.player_sibling_links(sibling_player_id);
create unique index if not exists player_sibling_links_unique_idx on public.player_sibling_links(player_id, sibling_player_id);

create unique index if not exists attendance_event_player_unique_idx on public.attendance(event_id, player_id);
create index if not exists attendance_event_id_idx on public.attendance(event_id);
create index if not exists attendance_guardian_id_idx on public.attendance(guardian_id);

create index if not exists allocations_event_id_idx on public.allocations(event_id);
create index if not exists allocations_vehicle_type_idx on public.allocations(vehicle_type);

create unique index if not exists staff_attendance_event_staff_unique_idx on public.staff_attendance(event_id, staff_id);
create index if not exists staff_attendance_event_id_idx on public.staff_attendance(event_id);
create index if not exists staff_attendance_staff_id_idx on public.staff_attendance(staff_id);

alter table public.events enable row level security;
alter table public.guardians enable row level security;
alter table public.players enable row level security;
alter table public.player_guardians enable row level security;
alter table public.player_sibling_links enable row level security;
alter table public.attendance enable row level security;
alter table public.allocations enable row level security;
alter table public.staff enable row level security;
alter table public.staff_attendance enable row level security;

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
