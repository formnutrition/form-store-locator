-- Store locator locations.
--
-- ALREADY APPLIED to the landers Supabase project
-- (ref fadwglwxcbufjdivqapt, region eu-central-2), table public.stores.
-- The columns, indexes, row level security and the public read policy
-- below are already there. Do not treat this file as a reason to create
-- another Supabase project.
--
-- Running it again is safe. It will not drop the table or the rows.
-- The private schema already existed in landers, so this file does not
-- change grants on that schema.

create or replace function private.set_stores_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_stores_updated_at() from public, anon, authenticated;
grant execute on function private.set_stores_updated_at() to postgres, service_role;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  stockist_id text not null unique,
  name text not null,
  address_line_1 text not null default '',
  address_line_2 text not null default '',
  city text not null default '',
  state text not null default '',
  postal_code text not null default '',
  country text not null default '',
  phone text not null default '',
  website text not null default '',
  email text not null default '',
  logo_url text not null default '',
  notes text not null default '',
  priority integer,
  visible boolean not null default true,
  latitude double precision,
  longitude double precision,
  geocoded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_latitude_range check (
    latitude is null or (latitude >= -90 and latitude <= 90)
  ),
  constraint stores_longitude_range check (
    longitude is null or (longitude >= -180 and longitude <= 180)
  )
);

create index if not exists stores_visible_idx on public.stores (visible);
create index if not exists stores_lat_lng_idx on public.stores (latitude, longitude);

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
  before update on public.stores
  for each row
  execute function private.set_stores_updated_at();

alter table public.stores enable row level security;
alter table public.stores force row level security;

-- Default privileges on an existing Supabase project grant every operation
-- to anon and authenticated. Take those back, then allow read only.
revoke all on table public.stores from public, anon, authenticated;
grant select on table public.stores to anon, authenticated;
grant select, insert, update, delete on table public.stores to service_role;

drop policy if exists "Visible stores are public" on public.stores;
create policy "Visible stores are public"
  on public.stores
  for select
  to anon, authenticated
  using (visible = true);

comment on table public.stores is
  'Retail stockists shown on the Form store locator. Public reads are limited to visible rows. Writes go through the Next.js server.';
