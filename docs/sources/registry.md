## Реестр разрешённых источников

Цель: зафиксировать, какие источники редакция вправе использовать как сигнал о событии и источник фактов, с каким лимитом переиспользования текста, и с каким статусом проверки. Машиночитаемая версия — `config/sources.yaml` (контракт полей для ingestion-воркера описан в её заголовке, включая поле `status: verified|candidate`).

**Метод проверки (ревью PO, 2026-11-07): `curl -A "<Chrome 131 User-Agent>" -L -m 15 <url>` с Contabo**, НЕ WebFetch — предыдущий прогон через WebFetch давал ложные 403/404 там, где curl с браузерным UA получает 200. Для каждого источника в `notes` указан реальный HTTP-код и Content-Type на момент проверки.

- **verified** — curl с Chrome UA вернул 200 и корректный формат (RSS/Atom/JSON) в этом прогоне → идёт в автополлинг.
- **candidate** — либо антибот/404/403 даже с Chrome UA (Cloudflare/Radware/Akamai), либо формат подтверждён, но условия реюза контента не подтверждены (коммерческое медиа) → **не** включать в автополлинг без повторной ручной проверки/решения PO.

**Итог (FACT-167): 26 источников verified (минимум по AC — 25), 14 candidates.**

## Расширение реестра под общую ленту (FACT-235, 2026-11-08)

Эпик FACT-164 (решение Romana 08.11): общая лента на українській, 12 рубрик, агрегация из многих источников. Задача FACT-235 — добрать реестр до **≥ 70 verified** с покрытием каждой рубрики (минимум 4 источника, из них минимум 1 `usage: facts`).

