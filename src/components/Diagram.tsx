import type { JSX, ReactNode } from 'react';

/**
 * 教本本文に図を埋め込むための軽量ダイアグラム。
 * Markdown 中の ```diagram:<種類> ブロックから呼ばれる。
 *
 * 記法（共通）
 *   - `キー: 値` の行は指示子（title / top / bottom / x / y / note / actors）
 *   - それ以外の行は要素。`ラベル :: 補足` で補足を付けられる
 *   - 行頭の 2 スペースひとつがネスト 1 段（tree のみ）
 *
 * SVG ではなく HTML で組んでいるので、狭い画面では自動的に折り返り、
 * 文字も選択できる。配色はテーマ変数を使うためダークモードにも追従する。
 */

interface Item {
  label: string;
  note?: string;
  depth: number;
}

interface Parsed {
  directives: Record<string, string>;
  items: Item[];
}

const DIRECTIVE_KEYS = new Set(['title', 'top', 'bottom', 'x', 'y', 'note', 'actors', 'caption']);

function parse(source: string): Parsed {
  const directives: Record<string, string> = {};
  const items: Item[] = [];
  for (const raw of source.replace(/\r\n/g, '\n').split('\n')) {
    if (raw.trim() === '') continue;
    const m = /^([a-z]+):\s*(.*)$/.exec(raw.trim());
    if (m && DIRECTIVE_KEYS.has(m[1])) {
      directives[m[1]] = m[2];
      continue;
    }
    const indent = /^\s*/.exec(raw)![0].length;
    const [label, note] = raw.trim().split('::');
    items.push({ label: label.trim(), note: note?.trim(), depth: Math.floor(indent / 2) });
  }
  return { directives, items };
}

function Frame({
  title,
  caption,
  note,
  className,
  children,
}: {
  title?: string;
  caption?: string;
  note?: string;
  className: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <figure className={`dgm ${className}`}>
      {title && <figcaption className="dgm-title">{title}</figcaption>}
      {children}
      {note && <p className="dgm-note">{note}</p>}
      {caption && <p className="dgm-caption">{caption}</p>}
    </figure>
  );
}

