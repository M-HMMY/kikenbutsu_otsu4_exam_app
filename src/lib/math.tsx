import type { JSX, ReactNode } from 'react';
import { ACCENT, DECORATION, FUNCTION, SYMBOL } from './mathSymbols';

/**
 * 依存を増やさずに済ませるための、ごく軽い数式表示。
 *
 * 本文では `$...$`（行内）と ```math フェンス（別行立て）で書く。扱うのは次だけ。
 *   - `^{...}` `_{...}` … 上付き・下付き（1 文字なら波かっこを省ける: `x^2`, `w_i`）
 *   - `\alpha` などのバックスラッシュ命令 … mathSymbols.ts の表にある記号に置換
 *   - `\mathbf{x}` `\mathrm{d}` … 中身の見た目を変える（太字・立体）
 *   - `\hat{y}` `\bar{x}` … 中身の上に記号を重ねる
 *   - `\log` `\max` などの関数名 … 立体で表示して変数と区別する
 *   - `\frac{a}{b}` `\sqrt{x}` … 分数・根号
 *   - それ以外の文字はそのまま（変数はイタリック体で表示される）
 *
 * **表に無い命令は名前がそのまま画面に出る。** これは `npm run check` が警告する。
 * KaTeX を入れれば表現力は上がるが、この試験で必要な式は上の範囲でほぼ書ける。
 * 行列や総和の添字が積み上がる式など、どうしても足りない場合だけ図（```diagram:matrix）に逃がす。
 * 表現力が足りなくなったら KaTeX への差し替えを検討すること（この関数の置き換えだけで済む）。
 */

/** バックスラッシュそのもの。リテラルで書くと編集経路によって壊れやすいので定数にする */
const BACKSLASH = String.fromCharCode(92);

/** `{...}` を対応を数えて取り出す。開き波かっこの位置を渡す */
function takeGroup(src: string, open: number): { body: string; end: number } {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return { body: src.slice(open + 1, i), end: i + 1 };
    }
  }
  // 閉じかっこがない場合は残り全部を中身とみなす（本文が壊れても表示は続ける）
  return { body: src.slice(open + 1), end: src.length };
}

/** 上付き・下付きの対象を 1 つ取り出す。`^{...}` でも `^2` でも受ける */
function takeArg(src: string, at: number): { body: string; end: number } {
  if (src[at] === '{') return takeGroup(src, at);
  return { body: src[at] ?? '', end: at + 1 };
}

function render(src: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let plain = '';
  let n = 0;
  const flush = (): void => {
    if (plain !== '') {
      out.push(plain);
      plain = '';
    }
  };

  let i = 0;
  while (i < src.length) {
    const c = src[i];

    if (c === BACKSLASH) {
      const m = /^\\([A-Za-z]+)/.exec(src.slice(i));
      if (m) {
        const name = m[1];
        i += m[0].length;
        if (name === 'frac') {
          // \frac{分子}{分母}
          const num = takeGroup(src, src.indexOf('{', i));
          const den = takeGroup(src, src.indexOf('{', num.end));
          flush();
          out.push(
            <span className="frac" key={`${keyPrefix}-f${n++}`}>
              <span className="frac-num">{render(num.body, `${keyPrefix}-f${n}n`)}</span>
              <span className="frac-den">{render(den.body, `${keyPrefix}-f${n}d`)}</span>
            </span>,
          );
          i = den.end;
          continue;
        }
        if (name === 'sqrt') {
          // \sqrt{中身}。中身に上線を引いて根号の下にあることを示す
          const arg = takeArg(src, i);
          flush();
          out.push(
            <span className="sqrt" key={`${keyPrefix}-q${n++}`}>
              √<span className="sqrt-body">{render(arg.body, `${keyPrefix}-q${n}b`)}</span>
            </span>,
          );
          i = arg.end;
          continue;
        }
        const deco = DECORATION[name];
        if (deco !== undefined) {
          // \mathbf{x} のような装飾命令は、中身だけをその見た目で出す
          const arg = takeArg(src, i);
          flush();
          out.push(
            <span className={deco} key={`${keyPrefix}-d${n++}`}>
              {render(arg.body, `${keyPrefix}-d${n}b`)}
            </span>,
          );
          i = arg.end;
          continue;
        }
        const accent = ACCENT[name];
        if (accent !== undefined) {
          // \hat{y} は中身の直後に結合文字を置いて重ねる。
          // 結合文字は直前の 1 文字にしか掛からないので、中身が 1 文字に潰れたときだけ重ねる。
          const arg = takeArg(src, i);
          const inner = render(arg.body, `${keyPrefix}-a${n}b`);
          if (inner.length === 1 && typeof inner[0] === 'string') {
            plain += inner[0] + accent;
          } else {
            flush();
            out.push(
              <span className="accent" key={`${keyPrefix}-a${n++}`}>
                {inner}
              </span>,
            );
          }
          i = arg.end;
          continue;
        }
        if (FUNCTION.has(name)) {
          flush();
          out.push(
            <span className="mrm" key={`${keyPrefix}-o${n++}`}>
              {name}
            </span>,
          );
          continue;
        }
        const sym = SYMBOL[name];
        if (sym !== undefined) {
          plain += sym;
          continue;
        }
        plain += name; // 未知の命令は名前をそのまま出す（読めなくはならない）
        continue;
      }
      plain += src[i + 1] ?? ''; // \{ や \, などのエスケープ
      i += 2;
      continue;
    }

    if (c === '^' || c === '_') {
      const arg = takeArg(src, i + 1);
      flush();
      const inner = render(arg.body, `${keyPrefix}-s${n}`);
      out.push(
        c === '^' ? (
          <sup key={`${keyPrefix}-s${n++}`}>{inner}</sup>
        ) : (
          <sub key={`${keyPrefix}-s${n++}`}>{inner}</sub>
        ),
      );
      i = arg.end;
      continue;
    }

    plain += c;
    i++;
  }
  flush();
  return out;
}

/** 行内数式（`$...$`） */
export function MathInline({ expr }: { expr: string }): JSX.Element {
  return <span className="math">{render(expr, 'mi')}</span>;
}

/** 別行立ての数式（```math フェンス）。1 行 1 式で書く */
export function MathBlock({ source }: { source: string }): JSX.Element {
  const lines = source
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
  return (
    <div className="math-block">
      {lines.map((l, i) => (
        <div className="math-line" key={i}>
          <span className="math">{render(l, `mb${i}`)}</span>
        </div>
      ))}
    </div>
  );
}
