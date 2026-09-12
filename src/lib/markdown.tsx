import type { JSX, ReactNode } from 'react';
import { Diagram } from '../components/Diagram';
import { Widget } from '../components/Widget';
import { SelfCheck } from '../components/SelfCheck';
import { MathBlock, MathInline } from './math';
import { navigate } from './router';

/**
 * 教本本文用の軽量 Markdown レンダラ。
 * 依存を増やさずに済ませるため、必要な記法だけを実装している。
 *   見出し(#/##/###) / 箇条書き(- , 1.) / 表 / コードブロック(```) /
 *   引用(> ) / **強調** / `コード` / [文字](リンク先) / $数式$ / 水平線(---)
 *
 * リンク先はアプリ内のルート（例: textbook/m-linalg-1、drill、practice?section=…）だけを
 * 受け付ける。外部 URL は扱わない（このアプリは通信をしない設計のため）。
 */

/** リンクの中身に強調とコード表記だけを許す（入れ子のリンクは作らない） */
function linkLabel(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) nodes.push(<strong key={`${keyPrefix}-lb${i}`}>{token.slice(2, -2)}</strong>);
    else nodes.push(<code key={`${keyPrefix}-lc${i}`}>{token.slice(1, -1)}</code>);
    last = m.index + token.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** インライン記法（**強調** / `コード` / [文字](リンク先) / $数式$）を処理する */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|`[^`]+`|\$[^$\n]+\$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('$')) {
      nodes.push(<MathInline key={`${keyPrefix}-m${i}`} expr={token.slice(1, -1)} />);
    } else if (token.startsWith('[')) {
      const cut = token.indexOf('](');
      const label = token.slice(1, cut);
      const to = token.slice(cut + 2, -1);
      nodes.push(
        <button
          key={`${keyPrefix}-l${i}`}
          type="button"
          className="md-link"
          onClick={() => navigate(to)}
        >
          {linkLabel(label, `${keyPrefix}-l${i}`)}
        </button>,
      );
    } else if (token.startsWith('**')) {
      // 強調の中にも数式やコード表記が入る（**$\sum$ を for と読む** のような書き方をする）。
      // 正規表現の都合で中身に ** は現れないため、再帰しても入れ子にはならない。
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{inline(token.slice(2, -2), `${keyPrefix}-b${i}`)}</strong>);
    } else {
      nodes.push(<code key={`${keyPrefix}-c${i}`}>{token.slice(1, -1)}</code>);
    }
    last = m.index + token.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** 教本で決まった役割を持つ見出し。読み手への合図として見た目を変える */
const SPECIAL_HEADINGS: Record<string, string | undefined> = {
  'ざっくり言うと': 'h-primer',
  'この節のまとめ': 'h-recap',
};

/** 引用ブロックは用途によって色を変える（試験のポイント／よくある勘違い／要点） */
function calloutClass(firstLine: string): string | undefined {
  if (firstLine.startsWith('**よくある勘違い**')) return 'qt-pitfall';
  if (firstLine.startsWith('**試験のポイント**')) return 'qt-exam';
  if (firstLine.startsWith('**ここだけ覚える**')) return 'qt-key';
  return undefined;
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:-]*-[\s|:-]*$/.test(line) && line.includes('-');
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());
}

/** ヒアドキュメント経由の編集で壊れやすいので、改行はここで一度だけ作る */
const LF = String.fromCharCode(10);

export function Markdown({ source }: { source: string }): JSX.Element {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const k = () => `md-${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    // 空行
    if (line.trim() === '') {
      i++;
      continue;
    }

    // コードブロック
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 閉じる ```
      // ```diagram:flow → 図、```widget:radix → 対話ウィジェット
      if (lang.startsWith('diagram:')) {
        out.push(<Diagram key={k()} type={lang.slice('diagram:'.length)} source={buf.join('\n')} />);
        continue;
      }
      if (lang === 'math') {
        out.push(<MathBlock key={k()} source={buf.join(LF)} />);
        continue;
      }
      if (lang === 'quiz') {
        out.push(<SelfCheck key={k()} source={buf.join('\n')} render={(text, id) => inline(text, id)} />);
        continue;
      }
      if (lang.startsWith('widget:')) {
        out.push(<Widget key={k()} id={lang.slice('widget:'.length)} />);
        continue;
      }
      out.push(
        <pre key={k()} className={`code-block${lang ? ` lang-${lang}` : ''}`}>
          <code>{buf.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // 水平線
    if (/^---+$/.test(line.trim())) {
      out.push(<hr key={k()} />);
      i++;
      continue;
    }

    // 見出し
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = inline(h[2], k());
      if (level === 1) out.push(<h2 key={k()} className={SPECIAL_HEADINGS[h[2].trim()]}>{content}</h2>);
      else if (level === 2) out.push(<h3 key={k()}>{content}</h3>);
      else out.push(<h4 key={k()}>{content}</h4>);
      i++;
      continue;
    }

    // 表
    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(
        <div key={k()} className="table-wrap">
          <table>
            <thead>
              <tr>
                {header.map((c, ci) => (
                  <th key={ci}>{inline(c, `${k()}-th${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{inline(c, `${k()}-td${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 引用（＝ポイント枠として使う）
    if (line.startsWith('> ')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        buf.push(lines[i].slice(2));
        i++;
      }
      out.push(
        <blockquote key={k()} className={calloutClass(buf[0] ?? '')}>
          {buf.map((b, bi) => (
            <p key={bi}>{inline(b, `${k()}-q${bi}`)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // 箇条書き（- / 1.）。2 スペースで 1 段のネストに対応
    if (/^\s*(-|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: { depth: number; text: string }[] = [];
      while (i < lines.length && /^\s*(-|\d+\.)\s+/.test(lines[i])) {
        const indent = /^\s*/.exec(lines[i])![0].length;
        items.push({ depth: indent >= 2 ? 1 : 0, text: lines[i].replace(/^\s*(-|\d+\.)\s+/, '') });
        i++;
      }
      const render = (from: number): ReactNode[] => {
        const nodes: ReactNode[] = [];
        let j = from;
        while (j < items.length) {
          if (items[j].depth === 1) {
            const sub: string[] = [];
            while (j < items.length && items[j].depth === 1) {
              sub.push(items[j].text);
              j++;
            }
            nodes.push(
              <ul key={k()} className="nested">
                {sub.map((s, si) => (
                  <li key={si}>{inline(s, `${k()}-s${si}`)}</li>
                ))}
              </ul>,
            );
          } else {
            nodes.push(<li key={k()}>{inline(items[j].text, k())}</li>);
            j++;
          }
        }
        return nodes;
      };
      const children = render(0);
      out.push(ordered ? <ol key={k()}>{children}</ol> : <ul key={k()}>{children}</ul>);
      continue;
    }

    // 段落（連続する通常行をまとめる）
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith('> ') &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^\s*(-|\d+\.)\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith('|')
    ) {
      buf.push(lines[i]);
      i++;
    }
    // `|` で始まるのに表にならなかった行（区切り行がない、単独の `|` など）は、
    // 上のどの分岐にも当たらず、この while も 1 行目で止まるため i が進まない。
    // すると外側のループが同じ行を延々と処理し続けて固まる（実際に起きた）。
    // 最後の砦として、1 行も取れなかったときは強制的に 1 行進める。
    if (buf.length === 0) {
      buf.push(lines[i]);
      i++;
    }
    out.push(<p key={k()}>{inline(buf.join(' '), k())}</p>);
  }

  return <div className="md">{out}</div>;
}
