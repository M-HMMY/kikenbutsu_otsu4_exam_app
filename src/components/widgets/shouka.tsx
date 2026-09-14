import { useState, type JSX } from 'react';

/**
 * 燃焼の 3 要素を 1 つずつ外して、どの消火法にあたるかを見るツール。
 *
 * **消火は燃焼の裏返し**という筋道を、押して確かめるための道具。
 * 除去・窒息・冷却は 3 要素を 1 つ取り除く方法で、
 * **抑制消火だけが 3 要素の外**（連鎖反応そのものを止める）。
 * ここが言葉だけだと頭に入らないので、抑制は別の欄に置いてある。
 */

export const widgetId = 'shouka';

interface Element {
  id: 'fuel' | 'oxygen' | 'heat';
  name: string;
  desc: string;
  method: string;
  example: string;
}

const ELEMENTS: Element[] = [
  {
    id: 'fuel',
    name: '可燃物',
    desc: '燃えるもの。第 4 類では、液体から出た蒸気が燃えます',
    method: '除去消火',
    example: 'ガスの元栓を閉める。ろうそくを吹き消す。燃えていない油を移す',
  },
  {
    id: 'oxygen',
    name: '酸素供給源',
    desc: '空気中の酸素のほか、第 1 類・第 6 類のように分解して酸素を出すものもあります',
    method: '窒息消火',
    example: '泡で液面を覆う。二酸化炭素や粉末で酸素を遮る。第 4 類はこれが基本',
  },
  {
    id: 'heat',
    name: '点火源となる熱',
    desc: '火花、静電気、高温体。第 4 類では静電気が大きな点火源です',
    method: '冷却消火',
    example: '水をかけて温度を下げる。水の比熱が大きいから効きます',
  },
];

export default function ShoukaWidget(): JSX.Element {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [chain, setChain] = useState(true);

  const burning = removed.size === 0 && chain;

  const toggle = (id: string): void => {
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const used = ELEMENTS.filter((e) => removed.has(e.id));

  return (
    <div className="widget-body">
      <p className="widget-lead">
        燃焼の 3 要素を押して取り除いてください。
        <strong>1 つでも欠ければ火は消えます。</strong>
        取り除いた要素が、どの消火法にあたるかが下に出ます。
      </p>

      <div className="widget-grid">
        {ELEMENTS.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`widget-card ${removed.has(e.id) ? 'off' : 'on'}`}
            onClick={() => toggle(e.id)}
            aria-pressed={removed.has(e.id)}
          >
            <strong>{e.name}</strong>
            <span className="widget-note">{e.desc}</span>
            <span className="widget-state">{removed.has(e.id) ? '取り除いた' : 'ある'}</span>
          </button>
        ))}
      </div>

      <div className="widget-grid">
        <button
          type="button"
          className={`widget-card ${chain ? 'on' : 'off'}`}
          onClick={() => setChain((c) => !c)}
          aria-pressed={!chain}
        >
          <strong>連鎖反応</strong>
          <span className="widget-note">
            3 要素の外。燃焼が次々に続いていく反応そのものです
          </span>
          <span className="widget-state">{chain ? '続いている' : '止めた'}</span>
        </button>
      </div>

      <p className={`widget-result tone-${burning ? 'danger' : 'safe'}`}>
        {burning ? (
          <>
            <strong>燃えています。</strong>可燃物・酸素供給源・点火源の 3 つがそろい、
            連鎖反応が続いています。
          </>
        ) : (
          <>
            <strong>消えました。</strong>
            {used.length > 0 && (
              <>
                {' '}
                {used.map((e) => `${e.name}を取り除いたので「${e.method}」`).join('、')}。
              </>
            )}
            {!chain && ' 連鎖反応を止めたので「抑制消火（負触媒効果）」。'}
          </>
        )}
      </p>

      {used.map((e) => (
        <p key={e.id} className="widget-note">
          <strong>{e.method}</strong> — {e.example}
        </p>
      ))}

      {!chain && (
        <p className="widget-note">
          <strong>抑制消火</strong> — ハロゲン化物や粉末消火剤のはたらき。
          <strong>これだけが 3 要素を取り除く方法ではありません。</strong>
          燃焼が続いていく反応そのものを止める、別の理屈です。
        </p>
      )}
    </div>
  );
}
