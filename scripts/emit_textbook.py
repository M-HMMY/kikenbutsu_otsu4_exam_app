# -*- coding: utf-8 -*-
"""教本セクションを TypeScript ファイルに書き出す小道具。

本文は Markdown のまま Python 側の raw 文字列で書き、ここで TS の
テンプレートリテラル用にエスケープする（バックスラッシュ・バックティック・${）。
手で TS を書くと数式のバックスラッシュを二重にし忘れて壊れるため、この経路を使う。
"""
import io
import os

BS = chr(92)
BT = chr(96)


def esc(s):
    s = s.replace(BS, BS + BS)
    s = s.replace(BT, BS + BT)
    s = s.replace('${', BS + '${')
    return s


def emit(path, varname, sections):
    out = [
        "import type { TextbookSection } from '../../types';",
        '',
        'export const %s: TextbookSection[] = [' % varname,
    ]
    for s in sections:
        out.append('  {')
        out.append("    id: '%s'," % s['id'])
        out.append("    categoryId: '%s'," % s['categoryId'])
        out.append("    title: '%s'," % s['title'])
        out.append("    goal: '%s'," % s['goal'])
        out.append('    minutes: %d,' % s['minutes'])
        out.append('    body: %s%s%s,' % (BT, esc(s['body']), BT))
        out.append('  },')
    out.append('];')
    out.append('')
    d = os.path.dirname(path)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    io.open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(out))
    total = sum(len(s['body']) for s in sections)
    print('%s: %d 節 / %d 字' % (path, len(sections), total))
