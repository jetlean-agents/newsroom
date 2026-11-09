#!/usr/bin/env python3
"""Плейсхолдер знака й словесного знака «Новини України» (робоча назва).

Текст переведено в контури з Literata (SIL OFL 1.1) — SVG не залежить від шрифтів.
Залежності лише для перегенерації: fonttools, uharfbuzz.
Запуск: python3 design/logo/build_logo.py
"""
import io
import os

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', 'fonts', 'Literata-VF.ttf')
INK = '#0F2A33'
PAPER = '#FFFFFF'
NAME = 'Новини України'


def outline(text, axes, size=100, tracking=0):
    vf = TTFont(FONT)
    inst = instancer.instantiateVariableFont(vf, axes)
    buf = io.BytesIO()
    inst.save(buf)
    data = buf.getvalue()
    font = TTFont(io.BytesIO(data))
    upem = font['head'].unitsPerEm
    face = hb.Face(data)
    hfont = hb.Font(face)
    b = hb.Buffer()
    b.add_str(text)
    b.guess_segment_properties()
    hb.shape(hfont, b, {'kern': True, 'liga': True})
    gs = font.getGlyphSet()
    order = font.getGlyphOrder()
    s = size / upem
    pen = SVGPathPen(gs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
    x = 0
    for info, pos in zip(b.glyph_infos, b.glyph_positions):
        g = order[info.codepoint]
        tp = TransformPen(pen, (s, 0, 0, -s, (x + pos.x_offset) * s, 0))
        gs[g].draw(tp)
        x += pos.x_advance + tracking
    asc = font['OS/2'].sCapHeight * s
    return pen.getCommands(), x * s, asc


def mark_paths(size=64):
    """Знак-плейсхолдер «шпальта»: рядок заголовка й два рядки тексту на плитці.
    Сітка 64 з кроком 4 (= 1 px у 16 px): плитка r14, поле 12; заголовок 40×12,
    рядки 40×8 і 24×8; відступ заголовок→текст 8, між рядками 4.
    Нейтральний до назви — замінюється, коли бренд обрано."""
    return (
        '<rect width="64" height="64" rx="14" fill="{bg}"/>'
        '<rect x="12" y="12" width="40" height="12" rx="3" fill="{fg}"/>'
        '<rect x="12" y="32" width="40" height="8" rx="2" fill="{fg}"/>'
        '<rect x="12" y="44" width="24" height="8" rx="2" fill="{fg}"/>'
    )


def write(name, content):
    with open(os.path.join(HERE, name), 'w', encoding='utf-8') as fh:
        fh.write(content)
    print('wrote', name)


if __name__ == '__main__':
    d, width, cap = outline(NAME, {'wght': 700, 'opsz': 72}, size=100, tracking=-8)
    # Словесний знак: висота великої літери = висота знака × 0.62, знак зліва.
    mark_h = 100
    gap = 26
    tx = mark_h + gap
    scale = (mark_h * 0.62) / cap
    ty = mark_h / 2 + cap * scale / 2
    W = tx + width * scale
    for fname, bg, fg, txt in [
        ('wordmark.svg', INK, PAPER, INK),
        ('wordmark-inverse.svg', PAPER, INK, PAPER),
    ]:
        mk = mark_paths().format(bg=bg, fg=fg)
        write(fname,
              f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {mark_h}" width="{W:.0f}" height="{mark_h}" role="img" aria-label="{NAME} — плейсхолдер логотипа">\n'
              f'  <g transform="scale({mark_h / 64:.4f})">{mk}</g>\n'
              f'  <path transform="translate({tx} {ty:.2f}) scale({scale:.4f})" fill="{txt}" d="{d}"/>\n'
              f'</svg>\n')
    # Лише текст (для мобільної шапки, де знак не потрібен)
    write('wordtype.svg',
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {-cap - 4:.0f} {width:.0f} {cap + 30:.0f}" width="{width:.0f}" height="{cap + 30:.0f}" role="img" aria-label="{NAME}">\n'
          f'  <path fill="currentColor" d="{d}"/>\n</svg>\n')
    write('mark.svg',
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Плейсхолдер знака">\n  '
          + mark_paths().format(bg=INK, fg=PAPER) + '\n</svg>\n')
    write('favicon.svg',
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">\n'
          '  '
          + mark_paths().format(bg=INK, fg=PAPER) + '\n</svg>\n')
