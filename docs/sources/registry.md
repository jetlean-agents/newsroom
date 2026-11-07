## Реестр разрешённых источников

Цель: зафиксировать, какие источники редакция вправе использовать как сигнал о событии и источник фактов, с каким лимитом переиспользования текста, и с каким статусом проверки. Машиночитаемая версия — `config/sources.yaml` (контракт полей для ingestion-воркера описан в её заголовке, включая поле `status: verified|candidate`).

**Метод проверки (ревью PO, 2026-11-07): `curl -A "<Chrome 131 User-Agent>" -L -m 15 <url>` с Contabo**, НЕ WebFetch — предыдущий прогон через WebFetch давал ложные 403/404 там, где curl с браузерным UA получает 200. Для каждого источника в `notes` указан реальный HTTP-код и Content-Type на момент проверки.

- **verified** — curl с Chrome UA вернул 200 и корректный формат (RSS/Atom/JSON) в этом прогоне → идёт в автополлинг.
- **candidate** — либо антибот/404/403 даже с Chrome UA (Cloudflare/Radware/Akamai), либо формат подтверждён, но условия реюза контента не подтверждены (коммерческое медиа) → **не** включать в автополлинг без повторной ручной проверки/решения PO.

**Итог: 26 источников verified (минимум по AC — 25), 14 candidates.**

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

### Общее правило для источников со статусом `candidate`

Статус `candidate` не означает «нельзя» — значит, что фид технически не подтверждён прямым запросом (вероятнее всего WAF/антибот у части украинских госсайтов, не связанный с ToS) или что реюз-условия коммерческого источника не подтверждены. Developer (ingestion, stage 2) не должен включать такие источники в постоянный cron без отдельной перепроверки/решения PO.
