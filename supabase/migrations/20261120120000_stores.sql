-- Store locator locations.
--
-- Run this once in a new Supabase project (SQL editor or the Supabase CLI).
-- It creates the stores table, turns on row level security, and lets the
-- public read visible stores only. There is no policy for insert, update,
-- or delete. The Next.js server writes with the service_role key, which
-- bypasses row level security. The anon and publishable keys cannot change
-- rows even if someone finds them.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant usage on schema private to postgres, service_role;

create or replace function private.set_stores_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_stores_updated_at() from public, anon, authenticated;
grant execute on function private.set_stores_updated_at() to postgres, service_role;

create table public.stores (
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

create index stores_visible_idx on public.stores (visible);
create index stores_lat_lng_idx on public.stores (latitude, longitude);

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

create policy "Visible stores are public"
  on public.stores
  for select
  to anon, authenticated
  using (visible = true);

comment on table public.stores is
  'Retail stockists shown on the Form store locator. Public reads are limited to visible rows. Writes go through the Next.js server.';
