import type { Question } from '../types';

/**
 * 正解の扱いを 1 か所にまとめる。
 *
 * **公式の出題形式は五肢択一式で、複数選択は含まれない。**
 * そのため `Question.answer` は「添字ひとつ」または「添字の配列」の
 * どちらかを取る。比較のたびに場合分けを書くと採点の実装が
 * 画面ごとにずれていくので、読むのも比べるのもここを通す。
 *
 * **選択の状態は、単一選択でも配列で持つ。**`number | null` と
 * `number[]` を画面ごとに使い分けると、未選択の表し方が
 * `null` と `[]` の 2 通りになって必ず取りこぼす。空配列が未選択。
 */

/** 正解の添字を、単一選択・複数選択のどちらでも昇順の配列で返す */
export function answerIndices(answer: Question['answer']): number[] {
  return typeof answer === 'number' ? [answer] : [...answer].sort((a, b) => a - b);
}

/** 複数選択の問題か */
export function isMultiAnswer(answer: Question['answer']): boolean {
  return typeof answer !== 'number';
}

/**
 * 解答が正解かどうか。
 *
 * **複数選択は完全一致だけを正解とする。**
 * この試験は五肢択一で、複数選択は公式の形式に含まれない。仮に作る場合も、部分点の規則は公表されていないので、決めるとしたら
 * それはこちらの創作になる。分からないことを勝手に決めない方針
 * （合否を判定しないのと同じ理由）に合わせて、全部合って正解とする。
 */
export function isCorrectAnswer(answer: Question['answer'], selected: readonly number[]): boolean {
  const want = answerIndices(answer);
  if (selected.length !== want.length) return false;
  const got = new Set(selected);
  return want.every((i) => got.has(i));
}

/**
 * 選択肢を押したときの次の選択状態を返す。
 *
 * 単一選択は置き換え（押し直しで変更できる）。
 * 複数選択はトグル（押すたびに入り切りする）。
 */
export function toggleChoice(
  answer: Question['answer'],
  selected: readonly number[],
  index: number,
): number[] {
  if (!isMultiAnswer(answer)) return [index];
  return selected.includes(index)
    ? selected.filter((i) => i !== index)
    : [...selected, index].sort((a, b) => a - b);
}
