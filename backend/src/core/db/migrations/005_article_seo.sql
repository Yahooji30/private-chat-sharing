-- per-article search settings: keywords, "keep out of search results", and an own canonical address
alter table articles add column if not exists seo_keywords text not null default '';
alter table articles add column if not exists seo_noindex boolean not null default false;
alter table articles add column if not exists seo_canonical text not null default '';
-- sitemap files are cut by position, so listing them in a stable order must be cheap
create index if not exists articles_sitemap on articles (published_at, id) where status = 'published' and seo_noindex = false;
