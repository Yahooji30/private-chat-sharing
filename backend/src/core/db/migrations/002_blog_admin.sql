create table if not exists admins (
  id text primary key, email text not null unique, name text not null, password_hash text not null,
  totp_secret_sealed text, totp_enabled boolean not null default false,
  role text not null check (role in ('owner','admin')), created_at timestamptz not null default now());
create table if not exists admin_sessions (
  token_hash text primary key, admin_id text not null references admins(id) on delete cascade,
  csrf text not null, expires_at timestamptz not null, ip_hash text not null, ua text not null default '',
  created_at timestamptz not null default now());
create index if not exists admin_sessions_admin on admin_sessions(admin_id);
create index if not exists admin_sessions_exp on admin_sessions(expires_at);
create table if not exists audit_log (
  id bigserial primary key, admin_id text, admin_email text not null, action text not null, target text not null default '',
  created_at timestamptz not null default now());
create index if not exists audit_log_created on audit_log(created_at desc);
create table if not exists categories (
  id text primary key, slug text not null unique, name text not null, description text not null default '');
create table if not exists tags (id text primary key, slug text not null unique, name text not null);
create table if not exists media (
  id text primary key, filename text not null, mime text not null, width integer not null, height integer not null,
  bytes integer not null, variants_json jsonb not null, alt text not null default '', created_at timestamptz not null default now());
create table if not exists articles (
  id text primary key, slug text not null unique, title text not null, excerpt text not null default '',
  body_md text not null default '', body_html text not null default '', toc_json jsonb not null default '[]',
  cover_media_id text references media(id) on delete set null, og_media_id text references media(id) on delete set null,
  category_id text references categories(id) on delete set null, author_admin_id text references admins(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  publish_at timestamptz, published_at timestamptz, seo_title text not null default '', seo_description text not null default '',
  reading_min integer not null default 1,
  search tsvector generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(body_md,''))) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists articles_status_pub on articles(status, published_at desc);
create index if not exists articles_search on articles using gin(search);
create index if not exists articles_category on articles(category_id);
create index if not exists articles_cover on articles(cover_media_id);
create index if not exists articles_og on articles(og_media_id);
create table if not exists article_tags (
  article_id text not null references articles(id) on delete cascade, tag_id text not null references tags(id) on delete cascade,
  primary key (article_id, tag_id));
create index if not exists article_tags_tag on article_tags(tag_id);
create table if not exists ad_slots (key text primary key, enabled boolean not null default false, html text not null default '');
create table if not exists site_settings (key text primary key, value text not null default '');
insert into ad_slots (key) values ('top-banner'), ('sidebar'), ('in-article'), ('footer') on conflict do nothing;
