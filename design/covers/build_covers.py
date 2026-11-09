#!/usr/bin/env python3
"""Генерує 12 обкладинок рубрик (design/covers/<slug>.svg).

Система:
  * полотно 1200×675 (16:9); головний мотив — у центральному квадраті
    x 262…937, щоб кадри 1:1 та 4:3 (object-fit: cover, center) не різали форму;
  * 4 кольори: фон = колір рубрики, tint, середній тон, папір (#FFF) +
    глибокий тон (колір рубрики × чорнило) для тіней;
  * лише геометрія — жодних фото, людей, символів держав, зброї, червоного хреста;
  * без тексту: назву рубрики додає інтерфейс.

Запуск: python3 design/covers/build_covers.py
"""
import math
import os
import random

W, H = 1200, 675
CX, CY = W / 2, H / 2
INK = (0x0F, 0x2A, 0x33)

RUBRICS = {
    # slug: (колір рубрики, tint) — збігаються з tokens.css
    'podii': ('#B3261E', '#F9E3DF'),
    'polityka': ('#2B3FA0', '#E2E6F8'),
    'viina': ('#4F5B2E', '#E8EBDC'),
    'ekonomika': ('#0E6E5C', '#DDF0EA'),
    'groshi': ('#85640A', '#F6EDCF'),
    'svit': ('#1D5F8F', '#DEEBF5'),
    'suspilstvo': ('#7A4A26', '#F1E6DC'),
    'tekhnolohii': ('#5B3FB5', '#E9E4F8'),
    'zdorovia': ('#0F6F7A', '#DCEFF1'),
    'sport': ('#B0450A', '#FAE6D8'),
    'kultura': ('#A3245E', '#F7E0EA'),
    'rehiony': ('#3D6B1F', '#E3EFD9'),
}


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hexc(c):
    return '#%02X%02X%02X' % tuple(max(0, min(255, round(v))) for v in c)


def mix(a, b, t):
    return hexc(tuple(x + (y - x) * t for x, y in zip(rgb(a) if isinstance(a, str) else a,
                                                     rgb(b) if isinstance(b, str) else b)))


def f(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return s if s != '-0' else '0'


def palette(base, tint):
    return {
        'bg': base,
        'tint': tint,
        'mid': mix(base, tint, 0.45),
        'soft': mix(base, tint, 0.22),
        'deep': mix(base, hexc(INK), 0.45),
        'paper': '#FFFFFF',
    }


def svg(slug, title, body, p):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
        f'role="img" aria-labelledby="t-{slug}">\n'
        f'  <title id="t-{slug}">{title}</title>\n'
        f'  <clipPath id="c-{slug}"><rect width="{W}" height="{H}"/></clipPath>\n'
        f'  <rect width="{W}" height="{H}" fill="{p["bg"]}"/>\n'
        f'  <g clip-path="url(#c-{slug})">\n'
        f'{body}'
        f'  </g>\n'
        f'</svg>\n'
    )


# ── Мотиви ──────────────────────────────────────────────────────────────

def podii(p):
    """Подія як імпульс: кола розходяться від точки, зміщеної вліво-вниз."""
    ox, oy = CX - 70, CY + 60
    out = []
    for i, r in enumerate([520, 430, 345, 265, 190, 120]):
        col = p['soft'] if i % 2 == 0 else p['mid']
        out.append(f'  <circle cx="{f(ox)}" cy="{f(oy)}" r="{r}" fill="none" stroke="{col}" stroke-width="{14 if i < 3 else 20}"/>\n')
    out.append(f'  <circle cx="{f(ox)}" cy="{f(oy)}" r="62" fill="{p["tint"]}"/>\n')
    out.append(f'  <circle cx="{f(ox)}" cy="{f(oy)}" r="26" fill="{p["paper"]}"/>\n')
    # «друга хвиля» — малий імпульс, що тільки почався
    out.append(f'  <circle cx="{f(CX + 230)}" cy="{f(CY - 150)}" r="38" fill="none" stroke="{p["tint"]}" stroke-width="10"/>\n')
    out.append(f'  <circle cx="{f(CX + 230)}" cy="{f(CY - 150)}" r="12" fill="{p["tint"]}"/>\n')
    return ''.join(out)


def polityka(p):
    """Півколо залу: ряди місць по дугах; одне місце виділене."""
    out = []
    bx, by = CX, CY + 230
    rows = [(150, 9), (215, 13), (280, 17), (345, 21), (410, 25)]
    for ri, (r, n) in enumerate(rows):
        for k in range(n):
            a = math.pi - (math.pi * (k + 0.5) / n)
            x, y = bx + r * math.cos(a), by - r * math.sin(a)
            col = p['tint'] if ri >= 3 else p['mid']
            out.append(f'  <circle cx="{f(x)}" cy="{f(y)}" r="{14 if ri < 2 else 16}" fill="{col}"/>\n')
    out.append(f'  <rect x="{f(bx - 70)}" y="{f(by - 40)}" width="140" height="40" rx="6" fill="{p["paper"]}"/>\n')
    out.append(f'  <rect x="0" y="{f(by)}" width="{W}" height="{f(H - by)}" fill="{p["deep"]}"/>\n')
    return ''.join(out)