Добавлены новые поля (контракт — заголовок `config/sources.yaml`): `usage: signal|facts`, `rubrics: [...]` (slug'и из FACT-194), `region` (national — `natsional`, иначе slug области/города). У всех 85 источников (новых и существующих) эти поля заполнены.

**Итог (FACT-235): 72 verified (минимум по AC — 70), 13 candidates.** Проверка — тот же метод, `curl -A "<Chrome/131 UA>" -L -m 15 <url>` с этой машины 2026-11-08; дополнительно для каждого verified-источника проверено, что канал отдаёт реальные `<item>`/`<entry>` (> 0), а не пустой skeleton — несколько фидов (например категорийные `nv.ua/rss/{techno,sport,health,world}.xml`, `zn.ua/rss/*`) формально отдавали HTTP 200 и правильный `Content-Type`, но 0 элементов — такие не включены.

## Аудит и обновление реестра (FACT-338, 2026-11-09)

Цель этого прогона — новый, более строгий бар покрытия (≥ 5 verified-источников на рубрику, из них ≥ 2 `facts`) и повторная живая проверка (`curl -A "<Chrome/131 UA>" -L -m 15 <url>`, Contabo) всех записей, тронутых этим прогоном.

**Регрессия:** `rada_news_uk` (Верховна Рада, facts для `polityka`/`podii`) теперь отдаёт HTTP 200 с **пустым** каналом (0 `<item>`) — было валидно 2026-11-07/08. Понижен `verified` → `candidate` до повторной проверки; не автополлить.

**Добавлено 3 новых verified facts-источника** (curl + Chrome UA с Contabo, 2026-11-09, обнаружены через `<link rel="alternate">`/`href` автодискавери на самих сайтах, не угадыванием путей):
- `ccu_gov_ua_rss` — Конституційний Суд України (`ccu.gov.ua/rss.xml`, 10 items) — закрывает `polityka`+`podii` после регрессии `rada_news_uk`.
- `icrc_general_rss` — ICRC/Міжнародний комітет Червоного Хреста (`icrc.org/en/rss/general`, 100 items) — закрывает `viina` (война/МГП/нейтральная гуманитарная организация).
- `ui_org_ua_rss` — Український інститут при МЗС (`ui.org.ua/feed/`, 12 items) — закрывает `kultura`.

**Проверено и НЕ добавлено (кандидаты/антибот/мёртвый фид в этом прогоне):** mil.gov.ua, dsns.gov.ua, rnbo.gov.ua, gur.gov.ua, nato.int, osce.org, ecdc.europa.eu, unicef.org, moz.gov.ua, phc.org.ua, nszu.gov.ua, nhsu.gov.ua, uaf.ua, noc-ukr.org, sport.gov.ua/mms.gov.ua, fifa.com/uefa.com (гео/антибот-блок с этой машины), олимпийские/паралимпийские комитеты, ukravtodor.gov.ua, ряд обласних держадміністрацій (loda/khoda/odesa/dnipro — 403/таймаут). `kmu.gov.ua/rss` повторно проверен — та же Radware-капча, без изменений.

### Покрытие по рубрикам (verified-источники, после FACT-338)

| Рубрика | Signal | Facts | Всего | Статус |
|---|---|---|---|---|
| Події (`podii`) | 27 | 2 | 29 | ✅ |
| Політика (`polityka`) | 5 | 2 | 7 | ✅ |
| Війна і безпека (`viina`) | 3 | 2 | 5 | ✅ |
| Економіка (`ekonomika`) | 5 | 8 | 13 | ✅ |
| Гроші (`groshi`) | 2 | 3 | 5 | ✅ |
| Світ (`svit`) | 7 | 4 | 11 | ✅ |
| Суспільство (`suspilstvo`) | 7 | 3 | 10 | ✅ |
| Технології (`tekhnolohii`) | 1 | 11 | 12 | ✅ |
| Здоров'я (`zdorovia`) | 4 | 1 | 5 | ⚠️ facts < 2 |
| Спорт (`sport`) | 4 | 1 | 5 | ⚠️ facts < 2 |
| Культура (`kultura`) | 3 | 2 | 5 | ✅ |
| Регіони (`rehiony`) | 22 | 1 | 23 | ⚠️ facts < 2 |

**Открытый гэп (не закрыт в этом прогоне):** `zdorovia`, `sport`, `rehiony` остаются с 1 facts-источником (WHO, upl.ua, uz.gov.ua соответственно) — второй официальный первоисточник для каждой из этих трёх рубрик не найден живым запросом в этом прогоне (МОЗ/ЦГЗ/НСЗУ — антибот/404; Мінмолодьспорту/НОК/УАФ/FIFA/UEFA — антибот/гео-блок; профильного держоргану з регіональними фактами, крім Укрзалізниці, не знайдено). Нужна либо дальнейшая ручная проверка (возможно, из другой сети/с другим UA), либо решение PO — допустить ли временно второй `signal`-источник как смягчение порога для этих трёх рубрик.

**Рубрика «Спорт» закрыта (2026-11-08, решение PO):** facts-источником стал `upl.ua` (Українська Прем'єр-Ліга — официальный организатор чемпионата Украины по футболу, можно цитировать официальные решения лиги — календарь, переносы, санкции — с атрибуцией). `worldathletics.org/rss` проверен и НЕ добавлен: живой фид, но последние записи 2022 года — не актуальный канал. Платный агрегатор спортивных результатов по решению PO НЕ подключаем. Офіційні фіди Мінмолодьспорту (mms.gov.ua), НОК України (noc-ukr.org), УАФ (uaf.ua), FIFA/UEFA/IOC в этом прогоне не отдали валидный актуальный RSS (404/антибот/пустой канал/устаревший) — не включены.

### Что добавлено (сводно, подробности — `config/sources.yaml`)

- **Загальнонаціональні медіа (signal):** УНІАН, ТСН (повна стрічка + рубрики «Гроші», «Світ», «Політика», «Війна», «Україна» — перевірені окремо, не alias на загальну стрічку), NV.ua, Deutsche Welle (укр. служба), Finance.ua, Champion.com.ua, iSport.ua, AIN.UA, Korydor, Читомо, Rubryka.
- **УПЛ (upl.ua, facts):** офіційний організатор чемпіонату України з футболу — закриває sport facts-покриттям (додано 2026-11-08 по рішенню PO).
- **Регіональні медіа (signal, `region` заповнено):** мережа «0XX.ua» (Харків 057.ua, Одеса 048.ua, Дніпро 056.ua, Запоріжжя 061.ua, Кривий Ріг 0564.ua, Вінниця 0432.ua, Чернівці 0372.ua, Суми 0542.ua, Херсон 0552.ua, Миколаїв 0512.ua, Рівне 0362.ua, Чернігів 0412.ua, Меітопольщина 0642.ua), мережа 20minut.ua (Вінниця, Житомир, Тернопіль), 032.ua і Zaxid.net (Львів), Дивись.info (Рівне), Чернігів.LINE. Разом 12+ окремих областей/міст.
- **Державні регулятори та офіційні джерела (facts):** НКЦПФР (nssmc.gov.ua), Мінкультури (mcip.gov.ua), Центр протидії дезінформації при РНБО (cpd.gov.ua), Укрзалізниця (uz.gov.ua/rss — переведено з candidate у verified, знайдено правильний шлях фіда).
- **Міжнародні організації (facts):** UNRIC (представництво ООН у Європі).
- **Громадські/екологічні організації (signal, не facts — НГО, а не держоргани):** Cedos, НЕЦУ, Екодія.

### Госорганы Украины (verified)

| Источник | Тип | Что можно | Terms | Проверка | Вердикт |
|---|---|---|---|---|---|
| Верховна Рада — rss/news.xml | rss | заголовок + факт + ссылка | [rada.gov.ua](https://www.rada.gov.ua) | curl 200, application/xml | можно |
| Укрінформ — rss/block-lastnews | rss | короткая цитата (1-2 предл.) + обязательная ссылка; без полного текста | [about-us](https://www.ukrinform.ua/page-about-us) | curl 200, application/rss+xml | можно с ограничениями |
| Мінприроди (mepr.gov.ua/rss) | rss | заголовок + факт + ссылка | mepr.gov.ua | curl 200, application/rss+xml | можно |
| Мінекономіки (me.gov.ua/rss) | rss | заголовок + факт + ссылка | me.gov.ua | curl 200, application/xml | можно |
| Prozorro — public API tenders | api | публичные данные закупок + ссылка | [open-data](https://prozorro.gov.ua/open-data) | curl 200, application/json | можно |
| data.gov.ua — CKAN API | api | CC BY — обязательная атрибуция | [vidkryti-dani](https://data.gov.ua/pages/vidkryti-dani) | curl 200, application/json;charset=utf-8, 36759 датасетов | можно |
| НБУ — NBUStatService (курси валют) | api | курсы валют + дата + ссылка на bank.gov.ua | [open-data](https://bank.gov.ua/ua/open-data) | curl 200, application/json | можно |

### Госорганы Украины (candidates — не подтверждено живым фидом в этом прогоне)

| Источник | Что случилось | Вердикт |
|---|---|---|
| Кабмін (kmu.gov.ua/rss) | Radware Captcha-страница (антибот, не 403/404) | требует ручной перепроверки, не включать в автополлинг |
| Офіс Президента (president.gov.ua/news.rss) | HTTP 403 Access Denied (похоже на Akamai) | требует ручной перепроверки |
| Мінфін (mof.gov.ua) | RSS-эндпоинт не найден / антибот | требует ручной перепроверки |
| НБУ — новостная лента сайта (bank.gov.ua/ua/news) | Новостного RSS не найдено (для статистики/курсов — см. verified `nbu_exchange_api`) | требует ручной перепроверки для новостей |
| ЦВК (cvk.gov.ua) | RSS не проверен в этом прогоне | требует ручной перепроверки |
| МОЗ (moz.gov.ua) | /rss → 404 | требует ручной перепроверки корректного пути фида |
| Укрзалізниця (uz.gov.ua) | RSS не проверен в этом прогоне | требует ручной перепроверки |
| МЗС (mfa.gov.ua) | RSS не проверен в этом прогоне | требует ручной перепроверки |
| Мінцифри (thedigital.gov.ua) | /rss → 404 | требует ручной перепроверки корректного пути фида |
| Держстат (ukrstat.gov.ua) | Access Denied / таймаут | требует ручной перепроверки; часть данных может быть на data.gov.ua |
| КМДА (kyivcity.gov.ua) | Cloudflare "Just a moment" антибот | требует ручной перепроверки |

### Открытые данные

Prozorro и data.gov.ua теперь **verified** (см. таблицу выше) — прямой curl-запрос подтвердил рабочий API без ключа. МВС open-data регистрации ТЗ ищется через тот же data.gov.ua CKAN `package_search`; точный `id` датасета для CSV регистраций ТЗ не подобран в этом прогоне (`package_show` по предполагаемому id вернул 404) — для Developer (ingestion, stage 2): подобрать правильный slug через `package_search?q=реєстрація+транспортних+засобів` перед интеграцией.

### Международные организации (verified)

| Источник | Тип | Что можно | Terms | Проверка | Вердикт |
|---|---|---|---|---|---|
| UN News — all | rss | короткая цитата + ссылка | [copyright](https://www.un.org/en/about-us/copyright) | curl 200, application/rss+xml | можно с ограничениями |
| WHO — news-english | rss | короткая цитата + ссылка | [copyright](https://www.who.int/about/policies/publishing/copyright) | curl 200, application/rss+xml | можно с ограничениями |
| IAEA — topnews | rss | короткая цитата + ссылка | [terms-of-use](https://www.iaea.org/about/terms-of-use) | curl 200, application/rss+xml | можно с ограничениями |
| European Commission — Press Corner | rss | Decision 2011/833/EU — реюз с указанием источника | [legal-notice](https://commission.europa.eu/legal-notice_en) | curl 200, application/rss+xml | можно |
| European Central Bank — press | rss | факты своими словами + ссылка | [disclaimer](https://www.ecb.europa.eu/home/disclaimer/html/index.en.html) | curl 200, application/rss+xml | можно |
| Eurostat — dissemination API | api | статистика с указанием источника Eurostat | [copyright-notice](https://ec.europa.eu/eurostat/web/main/help/copyright-notice) | curl 200, application/json | можно |

### Официальные СМИ / агентства (verified, кроме помеченных candidate)

| Источник | Тип | Что можно | Terms | Проверка | Вердикт |
|---|---|---|---|---|---|
| BBC News Україна | rss | краткое цитирование (неск. предл.) + ссылка | [reuse-content](https://www.bbc.co.uk/usingthebbc/terms/can-i-reuse-content-from-a-bbc-website/) | curl 200, text/xml | можно с ограничениями |
| Euronews | rss | краткое цитирование + ссылка | [terms-conditions](https://www.euronews.com/terms-conditions) | curl 200, text/xml | можно с ограничениями |

**Candidates (коммерческие СМИ, фид технически работает, условия реюза не подтверждены — эскалация перед включением):**

| Источник | Проверка | Вердикт |
|---|---|---|
| Українська правда (pravda.com.ua/rss) + epravda.com.ua, life.pravda.com.ua | curl 200, application/rss+xml — формат подтверждён | ⚠️ эскалация Roman: коммерческое медиа, условия реюза неизвестны |
| 24 Канал (24tv.ua/rss/all.xml) | curl 200, application/xml | ⚠️ эскалация Roman: условия реюза не найдены |
| Громадське (hromadske.ua) | RSS не найден (404 на стандартных путях) | требует ручной проверки |

**Явно исключено (не кандидат, не verified):** TASS (tass.com) технически отдал HTTP 200 валидному RSS, но это российское государственное пропагандистское издание — использование как источника для украинской аудитории неприемлемо по редакционной политике проекта. Исключено осознанно, не из-за технической проверки.

### Tech press (verified)

| Источник | Тип | Что можно | Terms | Проверка |
|---|---|---|---|---|
| Google — blog.google | press | факты своими словами + ссылка | about.google brand resources | curl 200 |
| Apple Newsroom | press | факты своими словами + ссылка | apple.com/legal | curl 200 |
| Microsoft News Center | press | факты своими словами + ссылка | news.microsoft.com/terms-of-use | curl 200 |
| Mozilla Blog | press | факты своими словами + ссылка (часть контента CC BY 3.0) | mozilla.org/about/legal/terms | curl 200 |
| GitHub Blog | press | факты своими словами + ссылка | github.com ToS | curl 200 |
| Android Developers Blog | press | факты своими словами + ссылка | developer.android.com/terms | curl 200 (финальный ответ после редиректов) |
| Cloudflare Blog | press | факты своими словами + ссылка | cloudflare.com/website-terms | curl 200 |
| Meta Newsroom | press | факты своими словами + ссылка | about.meta.com brand resources | curl 200 |
| Samsung Newsroom (Global) | press | факты своими словами + ссылка | news.samsung.com/global/terms-of-use | curl 200 |
| Spotify Newsroom | press | факты своими словами + ссылка | spotify.com/legal | curl 200 |
| AWS News Blog | press | факты своими словами + ссылка | aws.amazon.com/terms | curl 200 |

### Эскалация Roman (юридические вопросы / требуют аккаунта или ключа)

- **Українська правда / epravda / life.pravda (RSS)** — коммерческое медиа, фид работает, но условия реюза не подтверждены — не включать в пайплайн без решения Roman.
- **24 Канал (24tv.ua)** — то же: фид работает, условия не найдены.
- **Укрінформ (полноценная лента, не короткое цитирование)** — платная подписка на новостную ленту — не покупать без решения Roman; для бесплатного режима используем только короткое цитирование + ссылку (уже в verified).
- Prozorro и data.gov.ua API в этом прогоне подтверждены как публичные и бесключевые — эскалация **не требуется** (снято по итогам ревью PO).
- Pexels/Unsplash — по решению PO, для MVP **не нужны** (используем Wikimedia Commons и собственные изображения), эскалация снята.

## Аудит живого ingestion на sandbox (FACT-338, 2026-11-09)

Доступ к `sources`/`source-items`/`events` в Payload admin требует логина (`access.read: !!req.user`), пароли демо-аккаунтов (`SEED_ADMIN_PASSWORD`/`SEED_DEMO_PASSWORD`) — секреты в Dokploy env, этому агенту не выданы; прямого DB/SSH-доступа к Dokploy-хосту нет (см. `docs/deploy.md`: «нет Dokploy exec/SSH access»). Поэтому точные `source_items`/`events` за 24 ч по источнику **не получены** — это открытый блокер для полноты пункта 1/4 скоупа, см. «Чего не хватает» ниже. Публично проверено то, что доступно без логина:

- **Публичный `GET /api/articles`** (`access.read` открыт для `published`): `totalDocs: 4` — те же 4 demo-статьи из seed (FACT-170/204), созданные 2026-11-08, у каждой `event: null`. **Ни одной статьи, пришедшей из ingestion-пайплайна, на sandbox нет**, хотя `docker-compose.yml` задаёт `INGEST_ENABLED: "true"`.
- `sitemap.xml`, `news-sitemap.xml`, `feed.xml` — тот же результат, 4 URL/items, те же demo-статьи.
- `/review` (очередь ручной проверки, FACT-236) отдаёт 308 (редирект на логин) без сессии — нельзя проверить, есть ли там необработанные драфты.
- `GET /api/sources`, `/api/source-items`, `/api/events` — 403 без логина (ожидаемо по access-правилам).

**Вывод:** на момент этого прогона пайплайн **не производит публикаций** (0 за всё время, не только за 24 ч). Причину не удалось установить без доступа к worker-логам/admin — варианты для Developer/DevOps проверить: (а) `worker`-контейнер на Dokploy не передеплоен с актуальным образом после FACT-236/287 (может всё ещё быть pre-ingest сборкой); (б) события не доходят до `independent_confirmation` (`EVENT_CONFIRMATION_MIN_SOURCES=2`) из-за `rada_news_uk`-регрессии и общей тонкости facts-покрытия в части рубрик (см. выше); (в) драфты создаются, но лежат в `/review` необработанными — без логина не видно. Это нужно проверить Developer/DevOps с реальным доступом (worker logs, admin login) — не определяется с моей стороны.

### Admin-журнал источников (FACT-345, закрыто)

`src/collections/Sources.ts` теперь хранит, помимо `last_polled_at`/`last_success_at`/`last_error`/`consecutive_errors`:

- `last_http_status` — HTTP-статус последнего опроса (`304`/`200`/`503`/... или `null`, когда ответа не было вовсе — robots.txt disallow, timeout, DNS-ошибка).
- `last_fetched` / `last_stored` — сколько items последний опрос вернул (до дедупа) и сколько реально сохранил (после дедупа).
- `items_24h` / `items_7d` — сколько `source_items` этого источника сохранено за последние 24ч/7д (агрегат по `source-items.fetched_at`, пересчитывается на каждом опросе в `pollSource.ts`).

Все пять полей пишутся на каждый исход опроса (успех, `not_modified`, ошибка, robots.txt-блок) — см. `src/jobs/ingest/pollSource.ts`. Видны как колонки в `/admin/collections/sources` (`admin.defaultColumns`). Миграция: `src/migrations/20261109_200000_fact345_sources_status.ts`.

### Общее правило для источников со статусом `candidate`

Статус `candidate` не означает «нельзя» — значит, что фид технически не подтверждён прямым запросом (вероятнее всего WAF/антибот у части украинских госсайтов, не связанный с ToS) или что реюз-условия коммерческого источника не подтверждены. Developer (ingestion, stage 2) не должен включать такие источники в постоянный cron без отдельной перепроверки/решения PO.
