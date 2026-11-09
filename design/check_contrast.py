#!/usr/bin/env python3
"""Перевіряє WCAG-контраст пар токенів з tokens.css (світла й темна теми).

Запуск: python3 design/check_contrast.py  → таблиця; exit 1, якщо є пара < порогу.
Поріг: 4.5 для тексту, 3.0 для великого тексту / UI-меж.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SLUGS = ['podii', 'polityka', 'viina', 'ekonomika', 'groshi', 'svit', 'suspilstvo',
         'tekhnolohii', 'zdorovia', 'sport', 'kultura', 'rehiony']


def parse(css):
    light_part, dark_part = css.split(":root[data-theme='dark']", 1)
    rx = re.compile(r'--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})')
    light = dict(rx.findall(light_part))
    dark = dict(light)
    dark.update(rx.findall(dark_part))
    return light, dark


def lum(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


PAIRS = [
    ('text', 'paper', 4.5), ('ink', 'paper', 4.5), ('muted', 'paper', 4.5), ('muted', 'wash', 4.5),
    ('text', 'wash', 4.5), ('on-ink', 'masthead-bg', 4.5), ('on-ink-muted', 'masthead-bg', 4.5),
    ('link-hover', 'paper', 4.5), ('signal', 'paper', 4.5), ('on-signal', 'signal', 4.5),
    ('ink', 'mark', 4.5), ('danger', 'paper', 4.5), ('focus', 'paper', 3.0), ('line-strong', 'paper', 3.0),
] + [(f'r-{s}', 'paper', 4.5) for s in SLUGS] + [(f'r-{s}', 'wash', 4.5) for s in SLUGS] \
  + [('ink', f'r-{s}-tint', 4.5) for s in SLUGS]
COVER_PAIRS = [('on-ink', f'r-{s}-cover', 4.5) for s in SLUGS]


def run():
    css = open(os.path.join(HERE, 'tokens.css'), encoding='utf-8').read()
    light, dark = parse(css)
    fails = 0
    rows = []
    for theme, t in [('light', light), ('dark', dark)]:
        for fg, bg, need in PAIRS + (COVER_PAIRS if theme == 'light' else []):
            r = ratio(t[fg], t[bg])
            ok = r >= need
            fails += not ok
            rows.append((theme, fg, bg, r, need, ok))
    for theme, fg, bg, r, need, ok in rows:
        print(f'{theme:5} {fg:>16} on {bg:<18} {r:5.2f}  (≥{need})  {"OK" if ok else "FAIL"}')
    print(f'\n{len(rows)} pairs, {fails} fail')
    return rows, fails


if __name__ == '__main__':
    _, fails = run()
    sys.exit(1 if fails else 0)