def viina(p):
    """Безпека як захисний купол над обрієм — без зброї й символів сторін."""
    out = []
    hy = CY + 120
    for i, r in enumerate([400, 330, 260, 190]):
        col = [p['soft'], p['mid'], p['tint'], p['paper']][i]
        out.append(
            f'  <path d="M{f(CX - r)} {f(hy)}A{r} {r} 0 0 1 {f(CX + r)} {f(hy)}" fill="none" '
            f'stroke="{col}" stroke-width="{18 if i < 3 else 22}" stroke-linecap="round"/>\n')
    out.append(f'  <rect x="0" y="{f(hy + 20)}" width="{W}" height="{f(H - hy - 20)}" fill="{p["deep"]}"/>\n')
    for i, y in enumerate([hy + 60, hy + 100, hy + 140]):
        out.append(f'  <rect x="{f(CX - 420 + i * 70)}" y="{f(y)}" width="{f(840 - i * 140)}" height="10" rx="5" fill="{p["soft"]}"/>\n')
    return ''.join(out)


def ekonomika(p):
    """Сходи зростання: стовпці різної висоти, останній — папір; лінія тренду."""
    out = []
    base = CY + 230
    xs = [CX - 330 + i * 110 for i in range(7)]
    hs = [120, 170, 150, 230, 280, 260, 380]
    for i, (x, h) in enumerate(zip(xs, hs)):
        col = p['paper'] if i == 6 else (p['tint'] if i >= 4 else p['mid'])
        out.append(f'  <rect x="{f(x)}" y="{f(base - h)}" width="80" height="{h}" rx="6" fill="{col}"/>\n')
    pts = ' '.join(f'{f(x + 40)},{f(base - h - 40)}' for x, h in zip(xs, hs))
    out.append(f'  <polyline points="{pts}" fill="none" stroke="{p["deep"]}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>\n')
    out.append(f'  <rect x="0" y="{f(base)}" width="{W}" height="{f(H - base)}" fill="{p["deep"]}"/>\n')
    return ''.join(out)


def groshi(p):
    """Монети: стопка зміщених кіл з внутрішнім кільцем."""
    out = []
    coins = [(CX - 150, CY + 60, 150, p['mid']), (CX + 10, CY - 10, 170, p['tint']), (CX + 170, CY + 80, 130, p['paper'])]
    for x, y, r, col in coins:
        out.append(f'  <circle cx="{f(x + 14)}" cy="{f(y + 18)}" r="{r}" fill="{p["deep"]}"/>\n')
        out.append(f'  <circle cx="{f(x)}" cy="{f(y)}" r="{r}" fill="{col}"/>\n')
        out.append(f'  <circle cx="{f(x)}" cy="{f(y)}" r="{f(r * 0.72)}" fill="none" stroke="{p["bg"]}" stroke-width="8" stroke-opacity="0.35"/>\n')
    return ''.join(out)


def svit(p):
    """Глобус лініями: меридіани-еліпси, паралелі; орбіта навколо."""
    out = []
    R = 230
    out.append(f'  <ellipse cx="{f(CX)}" cy="{f(CY)}" rx="470" ry="120" fill="none" stroke="{p["soft"]}" stroke-width="12" transform="rotate(-14 {f(CX)} {f(CY)})"/>\n')
    out.append(f'  <circle cx="{f(CX)}" cy="{f(CY)}" r="{R}" fill="{p["mid"]}"/>\n')
    for rx in [170, 100, 34]:
        out.append(f'  <ellipse cx="{f(CX)}" cy="{f(CY)}" rx="{rx}" ry="{R}" fill="none" stroke="{p["tint"]}" stroke-width="8"/>\n')
    for dy in [-150, -78, 0, 78, 150]:
        hw = math.sqrt(R * R - dy * dy)
        out.append(f'  <line x1="{f(CX - hw)}" y1="{f(CY + dy)}" x2="{f(CX + hw)}" y2="{f(CY + dy)}" stroke="{p["tint"]}" stroke-width="8"/>\n')
    out.append(f'  <circle cx="{f(CX)}" cy="{f(CY)}" r="{R}" fill="none" stroke="{p["paper"]}" stroke-width="12"/>\n')
    out.append(f'  <circle cx="{f(CX + 380)}" cy="{f(CY - 140)}" r="22" fill="{p["paper"]}"/>\n')
    return ''.join(out)


