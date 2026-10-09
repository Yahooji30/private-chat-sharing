create table if not exists faqs (
  id text primary key, question text not null, answer_md text not null, answer_html text not null,
  category text not null default '', position integer not null default 0, published boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists faqs_order on faqs(published, position);
create table if not exists feedback (
  id bigserial primary key, name text not null default '', email text not null default '',
  rating smallint not null check (rating between 1 and 5), message text not null,
  status text not null default 'new' check (status in ('new','read','archived')), public boolean not null default false,
  ip_hash text not null, created_at timestamptz not null default now());
create index if not exists feedback_created on feedback(created_at desc);
create index if not exists feedback_public on feedback(created_at desc) where public;
create table if not exists seo_pages (
  key text primary key, title text not null default '', description text not null default '', keywords text not null default '',
  og_title text not null default '', og_description text not null default '', og_media_id text references media(id) on delete set null,
  canonical text not null default '', noindex boolean not null default false, updated_at timestamptz not null default now());
create index if not exists seo_pages_og on seo_pages(og_media_id);
