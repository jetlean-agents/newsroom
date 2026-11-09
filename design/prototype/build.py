#!/usr/bin/env python3
"""Генерує статичні HTML-прототипи (design/prototype/*.html).

Тексти — демонстраційні заглушки для макета: не факти, не цитати, без реальних осіб.
Запуск: python3 design/prototype/build.py
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, '..', 'logo')

RUBRICS = [
    ('podii', 'Події'), ('polityka', 'Політика'), ('viina', 'Війна і безпека'),
    ('ekonomika', 'Економіка'), ('groshi', 'Гроші'), ('svit', 'Світ'),
    ('suspilstvo', 'Суспільство'), ('tekhnolohii', 'Технології'), ('zdorovia', "Здоров’я"),
    ('sport', 'Спорт'), ('kultura', 'Культура'), ('rehiony', 'Регіони'),
]
RNAME = dict(RUBRICS)


def svg_file(name, cls):
    s = open(os.path.join(LOGO, name), encoding='utf-8').read()
    s = re.sub(r' width="\d+" height="\d+"', '', s, count=1)
    return s.replace('<svg ', f'<svg class="{cls}" aria-hidden="true" ', 1).replace('role="img" ', '')


WORDMARK = svg_file('wordmark-inverse.svg', 'wordmark')
WORDTYPE = svg_file('wordtype.svg', 'wordtype')

I_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>'
I_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h12"/></svg>'
I_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>'
I_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>'
I_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'

# ── Демо-контент ──────────────────────────────────────────────────────
TOP = dict(r='ekonomika', t='Уряд змінив правила компенсації за енергоефективний ремонт: що тепер потрібно власникам квартир',
           lead='Подати заявку можна онлайн, а частку компенсації для ОСББ збільшили. Пояснюємо, хто має право, які документи потрібні і скільки чекати на рішення.',
           time='14:32', date='9 листопада 2026')
MAIN = [
    dict(r='groshi', t='Тарифи на електроенергію для населення: що зміниться з 1 грудня', time='13:55'),
    dict(r='svit', t='Міністри енергетики країн ЄС погодили новий пакет підтримки енергосистеми', time='13:20'),
    dict(r='zdorovia', t='Сезон грипу: коли звертатися до лікаря і як записатися онлайн', time='12:40'),
    dict(r='tekhnolohii', t='Як увімкнути вертикальні вкладки в браузері: коротка інструкція', time='11:15'),
]
FEED = [
    dict(r='podii', t='Енергетики оприлюднили графіки відключень на 10 листопада', time='16:05', urgent=True),
    dict(r='groshi', t='Офіційний курс гривні на 10 листопада: що змінилося', time='15:48'),
    dict(r='rehiony', t='На Львівщині відкрили ще один центр надання адмінпослуг', time='15:30'),
    dict(r='ekonomika', t='Мінфін розмістив облігації внутрішньої позики на 12 млрд грн', time='14:57', upd=True),
    dict(r='kultura', t='Національна опера представила програму зимового сезону', time='14:40'),
    dict(r='svit', t='Саміт у Брюсселі: про що домовилися міністри енергетики', time='14:22'),
    dict(r='suspilstvo', t='МОН оприлюднило графік реєстрації на НМТ-2027', time='14:05'),
    dict(r='tekhnolohii', t='Мобільні оператори попередили про перебої зв’язку в трьох областях', time='13:48'),
    dict(r='zdorovia', t='Безоплатну вакцинацію від грипу продовжили до кінця грудня', time='13:30'),
    dict(r='sport', t='Біатлон: розклад гонок першого етапу Кубка світу', time='13:12'),
]
FEED_YESTERDAY = [
    dict(r='polityka', t='Комітет Ради підтримав законопроєкт про прозорість місцевих бюджетів', time='22:40'),
    dict(r='viina', t='Як діяти під час повітряної тривоги: оновлені рекомендації ДСНС', time='21:15'),
]
POPULAR = [
    dict(r='groshi', t='Субсидії взимку: як перевірити нарахування і що робити, якщо відмовили'),
    dict(r='podii', t='Енергетики оприлюднили графіки відключень на 10 листопада'),
    dict(r='tekhnolohii', t='Як увімкнути вертикальні вкладки в браузері: коротка інструкція'),
    dict(r='ekonomika', t='Уряд змінив правила компенсації за енергоефективний ремонт'),
    dict(r='sport', t='Біатлон: розклад гонок першого етапу Кубка світу'),
]
EXPLAIN = [
    dict(r='groshi', t='Що таке облікова ставка і чому від неї залежать кредити', d='Пояснення на 4 хвилини'),
    dict(r='suspilstvo', t='Як підготувати дім до відключень світла: перелік на одну сторінку', d='Оновлено 8 листопада'),
    dict(r='polityka', t='Як ухвалюють закони: шлях законопроєкту від реєстрації до підпису', d='Пояснення на 6 хвилин'),
]
RBLOCKS = {
    'polityka': [('Комітет Ради підтримав законопроєкт про прозорість місцевих бюджетів', '22:40'),
                 ('Уряд призначив нових членів наглядової ради держбанку', '19:05'),
                 ('Парламент повернувся до розгляду бюджету на 2027 рік', '17:30')],
    'ekonomika': [('Мінфін розмістив облігації внутрішньої позики на 12 млрд грн', '14:57'),
                  ('Експорт агропродукції в жовтні: головні напрямки', '12:10'),
                  ('Малий бізнес отримає ще одну програму пільгових кредитів', '10:45')],
    'svit': [('Саміт у Брюсселі: про що домовилися міністри енергетики', '14:22'),
             ('Уряд Польщі анонсував спрощення перетину кордону для вантажівок', '11:50'),
             ('ООН оприлюднила доповідь про продовольчу безпеку', '09:30')],
    'tekhnolohii': [('Мобільні оператори попередили про перебої зв’язку в трьох областях', '13:48'),
                    ('Як захистити акаунт у месенджері: три налаштування', '11:15'),
                    ('Українські стартапи привернули інвестиції в третьому кварталі', '08:20')],
}


def cover(r, cls='', alt=None, loading='lazy'):
    a = alt if alt is not None else ''
    return f'<div class="media {cls}" data-r="{r}"><img src="../covers/{r}.svg" alt="{a}" loading="{loading}" width="1200" height="675"></div>'


def rlabel(r, href=True):
    if href:
        return f'<a class="rlabel" data-r="{r}" href="rubric.html">{RNAME[r]}</a>'
    return f'<span class="rlabel" data-r="{r}">{RNAME[r]}</span>'


def head(title, theme):
    th = f' data-theme="{theme}"' if theme else ''
    return f'''<!doctype html>
<html lang="uk"{th}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{title} — Новини України (прототип)</title>
<link rel="icon" href="../logo/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../tokens.css">
<link rel="stylesheet" href="prototype.css">
</head>
<body>
'''


def masthead(active=None):
    items = ''.join(
        f'<li><a href="rubric.html" data-r="{s}"{" aria-current=\"page\"" if s == active else ""}>{n}</a></li>'
        for s, n in RUBRICS)
    return f'''<header class="masthead">
  <div class="container masthead__bar">
    <a class="masthead__logo" href="index.html" aria-label="Новини України — головна">{WORDMARK}{WORDTYPE}</a>
    <span class="masthead__date">Понеділок, 9 листопада 2026</span>
    <a class="icon-btn" href="search.html">{I_SEARCH}<span class="icon-btn__label">Пошук</span></a>
    <button class="icon-btn" type="button" aria-label="Темна тема">{I_MOON}<span class="icon-btn__label">Тема</span></button>
    <button class="icon-btn icon-btn--menu" type="button" aria-label="Меню">{I_MENU}</button>
  </div>
</header>
<nav class="rubric-nav" aria-label="Рубрики"><div class="container"><ul class="rubric-nav__list">{items}</ul></div></nav>
'''


def footer():
    rubs = ''.join(f'<li><a href="rubric.html">{n}</a></li>' for _, n in RUBRICS)
    return f'''<footer class="footer">
  <div class="container">
    <div class="footer__cols">
      <div class="stack-4">{WORDMARK}<p>Незалежний новинний ресурс. Кожен матеріал має перелік джерел і дати публікації та оновлення.</p></div>
      <div class="footer__rubrics"><h2>Рубрики</h2><ul>{rubs}</ul></div>
      <div><h2>Редакція</h2><ul><li><a href="#">Про проєкт</a></li><li><a href="#">Редакційна політика</a></li><li><a href="#">Як ми використовуємо ШІ</a></li><li><a href="#">Виправлення</a></li><li><a href="#">Контакти</a></li></ul></div>
      <div><h2>Підписка</h2><ul><li><a href="#">RSS</a></li><li><a href="search.html">Пошук</a></li></ul></div>
    </div>
    <div class="footer__note">
      <p>Частину матеріалів підготовлено з допомогою ШІ: це позначено в кожному з них, а редакція перевіряє факти перед публікацією.</p>
      <p>Тестова версія сайту. © 2026</p>
    </div>
  </div>
</footer>
</body>
</html>
'''


def feed_items(items, day=None, more=None):
    out = ['<ol class="feed">']
    for it in items:
        cls = ' feed__item--urgent' if it.get('urgent') else ''
        badge = '<span class="badge badge--signal">Терміново</span>' if it.get('urgent') else ''
        upd = '<span class="meta">оновлено 15:20</span>' if it.get('upd') else ''
        out.append(
            f'<li class="feed__item{cls}" data-r="{it["r"]}"><time class="feed__time" datetime="2026-11-09T{it["time"]}">{it["time"]}</time>'
            f'<div class="feed__body"><div class="feed__top">{badge}{rlabel(it["r"], False)}{upd}</div>'
            f'<a class="feed__link" href="article.html"><h3 class="hl hl--feed">{it["t"]}</h3></a></div></li>')
    if day:
        out.append(f'<li class="feed__day">{day[0]}</li>')
        for it in day[1]:
            out.append(
                f'<li class="feed__item" data-r="{it["r"]}"><time class="feed__time">{it["time"]}</time>'
                f'<div class="feed__body"><div class="feed__top">{rlabel(it["r"], False)}</div>'
                f'<a class="feed__link" href="article.html"><h3 class="hl hl--feed">{it["t"]}</h3></a></div></li>')
    out.append('</ol>')
    if more:
        out.append(f'<a class="btn btn--secondary btn--block" href="#">{more}</a>')
    return ''.join(out)


def popular_block(title='Популярне'):
    li = ''.join(f'<li><div class="stack-4" style="--sp-4:6px">{rlabel(p["r"])}<h3 class="hl hl--sm"><a href="article.html">{p["t"]}</a></h3></div></li>' for p in POPULAR)
    return f'<section><div class="section__head"><h2 class="section__title">{title}</h2><span class="meta">за добу</span></div><ol class="rank">{li}</ol></section>'


def explain_block():
    li = ''.join(f'<article class="card">{rlabel(e["r"])}<h3 class="hl hl--sm"><a href="article.html">{e["t"]}</a></h3><p>{e["d"]}</p></article>' for e in EXPLAIN)
    return f'<section class="explain"><div class="section__head"><h2 class="section__title">Пояснюємо</h2><a class="section__more" href="#">Усі пояснення</a></div><div class="cards cards--divided" style="gap:16px">{li}</div></section>'


# ── Сторінки ──────────────────────────────────────────────────────────

def page_home(theme=None):
    cards = ''.join(
        f'<article class="card card-main" data-r="{m["r"]}">{cover(m["r"])}{rlabel(m["r"])}<h3 class="hl hl--card"><a href="article.html">{m["t"]}</a></h3><span class="meta"><time>{m["time"]}</time></span></article>'
        for m in MAIN)
    rblocks = ''
    for slug, items in RBLOCKS.items():
        first = items[0]
        li = ''.join(f'<li><span class="meta"><time>{t}</time></span><a href="article.html" class="hl hl--sm">{h}</a></li>' for h, t in items[1:])
        rblocks += (f'<section class="section rblock"><div class="section__head" data-r="{slug}"><h2 class="section__title"><a href="rubric.html">{RNAME[slug]}</a></h2><a class="section__more" href="rubric.html">Усі новини рубрики</a></div>'
                    f'<article class="card card--row" data-r="{slug}">{cover(slug)}<h3 class="hl hl--card"><a href="article.html">{first[0]}</a></h3><span class="meta"><time>{first[1]}</time></span></article>'
                    f'<ul class="rblock__list">{li}</ul></section>')
    return (head('Головна', theme) + masthead() + f'''<main class="container page-pad">
  <h1 class="sr-only">Новини України — головні новини дня</h1>
  <div class="home-top">
    <article class="top" data-r="{TOP['r']}">
      <a class="mobile-bleed" href="article.html" tabindex="-1">{cover(TOP['r'], loading='eager')}</a>
      <div class="top__body">
        <div class="meta-row">{rlabel(TOP['r'])}<span class="meta"><time>{TOP['time']}</time></span></div>
        <h2 class="hl hl--display"><a href="article.html">{TOP['t']}</a></h2>
        <p class="lead">{TOP['lead']}</p>
      </div>
    </article>
    <section class="latest" aria-labelledby="latest-h">
      <div class="section__head"><h2 class="section__title" id="latest-h">Останні новини</h2><a class="section__more" href="#">Уся стрічка</a></div>
      {feed_items(FEED[:8], day=None, more='Більше новин')}
    </section>
  </div>
  <section class="section" aria-labelledby="main-h">
    <div class="section__head"><h2 class="section__title" id="main-h">Головне</h2></div>
    <div class="cards cards--4 cards--divided">{cards}</div>
  </section>
  <div class="home-mid">
    <div class="rblocks">{rblocks}</div>
    <aside class="rail section">{popular_block()}{explain_block()}</aside>
  </div>
</main>
''' + footer())


ARTICLE_BODY = '''
<p>Уряд оновив порядок, за яким власники квартир і об’єднання співвласників отримують часткову компенсацію витрат на утеплення будинків, заміну вікон та модернізацію теплових пунктів. Зміни стосуються як нових заявок, так і тих, що вже перебувають на розгляді.</p>
<p>Головна відмінність — заявку тепер можна подати повністю онлайн, без паперових копій кошторису. Перевірку документів має бути завершено протягом 30 робочих днів, а не 60, як раніше.</p>
<h2>Хто може претендувати на компенсацію</h2>
<p>Право на компенсацію мають ОСББ та житлово-будівельні кооперативи, а також власники приватних будинків, якщо роботи виконано після 1 січня 2026 року і підтверджено актом приймання.</p>
<ul><li>для ОСББ частка компенсації зросла до 50 % вартості робіт;</li><li>для приватних будинків вона залишилася на рівні 30 %;</li><li>граничну суму на одну квартиру не змінено.</li></ul>
<h2>Які документи потрібні</h2>
<p>Перелік скоротили до трьох документів: договору з підрядником, акта виконаних робіт і підтвердження оплати. Технічний звіт енергоаудитора потрібен лише для проєктів вартістю понад 1 млн грн.</p>
<p>Текст постанови оприлюднено на <a href="#">урядовому порталі</a>; роз’яснення щодо подання заявок опублікував <a href="#">фонд енергоефективності</a>.</p>
'''


def page_article(theme=None):
    r = TOP['r']
    rel = MAIN[:3]
    rel_html = ''.join(
        f'<article class="card" data-r="{m["r"]}">{cover(m["r"])}{rlabel(m["r"])}<h3 class="hl hl--card"><a href="article.html">{m["t"]}</a></h3></article>'
        for m in rel)
    tags = ''.join(f'<li><a class="chip" href="tag.html">{t}</a></li>' for t in ['Енергоефективність', 'ОСББ', 'Комунальні послуги', 'Компенсації'])
    return (head(TOP['t'], theme) + masthead(active=r) + f'''<main class="container">
  <ol class="breadcrumbs"><li><a href="index.html">Головна</a></li><li><a href="rubric.html">Економіка</a></li></ol>
  <div class="article-layout">
    <article class="article" data-r="{r}">
      <header class="article__head">
        <div class="article__kicker">{rlabel(r)}<span class="badge badge--outline">Новина</span></div>
        <h1 class="hl hl--display">{TOP['t']}</h1>
        <p class="lead">{TOP['lead']}</p>
        <div class="byline">
          <span>Автор: <strong><a href="#">Редакція</a></strong></span>
          <span>Опубліковано <time datetime="2026-11-09T14:32">9 листопада 2026, 14:32</time></span>
          <span class="byline__update"><b>Оновлено</b> <time datetime="2026-11-09T15:20">15:20</time>: додано строки розгляду заявок</span>
        </div>
      </header>
      <div class="stack-5" style="margin-top:24px">
        <figure class="figure mobile-bleed">{cover(r, alt='Ілюстрація рубрики «Економіка»: стовпці зростання', loading='eager')}<figcaption class="credit">Ілюстрація рубрики «Економіка». Власна графіка редакції.</figcaption></figure>
        <div class="disclosure">{I_INFO}<p style="margin:0">Матеріал підготовлено з допомогою ШІ на основі джерел, перелічених нижче. Факти перевірила редакція. <a href="#">Як ми працюємо</a></p></div>
        <section class="summary" aria-label="Коротко"><h2>Коротко</h2><ul><li>Заявку на компенсацію можна подати онлайн.</li><li>Частка компенсації для ОСББ — до 50 %.</li><li>Строк розгляду скоротили до 30 робочих днів.</li></ul></section>
        <div class="prose">{ARTICLE_BODY}</div>
        <section class="sources" aria-labelledby="src-h">
          <h2 id="src-h">Джерела</h2>
          <p>Матеріал написано на основі цих публікацій. Тексти джерел не копіюються.</p>
          <ol>
            <li><div><a href="#">Постанова про зміни до порядку надання компенсацій</a><span class="meta">Урядовий портал, переглянуто 9 листопада, 13:50</span></div></li>
            <li><div><a href="#">Роз’яснення щодо подання заявок онлайн</a><span class="meta">Фонд енергоефективності, переглянуто 9 листопада, 14:05</span></div></li>
            <li><div><a href="#">Статистика програми за III квартал</a><span class="meta">Державна служба статистики, переглянуто 9 листопада, 14:10</span></div></li>
          </ol>
          <p class="sources__foot">Помітили неточність? <a href="#">Напишіть редакції</a>. Усі виправлення ми фіксуємо на сторінці <a href="#">«Виправлення»</a>.</p>
        </section>
        <section class="corrections"><h2>Виправлення</h2><p class="meta" style="margin-bottom:4px"><time>9 листопада, 15:20</time></p><p>У попередній версії було вказано строк розгляду 60 днів. Правильно — 30 робочих днів.</p></section>
        <div class="stack-4"><h2 class="section__title" style="font-size:16px">Теги</h2><ul class="chips">{tags}</ul></div>
        <div class="share"><button class="btn btn--secondary" type="button">Копіювати посилання</button><button class="btn btn--secondary" type="button">Поділитися</button></div>
      </div>
      <section class="section" aria-labelledby="rel-h"><div class="section__head"><h2 class="section__title" id="rel-h">Читайте також</h2></div><div class="cards cards--3 cards--divided">{rel_html}</div></section>
      <section class="section" aria-label="Наступна стаття">
        <a class="next" href="article.html" data-r="groshi"><div class="stack-4"><span class="next__label">Наступна стаття {I_NEXT}</span>{rlabel('groshi', False)}<h2 class="hl">Тарифи на електроенергію для населення: що зміниться з 1 грудня</h2></div>{cover('groshi')}</a>
      </section>
    </article>
    <aside class="rail"><div class="rail rail--sticky">
      <section><div class="section__head"><h2 class="section__title">Останні новини</h2></div>{feed_items(FEED[:6], more='Уся стрічка')}</section>
      {popular_block()}
    </div></aside>
  </div>
</main>
''' + footer())


LIST = [
    ('ekonomika', 'Мінфін розмістив облігації внутрішньої позики на 12 млрд грн', 'Попит перевищив пропозицію, а середня дохідність знизилася порівняно з попередніми аукціонами.', 'Сьогодні, 14:57'),
    ('ekonomika', 'Експорт агропродукції в жовтні: головні напрямки', 'Обсяги зросли завдяки зерновим, а частка ЄС у структурі експорту залишилася найбільшою.', 'Сьогодні, 12:10'),
    ('ekonomika', 'Малий бізнес отримає ще одну програму пільгових кредитів', 'Програма розрахована на підприємців з обігом до 50 млн грн на рік. Розповідаємо про умови.', 'Сьогодні, 10:45'),
    ('ekonomika', 'Індекс ділових очікувань у жовтні: бізнес став обережнішим', 'Опитування показало зниження очікувань щодо продажів на наступні пів року.', 'Вчора, 18:20'),
    ('ekonomika', 'Як зміниться мінімальна зарплата в 2027 році', 'Пояснюємо, від чого залежить розмір мінімальної зарплати і на які виплати він впливає.', 'Вчора, 16:05'),
]


def list_items(items, highlight=None, rub=True):
    out = ['<ul class="list">']
    for r, t, ex, when in items:
        if highlight:
            for w in highlight:
                t = re.sub(f'({w})', r'<mark>\1</mark>', t, flags=re.I)
                ex = re.sub(f'({w})', r'<mark>\1</mark>', ex, flags=re.I)
        lab = rlabel(r) if rub else ''
        out.append(f'<li class="list__item" data-r="{r}">{cover(r)}<div class="meta-row">{lab}<span class="meta"><time>{when}</time></span></div>'
                   f'<h3 class="hl hl--card"><a href="article.html">{t}</a></h3><p class="list__excerpt">{ex}</p></li>')
    out.append('</ul>')
    return ''.join(out)


PAGINATION = '<nav class="pagination" aria-label="Сторінки"><span aria-current="page">1</span><a href="#">2</a><a href="#">3</a><span>…</span><a href="#">24</a><a class="pagination__next" href="#">Наступна сторінка</a></nav>'


def page_rubric(theme=None):
    r = 'ekonomika'
    side = ''.join(f'<article class="card card--row" data-r="{r}">{cover(r)}<span class="meta"><time>{w}</time></span><h3 class="hl hl--sm"><a href="article.html">{t}</a></h3></article>'
                   for _, t, _, w in LIST[1:3])
    topics = ''.join(f'<li><a class="chip" href="tag.html">{t}</a></li>' for t in ['Бюджет', 'Облігації', 'Експорт', 'Малий бізнес', 'Енергоефективність'])
    return (head('Економіка', theme) + masthead(active=r) + f'''<header class="rhead" data-r="{r}"><div class="container rhead__inner"><div class="rhead__text"><h1>Економіка</h1><p>Бізнес, ринки, державні фінанси.</p></div><div class="rhead__art"><img src="../covers/{r}.svg" alt="" width="1200" height="675"></div></div></header>
<main class="container">
  <header class="phead">
    <ul class="chips" aria-label="Популярні теми рубрики">{topics}</ul>
  </header>
  <div class="listing-layout">
    <div class="listing">
      <div class="listing-lead">
        <article class="top" data-r="{r}">{cover(r)}<div class="top__body"><span class="meta"><time>Сьогодні, 14:32</time></span><h2 class="hl hl--display" style="font-size:var(--fs-30)"><a href="article.html">{TOP['t']}</a></h2><p class="lead" style="font-size:var(--fs-16)">{TOP['lead']}</p></div></article>
        <div class="cards cards--divided">{side}</div>
      </div>
      <section class="section"><div class="section__head" data-r="{r}"><h2 class="section__title">Усі новини рубрики</h2></div>{list_items(LIST, rub=False)}{PAGINATION}</section>
    </div>
    <aside class="rail">{popular_block('Популярне в рубриці')}{explain_block()}</aside>
  </div>
</main>
''' + footer())


def page_tag(theme=None):
    items = [
        ('ekonomika', 'Уряд змінив правила компенсації за енергоефективний ремонт', 'Заявку можна подати онлайн, частку компенсації для ОСББ збільшили до 50 %.', 'Сьогодні, 14:32'),
        ('groshi', 'Тарифи на електроенергію для населення: що зміниться з 1 грудня', 'Розбираємо, як зміниться платіжка для квартир з електроплитами та без.', 'Сьогодні, 13:55'),
        ('suspilstvo', 'Як підготувати дім до відключень світла: перелік на одну сторінку', 'Що купити заздалегідь і як зберегти тепло в квартирі без опалення.', '8 листопада'),
        ('rehiony', 'На Житомирщині утеплили 40 шкіл за програмою енергоефективності', 'Роботи завершили до початку опалювального сезону.', '7 листопада'),
        ('svit', 'Як європейські міста скорочують споживання тепла', 'Три підходи, які вже працюють у Польщі, Литві та Нідерландах.', '5 листопада'),
    ]
    related = ''.join(f'<li><a class="chip" href="tag.html">{t}</a></li>' for t in ['ОСББ', 'Комунальні послуги', 'Тарифи', 'Опалення', 'Компенсації'])
    return (head('Енергоефективність', theme) + masthead() + f'''<main class="container">
  <ol class="breadcrumbs"><li><a href="index.html">Головна</a></li><li>Теги</li></ol>
  <header class="phead" style="padding-top:0">
    <span class="phead__kind">Тег</span>
    <h1 class="phead__title">Енергоефективність</h1>
    <p>48 матеріалів з 2 вересня 2026 року</p>
  </header>
  <div class="listing-layout">
    <div class="listing">{list_items(items)}{PAGINATION}</div>
    <aside class="rail"><section><div class="section__head"><h2 class="section__title">Схожі теги</h2></div><ul class="chips">{related}</ul></section>{popular_block()}</aside>
  </div>
</main>
''' + footer())


def page_search(theme=None):
    items = [
        ('groshi', 'Тарифи на електроенергію для населення: що зміниться з 1 грудня', 'Нові тарифи діятимуть до кінця опалювального сезону. Розбираємо, як зміниться платіжка.', 'Сьогодні, 13:55'),
        ('ekonomika', 'Регулятор оприлюднив проєкт нових тарифів на розподіл газу', 'Обговорення проєкту триватиме місяць; зміни можуть вплинути на платіжки з весни.', '6 листопада'),
        ('rehiony', 'У Дніпрі переглянули тарифи на тепло для бюджетних установ', 'Для населення тарифи на тепло залишаються без змін до травня.', '3 листопада'),
        ('groshi', 'Як перевірити, чи правильно нараховано плату за комунальні послуги', 'Покрокова інструкція: які дані звірити й куди звертатися у разі помилки.', '28 жовтня'),
    ]
    return (head('Пошук', theme) + masthead() + f'''<main class="container">
  <section class="search-hero">
    <h1 class="phead__title" style="font-size:var(--fs-36)">Пошук</h1>
    <form class="field" role="search" onsubmit="return false"><label class="sr-only" for="q">Пошуковий запит</label><input class="input is-focus" id="q" type="search" value="тарифи"><button class="btn" type="submit">Знайти</button></form>
    <div class="filters">
      <span class="select">Усі рубрики</span>
      <ul class="chips" aria-label="Період"><li><button class="chip" type="button">За добу</button></li><li><button class="chip" type="button" aria-pressed="true">За тиждень</button></li><li><button class="chip" type="button">За місяць</button></li><li><button class="chip" type="button">Увесь час</button></li></ul>
    </div>
    <p class="results-count">Знайдено 24 матеріали за запитом «тарифи»</p>
  </section>
  <div class="listing-layout">
    <div class="listing">{list_items(items, highlight=['тариф[а-яіїєґ]*'])}{PAGINATION}</div>
    <aside class="rail"><section><div class="section__head"><h2 class="section__title">Часто шукають</h2></div><ul class="chips"><li><a class="chip" href="#">графіки відключень</a></li><li><a class="chip" href="#">субсидії</a></li><li><a class="chip" href="#">курс гривні</a></li><li><a class="chip" href="#">НМТ-2027</a></li></ul></section></aside>
  </div>
</main>
''' + footer())


def page_404(theme=None):
    rubs = ''.join(f'<li><a class="chip" href="rubric.html">{n}</a></li>' for _, n in RUBRICS[:8])
    return (head('Сторінку не знайдено', theme) + masthead() + f'''<main class="container">
  <div class="listing-layout">
    <div class="listing">
      <section class="notfound">
        <span class="notfound__code" aria-hidden="true">404</span>
        <h1 class="hl hl--display">Сторінку не знайдено</h1>
        <p class="lead">Можливо, матеріал перенесли або в адресі є помилка. Знайдіть його через пошук або перегляньте рубрики.</p>
        <form class="field" role="search" onsubmit="return false"><label class="sr-only" for="q">Пошуковий запит</label><input class="input" id="q" type="search" placeholder="Що ви шукали?"><button class="btn" type="submit">Знайти</button></form>
        <ul class="chips">{rubs}</ul>
        <p><a class="btn btn--secondary" href="index.html">На головну</a></p>
      </section>
    </div>
    <aside class="rail section"><section><div class="section__head"><h2 class="section__title">Останні новини</h2></div>{feed_items(FEED[:5])}</section></aside>
  </div>
</main>
''' + footer())


def page_styleguide(theme=None):
    import sys
    sys.path.insert(0, os.path.join(HERE, '..'))
    import check_contrast as cc
    css = open(os.path.join(HERE, '..', 'tokens.css'), encoding='utf-8').read()
    light, dark = cc.parse(css)
    t = dark if theme == 'dark' else light
    base = [('paper', 'Папір — фон'), ('wash', 'Підкладка блоків'), ('line', 'Розділювачі'), ('line-strong', 'Межі полів'),
            ('ink', 'Чорнило — заголовки, текст'), ('muted', 'Мета, кредити'), ('masthead-bg', 'Шапка й футер'),
            ('signal', '«Терміново» й «Наживо»'), ('focus', 'Фокус'), ('mark', 'Збіг у пошуку')]
    sw = ''.join(
        f'<div class="sg-sw"><div class="sg-sw__c" style="background:var(--{k})"></div><b>--{k}</b><span>{t[k]}</span><span>{d}</span>'
        f'<span>{"на paper " + format(cc.ratio(t[k], t["paper"]), ".1f") + ":1" if k not in ("paper","wash","line","mark","masthead-bg") else ""}</span></div>'
        for k, d in base)
    rub = ''.join(
        f'<div class="sg-rub" data-r="{sl}"><img src="../covers/{sl}.svg" alt="" width="1200" height="675"><span class="rlabel">{n}</span>'
        f'<span class="meta">--r-{sl} {t["r-" + sl]} · {cc.ratio(t["r-" + sl], t["paper"]):.1f}:1</span></div>'
        for sl, n in RUBRICS)
    scale = [('60', 'serif', 700, 'Код 404, шапка рубрики'), ('48', 'serif', 700, 'Топ-матеріал і h1 статті (desktop)'),
             ('36', 'serif', 700, 'h1 рубрики, тега, пошуку'), ('30', 'serif', 700, 'h1 на мобільному, «Наступна стаття»'),
             ('24', 'serif', 700, 'Підзаголовки в тексті статті'), ('21', 'serif', 600, 'Картки «Головне» (desktop), лід'),
             ('18', 'serif', 400, 'Текст статті: Literata 18/1.62, до 68 знаків у рядку'),
             ('16', 'sans', 500, 'Стрічка новин, інтерфейс: Golos Text'), ('14', 'sans', 600, 'Мітки рубрик, мета, дати'),
             ('12', 'sans', 500, 'Кредити фото, бейджі')]
    ty = ''.join(
        f'<div class="sg-type"><span class="meta">{px} px</span><span style="font-family:var(--font-{fam});font-size:{px}px;font-weight:{w};line-height:1.15;color:var(--ink)">Ґрунтовні новини щодня</span><span class="meta">{d}</span></div>'
        for px, fam, w, d in scale)
    return (head('Дизайн-система', theme) + masthead() + f"""<style>
