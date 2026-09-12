import { useState, type JSX, type ReactNode } from 'react';

/**
 * 節の中に置く一問一答。
 *
 * 本文の ```quiz ブロックから呼ばれる。1 行 1 問で、`問い :: 答え` と書く。
 * 採点も記録もしない。**読んだ直後に「言えるかどうか」を自分で確かめる**ためのもので、
 * 得点として記録したい場合は確認問題へ進んでもらう。
 *
 * 用語中心の節は図やウィジェットを置きにくく、読み流しになりやすいので、
 * ここで一度手を止めさせるのが狙い。
 */

interface Item {
  q: string;
  a: string;
}

function parse(source: string): Item[] {
  const items: Item[] = [];
  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const i = line.indexOf('::');
    if (i < 0) continue;
    items.push({ q: line.slice(0, i).trim(), a: line.slice(i + 2).trim() });
  }
  return items;
}

export function SelfCheck({
  source,
  render,
}: {
  source: string;
  /** 問いと答えのインライン記法（数式・コード表記）を描く。Markdown レンダラから渡される */
  render?: (text: string, key: string) => ReactNode;
}): JSX.Element | null {
  const draw = (text: string, key: string): ReactNode => (render ? render(text, key) : text);
  const items = parse(source);
  const [open, setOpen] = useState<Set<number>>(new Set());

  if (items.length === 0) return null;

  const allOpen = open.size === items.length;

  const toggle = (i: number): void => {
    const next = new Set(open);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setOpen(next);
  };

  return (
    <section className="selfcheck">
      <div className="selfcheck-head">
        <h4 className="selfcheck-title">言えるか試す（{items.length} 問）</h4>
        <button
          type="button"
          className="btn small ghost"
          onClick={() => setOpen(allOpen ? new Set() : new Set(items.map((_, i) => i)))}
        >
          {allOpen ? 'すべて隠す' : 'すべて表示'}
        </button>
      </div>
      <p className="selfcheck-note">
        答えを見る前に、まず自分の言葉で言ってみてください。詰まった項目が、いま戻るべき場所です。
      </p>
      <ol className="selfcheck-list">
        {items.map((it, i) => (
          <li key={i} className={`selfcheck-item ${open.has(i) ? 'open' : ''}`}>
            <button type="button" className="selfcheck-q" onClick={() => toggle(i)} aria-expanded={open.has(i)}>
              <span className="selfcheck-mark" aria-hidden>
                {open.has(i) ? '−' : '+'}
              </span>
              <span>{draw(it.q, `q${i}`)}</span>
            </button>
            {open.has(i) && <p className="selfcheck-a">{draw(it.a, `a${i}`)}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
