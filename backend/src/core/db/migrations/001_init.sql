create table if not exists spaces (
  id text primary key, salt bytea not null,
  created_at timestamptz not null default now(), last_active_at timestamptz not null default now());
create index if not exists spaces_active on spaces(last_active_at);
create table if not exists space_ips (
  ip_hash text primary key, space_id text not null references spaces(id) on delete cascade,
  kind text not null check (kind in ('default','alias')), created_at timestamptz not null default now());
create index if not exists space_ips_space on space_ips(space_id);
create table if not exists devices (
  id text primary key, space_id text references spaces(id) on delete set null,
  name text not null, type text not null, linked_at timestamptz,
  last_seen_at timestamptz not null default now());
create index if not exists devices_space on devices(space_id);
create table if not exists space_text (
  space_id text primary key references spaces(id) on delete cascade,
  content_sealed text not null default '', rev integer not null default 0, updated_at timestamptz not null default now());
create table if not exists space_settings (
  space_id text primary key references spaces(id) on delete cascade, json jsonb not null default '{}');
create table if not exists file_entries (
  id text primary key, space_id text not null references spaces(id) on delete cascade,
  meta_sealed text not null, size bigint not null, block_size integer not null, root_hash text,
  added_by text not null, added_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days');
create index if not exists file_entries_space on file_entries(space_id);
create index if not exists file_entries_exp on file_entries(expires_at);
create table if not exists file_holders (
  file_id text not null references file_entries(id) on delete cascade, device_id text not null,
  primary key (file_id, device_id));
create table if not exists public_pages (
  id text primary key, slug text not null unique,
  owner_space_id text references spaces(id) on delete set null, edit_token_hash text not null,
  title text not null, body_md text not null, body_html text not null,
  indexable boolean not null default false,
  status text not null default 'published' check (status in ('published','unpublished')),
  views integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists public_pages_owner on public_pages(owner_space_id);
create table if not exists page_reports (
  id bigserial primary key, page_id text not null references public_pages(id) on delete cascade,
  reason text not null, ip_hash text not null, created_at timestamptz not null default now(), resolved_at timestamptz);
create index if not exists page_reports_page on page_reports(page_id);
create table if not exists chat_rooms (
  code text primary key, kdf_salt bytea not null, auth_hash text not null, manage_token_hash text not null,
  created_at timestamptz not null default now(), last_active_at timestamptz not null default now());
create index if not exists chat_rooms_active on chat_rooms(last_active_at);
