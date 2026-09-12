import type { TextbookSection } from '../types';
import { SECTIONS } from '../data/textbook';

/**
 * 教本本文から「要点だけ」を抜き出す。
 *
 * 本文には決まった形の 3 種類の要点が埋め込まれている。
 *   - 「# この節のまとめ」に続く箇条書き … 日常語での振り返り
 *   - 「> **試験のポイント** …」の引用     … 暗記すべき事項
 *   - 「> **よくある勘違い** …」の引用     … 先回りして潰す誤解
 * これらを本文と別に集めることで、試験直前に通しで読み返せるようにする。
 * 本文が唯一の出典なので、教本を直せばこの一覧も自動で追従する。
 */

export type DigestKind = 'recap' | 'point' | 'pitfall';

export interface DigestItem {
  kind: DigestKind;
  /** Markdown の断片（強調やコード表記を含む） */
  text: string;
}

export interface SectionDigest {
  sectionId: string;
  title: string;
  categoryId: string;
  items: DigestItem[];
}

export const DIGEST_LABEL: Record<DigestKind, string> = {
  recap: 'まとめ',
  point: '試験のポイント',
  pitfall: 'よくある勘違い',
};

/** 引用ブロックの先頭に置かれる見出しと、それが表す種類 */
const QUOTE_PREFIX: { prefix: string; kind: DigestKind }[] = [
  { prefix: '**試験のポイント**', kind: 'point' },
  { prefix: '**ここだけ覚える**', kind: 'point' },
  { prefix: '**よくある勘違い**', kind: 'pitfall' },
];

function extract(body: string): DigestItem[] {
  const items: DigestItem[] = [];
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  let inRecap = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // コードフェンス（図・ウィジェット含む）の中身は対象外
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (line.startsWith('# ')) {
      inRecap = line.trim() === '# この節のまとめ';
      continue;
    }

    // まとめの箇条書き
    if (inRecap && /^\s*-\s+/.test(line)) {
      items.push({ kind: 'recap', text: line.replace(/^\s*-\s+/, '') });
      continue;
    }

    // 引用ブロック（複数行にまたがることがある）
    if (line.startsWith('> ')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        buf.push(lines[i].slice(2));
        i++;
      }
      i--;
      const joined = buf.join(' ').trim();
      const hit = QUOTE_PREFIX.find((q) => joined.startsWith(q.prefix));
      if (hit) items.push({ kind: hit.kind, text: joined.slice(hit.prefix.length).trim() });
    }
  }
  return items;
}

const cache = new Map<string, DigestItem[]>();

export function digestOf(section: TextbookSection): DigestItem[] {
  const hit = cache.get(section.id);
  if (hit) return hit;
  const items = extract(section.body);
  cache.set(section.id, items);
  return items;
}

/** 教本全体の要点。SECTIONS の並び順を保つ */
export function allDigests(): SectionDigest[] {
  return SECTIONS.map((s) => ({
    sectionId: s.id,
    title: s.title,
    categoryId: s.categoryId,
    items: digestOf(s),
  })).filter((d) => d.items.length > 0);
}
