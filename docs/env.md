# Environment variables

| Name | Required | Example | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | `postgres://user:pass@host:5432/newsroom` | Postgres connection string. |
| `PAYLOAD_SECRET` | yes | (random 32+ char string) | Never commit a real value. |
| `SITE_URL` | yes | `https://news-sandbox.bigear.uk` | Used for canonical URLs, sitemap, OG, RSS. |
| `SITE_NAME` | yes | `Newsroom (sandbox)` | Brand name is not finalized yet; keep generic. |
| `NOINDEX` | yes | `true` | While `true`: `noindex,nofollow` on every page, `X-Robots-Tag: noindex` on sitemap/feed, `Disallow: /` in robots.txt. Must stay `true` for every sandbox deployment. |
| `ANALYTICS_ENABLED` | no | `false` | Enables the `/api/analytics/scroll` endpoint and page_views tracking. No cookies/consent banner either way. |
| `TAG_NOINDEX_THRESHOLD` | no | `3` | Tags with fewer published articles than this are marked `noindex`. |

No secret values are committed anywhere in this repo — only variable names, in `.env.example`.