def suspilstvo(p):
    """Спільнота як поле точок різного розміру, що збираються до центру."""
    out = []
    rnd = random.Random(7)
    step = 62
    for gy in range(-5, 6):
        for gx in range(-9, 10):
            x, y = CX + gx * step, CY + gy * step
            d = math.hypot(gx * 0.8, gy * 1.1)
            r = max(4, 22 - d * 2.6 + rnd.uniform(-2, 2))
            col = p['paper'] if d < 1.6 else (p['tint'] if d < 3.6 else p['mid'] if d < 5.5 else p['soft'])
            out.append(f'  <circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{col}"/>\n')
    return ''.join(out)


def tekhnolohii(p):
    """Плата: ортогональні траси з вузлами та кристал у центрі."""
    out = []
    traces = [
        f'M{f(CX - 520)} {f(CY - 120)}H{f(CX - 260)}V{f(CY - 40)}H{f(CX - 120)}',
        f'M{f(CX - 520)} {f(CY + 140)}H{f(CX - 320)}V{f(CY + 60)}H{f(CX - 120)}',
        f'M{f(CX + 520)} {f(CY - 170)}H{f(CX + 300)}V{f(CY - 60)}H{f(CX + 120)}',
        f'M{f(CX + 520)} {f(CY + 110)}H{f(CX + 240)}V{f(CY + 40)}H{f(CX + 120)}',
        f'M{f(CX - 40)} {f(CY - 120)}V{f(CY - 290)}H{f(CX + 160)}',
        f'M{f(CX + 40)} {f(CY + 120)}V{f(CY + 290)}H{f(CX - 180)}',
    ]
    for d in traces:
        out.append(f'  <path d="{d}" fill="none" stroke="{p["mid"]}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>\n')
    for x, y in [(CX - 260, CY - 120), (CX - 320, CY + 140), (CX + 300, CY - 170), (CX + 240, CY + 110), (CX + 160, CY - 290), (CX - 180, CY + 290)]:
        out.append(f'  <circle cx="{f(x)}" cy="{f(y)}" r="20" fill="{p["tint"]}"/>\n')
    out.append(f'  <rect x="{f(CX - 120)}" y="{f(CY - 120)}" width="240" height="240" rx="20" fill="{p["deep"]}"/>\n')
    out.append(f'  <rect x="{f(CX - 84)}" y="{f(CY - 84)}" width="168" height="168" rx="12" fill="{p["tint"]}"/>\n')
    for i in range(3):
        for j in range(3):
            col = p['paper'] if (i, j) == (1, 1) else p['mid']
            out.append(f'  <rect x="{f(CX - 64 + i * 48)}" y="{f(CY - 64 + j * 48)}" width="32" height="32" rx="4" fill="{col}"/>\n')
    return ''.join(out)


def zdorovia(p):
    """Ритм: хвиля пульсу через м’яке коло (без символів червоного хреста)."""
    out = []
    out.append(f'  <circle cx="{f(CX)}" cy="{f(CY)}" r="250" fill="{p["soft"]}"/>\n')
    out.append(f'  <circle cx="{f(CX)}" cy="{f(CY)}" r="180" fill="{p["mid"]}"/>\n')
    d = (f'M0 {f(CY)}H{f(CX - 200)}L{f(CX - 150)} {f(CY - 60)}L{f(CX - 90)} {f(CY + 40)}'
         f'L{f(CX - 30)} {f(CY - 190)}L{f(CX + 40)} {f(CY + 150)}L{f(CX + 100)} {f(CY - 40)}'
         f'L{f(CX + 140)} {f(CY)}H{W}')
    out.append(f'  <path d="{d}" fill="none" stroke="{p["deep"]}" stroke-width="30" stroke-linejoin="round" stroke-linecap="round" transform="translate(8 10)"/>\n')
    out.append(f'  <path d="{d}" fill="none" stroke="{p["paper"]}" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/>\n')
    out.append(f'  <circle cx="{f(CX + 140)}" cy="{f(CY)}" r="20" fill="{p["tint"]}"/>\n')
    return ''.join(out)


def sport(p):
    """Бігова доріжка: концентричні доріжки стадіону, одна — папір."""
    out = []
    out.append(f'  <rect x="{f(CX - 300)}" y="{f(CY - 95)}" width="600" height="190" rx="95" fill="{p["deep"]}"/>\n')
    for i in range(4):
        w, h = 960 - i * 100, 500 - i * 100
        col = p['paper'] if i == 1 else (p['tint'] if i % 2 else p['mid'])
        out.append(f'  <rect x="{f(CX - w / 2)}" y="{f(CY - h / 2)}" width="{f(w)}" height="{f(h)}" rx="{f(h / 2)}" fill="none" stroke="{col}" stroke-width="16"/>\n')
    out.append(f'  <rect x="{f(CX - 9)}" y="{f(CY + 100)}" width="18" height="160" rx="4" fill="{p["paper"]}"/>\n')
    return ''.join(out)


