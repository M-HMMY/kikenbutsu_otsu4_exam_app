import { useEffect } from 'react';

/**
 * 画面全体のキーボードショートカット。
 * 入力欄にフォーカスがあるときと、修飾キーを伴うときは何もしない
 * （ブラウザ標準の操作を奪わないため）。
 */
export function useKeys(handler: (key: string) => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      handler(e.key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handler]);
}

/**
 * 「1」〜「5」が押されたら 0〜4 を返す。それ以外は null。
 *
 * **この試験は五肢択一なので既定は 5。**四肢択一の姉妹アプリから写すと 4 のままになる。
 * 手応えの選択など、5 未満の場面では `max` を渡して絞ること。
 */
export function choiceIndexOf(key: string, max = 5): number | null {
  const n = Number(key);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n - 1;
}
