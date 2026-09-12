import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../src/lib/markdown';
import { SECTIONS } from '../src/data/textbook';
import { QUESTIONS } from '../src/data/questions';
import { DRILLS } from '../src/data/drills';

/**
 * 実際に描いてみて、画面に出てはいけないものが残っていないかを見る検査。
 * `npm run check` から呼ばれる（check.ts と違い、こちらは React を通す）。
 *
 * 型でも記法の検査でも捕まらない崩れ方が実際にあった。
 *   - `$...$` が強調の中にあると数式にならず、$ ごと画面に出ていた
 *   - `\mathbf{x}` の波かっこが記号にならず `{x}` と出ていた
 *   - ウィジェットの入力欄に NaN が入り込み、画面に NaN と出ていた
 * どれも「描いてみれば一目で分かる」たぐいなので、機械にやらせる。
 *
 * 計算ドリルは値が毎回変わるので、何度か引いて確かめる。
 */

const BACKSLASH = String.fromCharCode(92);

/**
 * ウィジェットは import.meta.glob 経由だと check から読めないので、ここに直接並べる。
 * `src/components/widgets/` にファイルを足したら、この一覧にも足すこと
 * （足し忘れても動くが、描画の検査だけ素通りしてしまう）。
 */
const WIDGETS: [string, ComponentType][] = [
  // まだ 1 つも作っていない。`src/components/widgets/<id>.tsx` を足したら、
  // import 文とこの一覧の両方へ足すこと。
];

/** 数式として描かれた部分だけを取り出す */
function mathTexts(html: string): string[] {
  const out: string[] = [];
  const re = /<span class="math">([\s\S]*?)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1].replace(/<[^>]+>/g, ''));
  return out;
}

function inspect(label: string, source: string, problems: string[]): void {
  const html = renderToStaticMarkup(<Markdown source={source} />);
  for (const t of mathTexts(html)) {
    if (t.includes('{') || t.includes('}')) {
      problems.push(`${label}: 数式に波かっこがそのまま出ている → ${t.slice(0, 60)}`);
    }
    if (t.includes(BACKSLASH)) {
      problems.push(`${label}: 数式にバックスラッシュがそのまま出ている → ${t.slice(0, 60)}`);
    }
  }
  if (html.includes('$')) {
    const at = html.indexOf('$');
    problems.push(`${label}: $ が数式にならず本文に出ている → ${html.slice(Math.max(0, at - 40), at + 40).replace(/<[^>]+>/g, '')}`);
  }
  if (html.includes('未対応の図の種類')) problems.push(`${label}: 未対応の図がある`);
}

/** 見つかった問題の一覧を返す。空なら異常なし */
export function renderCheck(): string[] {
  const problems: string[] = [];
  for (const s of SECTIONS) inspect(`教本 ${s.id}`, s.body, problems);
  for (const q of QUESTIONS) {
    inspect(`問題 ${q.id}`, q.question, problems);
    inspect(`問題 ${q.id}`, q.explanation, problems);
    q.choices.forEach((c) => inspect(`問題 ${q.id}`, c, problems));
  }
  for (const d of DRILLS) {
    for (let i = 0; i < 40; i++) {
      const item = d.generate();
      inspect(`ドリル ${d.id}`, item.question, problems);
      inspect(`ドリル ${d.id}`, item.explanation, problems);
      item.choices.forEach((c) => inspect(`ドリル ${d.id}`, c, problems));
    }
  }
  for (const [id, Component] of WIDGETS) {
    let html = '';
    try {
      html = renderToStaticMarkup(<Component />);
    } catch (e) {
      problems.push(`ウィジェット ${id}: 描画に失敗した → ${String(e).slice(0, 80)}`);
      continue;
    }
    // ウィジェットは JSX なので Markdown 記法は効かない。$...$ を書いても数式にならない
    if (html.includes('$')) problems.push(`ウィジェット ${id}: $ が数式にならずそのまま出ている`);
    if (html.includes('**')) problems.push(`ウィジェット ${id}: ** が強調にならずそのまま出ている`);
    if (html.includes('NaN')) problems.push(`ウィジェット ${id}: NaN が画面に出ている`);
    if (html.includes('Infinity')) problems.push(`ウィジェット ${id}: Infinity が画面に出ている`);
    if (html.includes('undefined')) problems.push(`ウィジェット ${id}: undefined が画面に出ている`);
  }
  // 同じ崩れを何度も報告しても仕方がないのでまとめる
  return [...new Set(problems)];
}
