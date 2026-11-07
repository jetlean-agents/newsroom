# Технічне ТЗ для Developer — SEO-каркас новинного ресурсу

Контекст: sandbox-проект на `*.bigear.uk`, фокус і мова — за рекомендацією в `demand.md` (Tech + лайфхаки, UA), структура рубрик — `structure.md`. Весь sandbox — **noindex** per правило епіку; нижче — правила, які діють «якщо/коли» проєкт піде в прод (щоб каркас одразу будувався правильно і не переробляти).

## 1. Canonical
- Кожна сторінка статті: `<link rel="canonical" href="https://<domain>/{rubric-slug}/{article-slug}/">` — self-canonical, без параметрів (utm, sort, page) у canonical URL.
- Пагінація рубрики (`/page/2/` і далі): canonical на себе (не на page/1) — це різні набори контенту, об'єднувати canonical'ом на першу сторінку не потрібно.
- Сторінки з UTM/sort/filter-параметрами: canonical без параметрів, сама URL з параметрами — **noindex,follow**.

## 2. Breadcrumbs (BreadcrumbList)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Головна", "item": "https://<domain>/"},
    {"@type": "ListItem", "position": 2, "name": "Інструкції", "item": "https://<domain>/instrukcii/"},
    {"@type": "ListItem", "position": 3, "name": "Як перевірити швидкість інтернету", "item": "https://<domain>/instrukcii/yak-pereviryty-shvydkist-internetu/"}
  ]
}
```

## 3. NewsArticle / Article JSON-LD
Використовувати `Article` (не `NewsArticle`) для evergreen-пояснялок/гайдів (вони не «новина дня»); `NewsArticle` — тільки для матеріалів, що реально прив'язані до конкретної новинної події з датою.

**Обов'язкові поля, тільки реальні значення:**
- `headline`, `description`
- `datePublished` — реальна дата першої публікації, незмінна.
- `dateModified` — **тільки** при реальній зміні контенту (факт, цифра, формулювання). Проставляти штучно для «освіження» — заборонено правилом епіку.
- `author` — реальний редактор (`Person`, з `name`) **або** `Organization` (видання), якщо немає конкретного автора, якого можна назвати. Ніяких вигаданих імен/псевдо-експертів.
- `publisher` — `Organization` з `name`, `logo` (ImageObject, реальний логотип, не плейсхолдер).
- `image` — реальне зображення статті (фото з атрибуцією першоджерела або явно підписана AI-ілюстрація, див. правило епіку — не псевдо-фото реальних подій/війни/осіб).
- `mainEntityOfPage` = canonical URL.

Приклад (Article, evergreen-гайд):
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Як перевірити швидкість інтернету і що робити, якщо вона низька",
  "description": "...",
  "datePublished": "2026-11-10T09:00:00+02:00",
  "dateModified": "2026-11-10T09:00:00+02:00",
  "author": {"@type": "Organization", "name": "<Назва видання>"},
  "publisher": {
    "@type": "Organization",
    "name": "<Назва видання>",
    "logo": {"@type": "ImageObject", "url": "https://<domain>/logo.png"}
  },
  "image": ["https://<domain>/media/speedtest.jpg"],
  "mainEntityOfPage": "https://<domain>/instrukcii/yak-pereviryty-shvydkist-internetu/"
}
```

## 4. Organization / Publisher
На головній сторінці та/або `about`-сторінці — `Organization` schema: `name`, `url`, `logo`, `sameAs` (реальні соцмережі, якщо є). Без вигаданих контактів/адрес.

## 5. XML sitemap + news sitemap
- **Основний sitemap index** (`/sitemap.xml`) з розбиттям по типу (статті/рубрики), не більше 50 000 URL / 50MB на файл (стандартний ліміт протоколу sitemap).
- **News sitemap** (`/news-sitemap.xml`) — тільки статті за останні **48 годин**, максимум 1000 `<news:news>` записів на файл (ліміт Google), автоматично виключати статті старші 48г.
- `lastmod` — тільки при реальній зміні даних/контенту сторінки (ніколи «на всякий випадок» при кожному деплої).
- Канонічні, індексовані (не noindex) URL тільки в sitemap. Thin/noindex сторінки (теги <30 статей, пагінація 2+, пошук) — **не включати в sitemap**.
- У sandbox — sitemap генерується, але все одно весь сайт noindex (ENV-флаг, див. п.8); sitemap корисний для внутрішнього QA (перевірка структури), не для реальної індексації зараз.