.sg h2.sg-h {{ font-family: var(--font-sans); font-size: var(--fs-24); margin: var(--sp-7) 0 var(--sp-4); color: var(--ink); }}
.sg-grid {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--sp-4); }}
.sg-sw {{ display: grid; gap: 2px; font-size: var(--fs-14); color: var(--muted); }}
.sg-sw b {{ color: var(--ink); }}
.sg-sw__c {{ height: 64px; border-radius: var(--radius-m); box-shadow: inset 0 0 0 1px var(--line); margin-bottom: 6px; }}
.sg-rubs {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: var(--sp-4); }}
.sg-rub {{ display: grid; gap: 6px; }}
.sg-rub img {{ border-radius: var(--radius-m); }}
.sg-type {{ display: grid; grid-template-columns: 64px 1fr 340px; align-items: baseline; gap: var(--sp-4); padding: var(--sp-3) 0; border-top: 1px solid var(--line); }}
.sg-row {{ display: flex; gap: var(--sp-4); align-items: center; flex-wrap: wrap; }}
.sg-cols {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-6); align-items: start; }}
.sg-cap {{ font-size: var(--fs-14); color: var(--muted); margin: 0 0 var(--sp-3); font-weight: 600; }}
.column-card {{ display: grid; grid-template-columns: 56px 1fr; gap: var(--sp-3); align-items: start; }}
.avatar {{ width: 56px; height: 56px; border-radius: 50%; background: var(--wash); color: var(--ink); display: grid; place-items: center; font-weight: 700; box-shadow: inset 0 0 0 1px var(--line-strong); }}
.empty {{ background: var(--wash); border-radius: var(--radius-m); padding: var(--sp-5); display: grid; gap: var(--sp-3); }}
.empty h3 {{ margin: 0; font-family: var(--font-serif); font-size: var(--fs-21); color: var(--ink); }}
.empty p {{ margin: 0; color: var(--text); }}
</style>
<main class="container sg">
  <header class="phead"><h1 class="phead__title">Дизайн-система</h1><p>Токени — у <code>design/tokens.css</code>. Шрифти Literata і Golos Text (SIL OFL 1.1). Контраст перевірено скриптом <code>design/check_contrast.py</code>: усі пари ≥ WCAG AA.</p></header>
  <h2 class="sg-h">Кольори</h2><div class="sg-grid">{sw}</div>
  <h2 class="sg-h">Рубрики: колір мітки й обкладинка</h2><div class="sg-rubs">{rub}</div>
  <h2 class="sg-h">Типографіка</h2><div>{ty}</div>
  <h2 class="sg-h">Сітка</h2>
  <p class="meta">Mobile 390: 4 колонки, поле 16, проміжок 16. Tablet ≥ 768: 8 колонок, поле 32, проміжок 24. Desktop ≥ 1200: 12 колонок, контейнер 1280, поле 80 (на 1440), проміжок 24. Основна колонка — 8, права колонка (стрічка, «Популярне») — 4.</p>
  <h2 class="sg-h">Кнопки, поля, фільтри — стани</h2>
  <div class="sg-cols">
    <div><p class="sg-cap">Основна кнопка</p><div class="sg-row"><button class="btn">Знайти</button><button class="btn" style="background:var(--link-hover);border-color:var(--link-hover)">Наведення</button><button class="btn is-focus">Фокус</button><button class="btn" disabled>Недоступна</button></div></div>
    <div><p class="sg-cap">Другорядна кнопка</p><div class="sg-row"><button class="btn btn--secondary">Більше новин</button><button class="btn btn--secondary" style="background:var(--wash)">Наведення</button><button class="btn btn--secondary is-focus">Фокус</button></div></div>
    <div><p class="sg-cap">Чипи: теги, період</p><ul class="chips"><li><a class="chip" href="#">ОСББ</a></li><li><a class="chip" href="#" style="box-shadow:inset 0 0 0 2px var(--ink)">Наведення</a></li><li><button class="chip" aria-pressed="true">Обрано</button></li></ul></div>
    <div><p class="sg-cap">Поле: звичайне</p><div class="field"><input class="input" placeholder="Що ви шукали?"></div></div>
    <div><p class="sg-cap">Поле: фокус</p><div class="field"><input class="input is-focus" value="тарифи"></div></div>
    <div><p class="sg-cap">Поле: помилка</p><div class="field"><input class="input input--error" value="т"></div><p class="field-hint field-hint--error">Введіть щонайменше 2 символи.</p></div>
  </div>
  <h2 class="sg-h">Стрічка: стани елемента</h2>
  <div class="sg-cols">
    <div><p class="sg-cap">Звичайний · терміновий · оновлений</p>{feed_items([FEED[0], FEED[3], FEED[1]])}</div>
    <div><p class="sg-cap">Розділювач дня</p>{feed_items([FEED[9]], day=('Вчора, 8 листопада', FEED_YESTERDAY))}</div>
    <div><p class="sg-cap">Бейджі й мітки</p><div class="sg-row"><span class="badge badge--signal">Терміново</span><span class="badge badge--signal">Наживо</span><span class="badge badge--outline">Новина</span><span class="badge badge--outline">Пояснення</span></div>
      <p class="sg-cap" style="margin-top:24px">Пагінація</p>{PAGINATION}</div>
  </div>
  <h2 class="sg-h">Службові блоки статті</h2>
  <div class="sg-cols">
    <div><p class="sg-cap">Розкриття ШІ (обов’язково, якщо ai_assisted)</p><div class="disclosure">{I_INFO}<p style="margin:0">Матеріал підготовлено з допомогою ШІ на основі джерел, перелічених нижче. Факти перевірила редакція. <a href="#">Як ми працюємо</a></p></div></div>
    <div><p class="sg-cap">Колонка — лише для реального автора з профілем</p><article class="column-card"><span class="avatar" aria-hidden="true">ІП</span><div class="stack-4" style="--sp-4:4px"><span class="meta"><b style="color:var(--ink)">Ім’я Прізвище</b>, посада з профілю</span><h3 class="hl hl--card"><a href="#">Заголовок колонки автора</a></h3></div></article><p class="meta">Фото автора — лише власне з дозволом; інакше ініціали. Без вигаданих імен.</p></div>
    <div><p class="sg-cap">Порожній результат пошуку</p><div class="empty"><h3>За запитом «тарифии» нічого не знайдено</h3><p>Перевірте написання або спробуйте коротший запит. Можна також обрати рубрику.</p><a class="btn btn--secondary" href="#">Скинути фільтри</a></div></div>
  </div>
</main>
""" + footer())


PAGES = {
    'index': page_home, 'article': page_article, 'rubric': page_rubric,
    'tag': page_tag, 'search': page_search, '404': page_404, 'styleguide': page_styleguide,
}

if __name__ == '__main__':
    for name, fn in PAGES.items():
        with open(os.path.join(HERE, f'{name}.html'), 'w', encoding='utf-8') as fh:
            fh.write(fn())
        with open(os.path.join(HERE, f'{name}.dark.html'), 'w', encoding='utf-8') as fh:
            fh.write(fn('dark'))
    print('ok', len(PAGES) * 2, 'pages')