def kultura(p):
    """Аркада: ритм арок різної заливки — сцена, галерея, портал."""
    out = []
    base = CY + 210
    arches = [(-390, 110, 'soft'), (-180, 150, 'mid'), (40, 190, 'tint'), (280, 140, 'mid'), (470, 90, 'soft')]
    for dx, r, c in arches:
        x = CX + dx
        h = r * 1.6
        out.append(f'  <path d="M{f(x - r)} {f(base)}V{f(base - h + r)}A{r} {r} 0 0 1 {f(x + r)} {f(base - h + r)}V{f(base)}Z" fill="{p[c]}"/>\n')
    r = 190
    x = CX + 40
    h = r * 1.6
    ir = 110
    out.append(f'  <path d="M{f(x - ir)} {f(base)}V{f(base - h + r + 10)}A{ir} {ir} 0 0 1 {f(x + ir)} {f(base - h + r + 10)}V{f(base)}Z" fill="{p["deep"]}"/>\n')
    out.append(f'  <circle cx="{f(x)}" cy="{f(base - h + r + 10)}" r="34" fill="{p["paper"]}"/>\n')
    out.append(f'  <rect x="0" y="{f(base)}" width="{W}" height="{f(H - base)}" fill="{p["deep"]}"/>\n')
    return ''.join(out)


def rehiony(p):
    """Топографія: вкладені ізолінії рельєфу (детерміновані, без реальної карти)."""
    out = []

    def blob(cx, cy, r, seed, n=10):
        rnd = random.Random(seed)
        amps = [rnd.uniform(0.88, 1.12) for _ in range(n)]
        pts = []
        for k in range(n):
            a = 2 * math.pi * k / n
            rr = r * amps[k]
            pts.append((cx + rr * math.cos(a) * 1.25, cy + rr * math.sin(a)))
        # замкнена Catmull-Rom → кубічні Безьє
        d = f'M{f(pts[0][0])} {f(pts[0][1])}'
        for k in range(n):
            p0, p1, p2, p3 = pts[k - 1], pts[k], pts[(k + 1) % n], pts[(k + 2) % n]
            c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
            d += f'C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}'
        return d + 'Z'

    for i, r in enumerate([360, 300, 240, 185, 135, 90]):
        col = [p['soft'], p['mid'], p['mid'], p['tint'], p['tint'], p['paper']][i]
        out.append(f'  <path d="{blob(CX - 40 + i * 12, CY + 10 - i * 6, r, 11)}" fill="none" stroke="{col}" stroke-width="10"/>\n')
    out.append(f'  <circle cx="{f(CX + 40)}" cy="{f(CY - 24)}" r="16" fill="{p["paper"]}"/>\n')
    for i, r in enumerate([150, 100, 55]):
        out.append(f'  <path d="{blob(CX + 430, CY - 210, r, 5, 8)}" fill="none" stroke="{p["soft"] if i == 0 else p["mid"]}" stroke-width="10"/>\n')
    return ''.join(out)


MOTIFS = {
    'podii': (podii, 'Обкладинка рубрики «Події»: кола-імпульс від точки'),
    'polityka': (polityka, 'Обкладинка рубрики «Політика»: ряди місць залу півколом'),
    'viina': (viina, 'Обкладинка рубрики «Війна і безпека»: захисний купол над обрієм'),
    'ekonomika': (ekonomika, 'Обкладинка рубрики «Економіка»: стовпці зростання й лінія тренду'),
    'groshi': (groshi, 'Обкладинка рубрики «Гроші»: три монети'),
    'svit': (svit, 'Обкладинка рубрики «Світ»: глобус з меридіанами й орбітою'),
    'suspilstvo': (suspilstvo, 'Обкладинка рубрики «Суспільство»: поле точок, що сходяться до центру'),
    'tekhnolohii': (tekhnolohii, 'Обкладинка рубрики «Технології»: схема з трасами й кристалом'),
    'zdorovia': (zdorovia, 'Обкладинка рубрики «Здоров’я»: лінія пульсу через коло'),
    'sport': (sport, 'Обкладинка рубрики «Спорт»: бігові доріжки стадіону'),
    'kultura': (kultura, 'Обкладинка рубрики «Культура»: ритм арок'),
    'rehiony': (rehiony, 'Обкладинка рубрики «Регіони»: топографічні ізолінії'),
}

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    for slug, (base, tint) in RUBRICS.items():
        fn, title = MOTIFS[slug]
        p = palette(base, tint)
        with open(os.path.join(here, f'{slug}.svg'), 'w', encoding='utf-8') as fh:
            fh.write(svg(slug, title, fn(p), p))
        print('wrote', slug)
