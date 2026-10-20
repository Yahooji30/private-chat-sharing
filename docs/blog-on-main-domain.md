# Blog at jodbox.com/blog (instead of blog.jodbox.com)

Why: search engines treat `blog.jodbox.com` as a separate site, so links to the articles do not help `jodbox.com`. Under
`jodbox.com/blog` every article, link and visit counts for the main domain. The blog is still the server-rendered site
(fast to index, no "Soft 404"); the app (text sync, files, WebRTC) is not touched.

How it works: nginx sends `/blog/...` to the blog server (port 3001); everything else still goes to the app (port 3000).
The old `blog.jodbox.com/...` addresses redirect permanently to `jodbox.com/blog/...`, page for page.

## 1. Settings

`blog/.env`
```
NUXT_PUBLIC_SITE_URL=https://jodbox.com/blog
NUXT_PUBLIC_APP_URL=https://jodbox.com
NUXT_APP_BASE_URL=/blog/
```
(`NUXT_APP_BASE_URL` is read when the blog is **built**, so build after setting it.)

`frontend/.env`
```
NUXT_PUBLIC_BLOG_URL=https://jodbox.com/blog
```

`backend/.env`
```
NUXT_INTERNAL_URL=http://127.0.0.1:3001/blog
BLOG_ORIGIN=https://jodbox.com/blog
```
(`NUXT_INTERNAL_URL` is where the backend tells the blog to refresh its pages; `BLOG_ORIGIN` is used for IndexNow.)

## 2. nginx

In the `jodbox.com` server block, **above** `location / { ... }`:
```
location = /blog { return 301 /blog/; }
location /blog/ {
  proxy_pass http://127.0.0.1:3001;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```
Replace the `blog.jodbox.com` server blocks with (keep the existing certificate lines):
```
server {
  listen 443 ssl http2;
  server_name blog.jodbox.com;
  # ssl_certificate lines as before
  location = /BingSiteAuth.xml { proxy_pass http://127.0.0.1:3001/blog/BingSiteAuth.xml; }
  location / { return 301 https://jodbox.com/blog$request_uri; }
}
server { listen 80; server_name blog.jodbox.com; return 301 https://jodbox.com/blog$request_uri; }
```
A complete example is in `deploy/nginx.conf`.

## 3. Deploy (in this order)

```bash
cd /var/www/html/private-chat-sharing && git pull && pnpm install --frozen-lockfile
# edit the three .env files above, then:
pnpm build
sudo nginx -t && sudo systemctl reload nginx
pm2 restart all --update-env
```

## 4. Check

- `https://jodbox.com/blog/` shows the blog; open an article and click around (addresses stay under `/blog/`).
- `https://jodbox.com/blog/sitemap.xml`, `https://jodbox.com/blog/rss.xml` open.
- `https://blog.jodbox.com/<any article>` jumps to `https://jodbox.com/blog/<article>` (check the address bar).
- The app (`https://jodbox.com`) still syncs text and files; its **Blog** link opens `/blog/`.

## 5. Search engines

- **Google Search Console** (`jodbox.com` domain property already covers `/blog`): submit `https://jodbox.com/sitemap-index.xml`
  (app + blog files, all on one host now). Later remove the old `blog.jodbox.com` sitemap. Use URL Inspection on a few articles
  and press Request indexing. The 301 redirects tell Google the pages moved.
- **Bing Webmaster Tools**: add (or import from Google) the site `https://jodbox.com`. `https://jodbox.com/BingSiteAuth.xml` is served too.
- **IndexNow**: the key file is now `https://jodbox.com/blog/<key>.txt` (it answers under `/blog`, which is where the articles are).
  Nothing to do except the `BLOG_ORIGIN` setting above.
- **Google Analytics**: same ID, nothing to change.

## Going back

Remove `NUXT_APP_BASE_URL`, set the old addresses in the three `.env` files, restore the old nginx blocks, `pnpm build`, restart.