/** 横に流れる工程図。要素が多いときは自動で折り返す */
function Flow({ directives, items }: Parsed): JSX.Element {
  return (
    <Frame className="dgm-flow" title={directives.title} note={directives.note} caption={directives.caption}>
      <div className="flow-row">
        {items.map((it, i) => (
          <div key={i} className="flow-unit">
            <div className="flow-box">
              <span className="flow-label">{it.label}</span>
              {it.note && <span className="flow-note">{it.note}</span>}
            </div>
            {i < items.length - 1 && (
              <span className="flow-arrow" aria-hidden>
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** 上下に積み上げる階層図（記憶階層・OSI 参照モデル・ポリシ体系など） */
function Stack({ directives, items }: Parsed): JSX.Element {
  return (
    <Frame className="dgm-stack" title={directives.title} note={directives.note} caption={directives.caption}>
      <div className="stack-wrap">
        <div className="stack-axis">
          {directives.top && <span className="stack-axis-top">{directives.top}</span>}
          <span className="stack-axis-line" aria-hidden />
          {directives.bottom && <span className="stack-axis-bottom">{directives.bottom}</span>}
        </div>
        <div className="stack-layers">
          {items.map((it, i) => (
            <div key={i} className="stack-layer" style={{ width: `${100 - i * (40 / Math.max(items.length, 2))}%` }}>
              <span className="stack-label">{it.label}</span>
              {it.note && <span className="stack-note">{it.note}</span>}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** インデントで階層を表すツリー図 */
function Tree({ directives, items }: Parsed): JSX.Element {
  return (
    <Frame className="dgm-tree" title={directives.title} note={directives.note} caption={directives.caption}>
      <ul className="tree">
        {items.map((it, i) => (
          <li key={i} className={`tree-node depth-${Math.min(it.depth, 4)}`}>
            <span className="tree-label">{it.label}</span>
            {it.note && <span className="tree-note">{it.note}</span>}
          </li>
        ))}
      </ul>
    </Frame>
  );
}

/** 2×2 のマトリクス（PPM・SWOT・アンゾフなど）。要素は 左上→右上→左下→右下 の順 */
function Matrix({ directives, items }: Parsed): JSX.Element {
  const cells = items.slice(0, 4);
  return (
    <Frame className="dgm-matrix" title={directives.title} note={directives.note} caption={directives.caption}>
      <div className="matrix-wrap">
        {directives.y && <div className="matrix-y">{directives.y}</div>}
        <div className="matrix-grid">
          {cells.map((c, i) => (
            <div key={i} className={`matrix-cell cell-${i}`}>
              <span className="matrix-label">{c.label}</span>
              {c.note && <span className="matrix-note">{c.note}</span>}
            </div>
          ))}
        </div>
        {directives.x && <div className="matrix-x">{directives.x}</div>}
      </div>
    </Frame>
  );
}

/** 円環（PDCA など）。2×2 に配置して戻り矢印を添える */
function Cycle({ directives, items }: Parsed): JSX.Element {
  return (
    <Frame className="dgm-cycle" title={directives.title} note={directives.note} caption={directives.caption}>
      <div className="cycle-grid">
        {items.map((it, i) => (
          <div key={i} className="cycle-item">
            <span className="cycle-index">{i + 1}</span>
            <span className="cycle-label">{it.label}</span>
            {it.note && <span className="cycle-note">{it.note}</span>}
          </div>
        ))}
      </div>
      <p className="cycle-loop" aria-hidden>
        ↻ 最後の要素から先頭へ戻って繰り返す
      </p>
    </Frame>
  );
}

/** やり取りの順序図。`A -> B :: 内容` の形で書く */
function Seq({ directives, items }: Parsed): JSX.Element {
  const actors = (directives.actors ?? '').split('|').map((a) => a.trim()).filter(Boolean);
  const rows = items.map((it) => {
    const m = /^(.+?)\s*(->|<-)\s*(.+)$/.exec(it.label);
    if (!m) return { from: '', to: '', text: it.label, note: it.note, reverse: false };
    const from = m[1].trim();
    const to = m[3].trim();
    const reverse = actors.length >= 2 ? actors.indexOf(from) > actors.indexOf(to) : m[2] === '<-';
    return { from, to, text: it.note ?? '', note: undefined, reverse };
  });
  return (
    <Frame className="dgm-seq" title={directives.title} note={directives.note} caption={directives.caption}>
      {actors.length > 0 && (
        <div className="seq-actors">
          {actors.map((a) => (
            <span key={a} className="seq-actor">
              {a}
            </span>
          ))}
        </div>
      )}
      <ol className="seq-rows">
        {rows.map((r, i) => (
          <li key={i} className={`seq-row ${r.reverse ? 'rev' : ''}`}>
            <span className="seq-step">{i + 1}</span>
            <span className="seq-line" aria-hidden>
              <span className="seq-arrow">{r.reverse ? '←' : '→'}</span>
            </span>
            <span className="seq-text">
              {r.from && (
                <span className="seq-endpoints">
                  {r.from} {r.reverse ? '←' : '→'} {r.to}
                </span>
              )}
              <span className="seq-body">{r.text || r.note}</span>
            </span>
          </li>
        ))}
      </ol>
    </Frame>
  );
}

/**
 * ビット列の図。1 行目にビット、`labels:` に各ビットの意味を書く。
 * `|` で区切るとグループ（4 ビットずつなど）に分かれる。
 */
function Bits({ directives, items }: Parsed): JSX.Element {
  const bitLine = items[0]?.label ?? '';
  const labelLine = items[1]?.label ?? '';
  const groups = bitLine.split('|').map((g) => g.trim().split(/\s+/).filter(Boolean));
  const labels = labelLine ? labelLine.replace(/\|/g, ' ').trim().split(/\s+/) : [];
  let index = 0;
  return (
    <Frame className="dgm-bits" title={directives.title} note={directives.note} caption={directives.caption}>
      <div className="bits-row">
        {groups.map((g, gi) => (
          <div key={gi} className="bits-group">
            {g.map((b, bi) => {
              const label = labels[index];
              index += 1;
              return (
                <div key={bi} className="bit-cell">
                  <span className={`bit-value ${b === '1' ? 'on' : ''}`}>{b}</span>
                  {label && <span className="bit-label">{label}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** 対比図。左右 2 つの塊を並べて違いを示す */
function Compare({ directives, items }: Parsed): JSX.Element {
  const left = items.filter((_, i) => i % 2 === 0);
  const right = items.filter((_, i) => i % 2 === 1);
  const heads = (directives.actors ?? '').split('|').map((s) => s.trim());
  return (
    <Frame className="dgm-compare" title={directives.title} note={directives.note} caption={directives.caption}>
      <div className="compare-grid">
        <div className="compare-col">
          {heads[0] && <h4 className="compare-head">{heads[0]}</h4>}
          {left.map((it, i) => (
            <div key={i} className="compare-item">
              <span className="compare-label">{it.label}</span>
              {it.note && <span className="compare-note">{it.note}</span>}
            </div>
          ))}
        </div>
        <div className="compare-col">
          {heads[1] && <h4 className="compare-head">{heads[1]}</h4>}
          {right.map((it, i) => (
            <div key={i} className="compare-item">
              <span className="compare-label">{it.label}</span>
              {it.note && <span className="compare-note">{it.note}</span>}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function Diagram({ type, source }: { type: string; source: string }): JSX.Element {
  const parsed = parse(source);
  switch (type) {
    case 'flow':
      return <Flow {...parsed} />;
    case 'stack':
      return <Stack {...parsed} />;
    case 'tree':
      return <Tree {...parsed} />;
    case 'matrix':
      return <Matrix {...parsed} />;
    case 'cycle':
      return <Cycle {...parsed} />;
    case 'seq':
      return <Seq {...parsed} />;
    case 'bits':
      return <Bits {...parsed} />;
    case 'compare':
      return <Compare {...parsed} />;
    default:
      return (
        <figure className="dgm dgm-unknown">
          <p>未対応の図の種類「{type}」です。</p>
          <pre className="code-block">
            <code>{source}</code>
          </pre>
        </figure>
      );
  }
}