## 6. RSS
- `/rss.xml` (або per-рубрика `/instrukcii/rss.xml`) — останні ~20-50 статей, стандартні поля (`title`, `link`, `pubDate`, `description`, `guid`).

## 7. OpenGraph / Twitter Cards
На кожній статті:
- `og:title`, `og:description`, `og:image` (реальне зображення, мін. 1200×630), `og:type=article`, `og:url` (= canonical).
- `article:published_time`, `article:modified_time`.
- `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`.

## 8. Robots / noindex-правила

**Sandbox (поточний стан, обов'язково):**
- Весь сайт — `noindex, nofollow` через HTTP-заголовок `X-Robots-Tag` або meta-тег, що включається/вимикається **ENV-прапорцем** (наприклад `SEO_INDEXABLE=false` на sandbox, `true` лише на майбутньому проді після явного рішення Романа). Один прапорець має перемикати: meta robots на всіх сторінках, `disallow: /` у `robots.txt`, і статус sitemap/feed (не віддавати їх ботам або явно позначити як недоступні для індексації).
- `robots.txt` на sandbox: `User-agent: *` / `Disallow: /`.

**Правила для майбутнього продакшн-стану (закласти в код зараз, щоб не переробляти):**
- Thin-сторінки: теги/підрубрики з **< 30 статей** → `noindex, follow` (винесено з того ж принципу, що в проєкті «Авто-трафик» — thin pages: < 30 точок даних → noindex,follow) і не в sitemap.
- Пагінація архіву рубрики, сторінка 2+ → `noindex, follow`.
- Внутрішній пошук (`/search?q=...`) → `noindex, follow`, не в sitemap.
- URL з параметрами (utm/sort/filter) → `noindex, follow` (canonical без параметрів, див. п.1).
- 404 для видалених/не знайдених статей; **410 Gone** для статей, які видалено навмисно і остаточно (не 404) — сигналізує пошуковику не повертатись до перевірки.
- Корисні AI-краулери (GPTBot, PerplexityBot тощо) — **не блокувати** в `robots.txt` без окремого рішення PO/Романа (навіть коли сайт стане indexable) — рамка з ролі SEO-стратега.

## 9. Core Web Vitals бюджет (mobile, Lighthouse/PSI)
Ціль — **≥ 90** по Performance/SEO/Best Practices/Accessibility (Lighthouse mobile), конкретні метрики:
- **LCP** ≤ 2.5s
- **INP** ≤ 200ms
- **CLS** ≤ 0.1
- SSR/SSG для контенту статей (рендер без JS повинен показувати повний текст і базову структуру — перевірка `curl` без виконання JS має віддавати readable HTML, не порожній `<div id="root">`).
- Зображення: сучасні формати (WebP/AVIF), `width`/`height` атрибути (уникнення CLS), lazy-load нижче fold.
- Мінімізація блокуючого JS/CSS на критичному шляху рендеру article-сторінки.

Аудит після деплою на sandbox: `npx lighthouse <url> --preset=mobile` або PSI API (без ключа через публічний endpoint з обмеженим rate-limit) — результати додати до PR/issue з конкретними числами LCP/INP/CLS/балів.

## 10. Метрики реального читання (без dark patterns)
- Глибина скролу (25/50/75/100%) — стандартна подія аналітики (Umami custom event), без штучного зациклення на скрол для «накручування» часу на сторінці.
- Клік «наступна стаття» / клік по блоку «Пов'язані матеріали» — подія кліку.
- **Без:** автододавання фейкового лічильника переглядів, без штучного підвищення dateModified, без infinite-scroll pop-up, що блокує контент до скролу/підписки.

## Критерії приймання (QA-перевірка після деплою)
- `curl -I <article-url>` — коректний статус, правильний `X-Robots-Tag` відповідно до ENV (на sandbox — завжди noindex).
- `curl <article-url>` без виконання JS — текст статті, breadcrumbs, title/H1 присутні в HTML (SSR).
- Schema-валідація кожного шаблону (Article/NewsArticle, BreadcrumbList, Organization) через Rich Results Test / validator.schema.org — без помилок.
- `sitemap.xml` та `news-sitemap.xml` валідні за протоколом (перевірка XML-схемою), не містять noindex/thin URL.
- Lighthouse mobile ≥ 90 по всіх 4 категоріях — цифри додаються до PR.
- `robots.txt` на sandbox — повний `Disallow: /`; перемикання ENV-прапорця підтверджено тестом (indexable=false → noindex всюди, indexable=true → правила thin/pagination/search з цього документа).
