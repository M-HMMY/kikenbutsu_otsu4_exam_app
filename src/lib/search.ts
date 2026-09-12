import { SECTIONS } from '../data/textbook';
import { QUESTIONS } from '../data/questions';

export interface SearchHit {
  sectionId: string;
  title: string;
  categoryId: string;
  /** 本文中で最初に一致した箇所の前後 */
  snippet: { before: string; hit: string; after: string } | null;
  /** 本文中の一致件数 */
  count: number;
  /** タイトル・ねらいに一致したか（並び順で優先する） */
  inTitle: boolean;
}

/** 図やコードの記法を落として、検索とスニペット表示に使う素のテキストにする */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[a-z:]*\n[\s\S]*?```/g, ' ') // コードブロック・図・ウィジェット
    .replace(/^[#>|\-\s]+/gm, '') // 見出し・引用・表・箇条書きの記号
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** セクションごとの素のテキストを一度だけ作って使い回す */
const PLAIN = new Map<string, string>(SECTIONS.map((s) => [s.id, toPlainText(s.body)]));

export function searchSections(query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const section of SECTIONS) {
    const plain = PLAIN.get(section.id) ?? '';
    const lower = plain.toLowerCase();
    const inTitle = `${section.title}${section.goal}`.toLowerCase().includes(q);
    const index = lower.indexOf(q);
    if (!inTitle && index < 0) continue;

    let count = 0;
    let from = 0;
    while (from >= 0) {
      const next = lower.indexOf(q, from);
      if (next < 0) break;
      count += 1;
      from = next + q.length;
    }

    hits.push({
      sectionId: section.id,
      title: section.title,
      categoryId: section.categoryId,
      count,
      inTitle,
      snippet:
        index < 0
          ? null
          : {
              before: (index > 40 ? '…' : '') + plain.slice(Math.max(0, index - 40), index),
              hit: plain.slice(index, index + q.length),
              after: plain.slice(index + q.length, index + q.length + 70) + '…',
            },
    });
  }

  // タイトル一致を優先し、次に出現回数の多い順
  return hits.sort((a, b) => Number(b.inTitle) - Number(a.inTitle) || b.count - a.count);
}

/** 問題文・選択肢・解説からも探す（件数だけを返す） */
export function countMatchingQuestions(query: string): number {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return 0;
  return QUESTIONS.filter((question) =>
    `${question.question}${question.choices.join('')}${question.explanation}`.toLowerCase().includes(q),
  ).length;
}
