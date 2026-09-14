/**
 * 本文ファイルの「テンプレートリテラルの壊れ」を、束ねる前に見つける検査。
 *
 * `npm run check` の本体（scripts/check.ts）は esbuild で束ねてから動く。
 * だから **本文ファイルが構文として壊れていると、検査そのものが動かない。**
 * そのとき esbuild が出すのは
 *
 *     Expected "}" but found "diagram"
 *       26 │ ```diagram:flow
 *
 * という、原因が読み取れないメッセージだけになる。
 *
 * 本文は TypeScript のテンプレートリテラル（body: ` … `）の中にあるので、
 * **中のバックティックは `\`` と書かなければならない。**
 * ` ```diagram ` や ` ```quiz ` のフェンスを生で書くと、そこで本文が終わったことになり、
 * 続きが TypeScript のコードとして読まれて崩れる。
 * CLAUDE.md の「バックスラッシュの落とし穴」に書いてある型で、
 * 実際に法令の章を書かせたときに起きた（2026 年 9 月 13 日）。
 *
 * この検査は本文を**ただの文字列として**読むので、壊れていても動く。
 * だから `npm run check` の最初に置いてある。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BT = String.fromCharCode(96); // `
const BS = String.fromCharCode(92); // \

/** 検査するディレクトリ（本文と問題文が入っているところ） */
const ROOTS = ['src/data/textbook', 'src/data/questions'];

/** ソースを再帰で集める（拡張子で絞る） */
function listSrc(dir, exts = ['.ts']) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listSrc(p, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const problems = [];

for (const root of ROOTS) {
  let files;
  try {
    files = listSrc(root);
  } catch {
    continue; // まだ無いディレクトリは飛ばす
  }

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');

    lines.forEach((line, i) => {
      // 行頭のフェンスが生のままになっていないか。
      // 正しくは \`\`\`diagram:flow のようにエスケープされている。
      if (line.startsWith(BT + BT + BT)) {
        problems.push({
          file,
          line: i + 1,
          text: line.slice(0, 40),
          why: 'フェンスが生のバックティックです。' + BS + BT + BS + BT + BS + BT + ' と書いてください',
        });
      }
    });

    // 本文（body: ` … `）の中に、エスケープされていないバックティックが無いか。
    // 上のフェンス検査で拾えない「行の途中の `code`」を捕まえる。
    const bodyOpen = /body:\s*`/g;
    let m;
    while ((m = bodyOpen.exec(text)) !== null) {
      const start = m.index + m[0].length;
      // 本文の終わりは 改行 + バックティック + カンマ
      const endMark = '\n' + BT + ',';
      const end = text.indexOf(endMark, start);
      if (end === -1) {
        problems.push({
          file,
          line: text.slice(0, start).split('\n').length,
          text: 'body: ' + BT,
          why: '本文の閉じ（改行 + バックティック + カンマ）が見つかりません',
        });
        break;
      }
      const body = text.slice(start, end);
      for (let i = 0; i < body.length; i += 1) {
        if (body[i] === BT && body[i - 1] !== BS) {
          const lineNo = text.slice(0, start + i).split('\n').length;
          problems.push({
            file,
            line: lineNo,
            text: body.slice(Math.max(0, i - 20), i + 10).replace(/\n/g, '\\n'),
            why: 'エスケープされていないバックティックです',
          });
          break; // 1 か所ぶんだけ挙げれば十分（直せば次が見える）
        }
      }
      bodyOpen.lastIndex = end;
    }
  }
}

// --- 四肢択一の名残 ---
//
// **この試験は五肢択一。**姉妹アプリ 5 本はすべて四肢択一だったので、
// 移植したコードのあちこちに「4」が残る。型では防げない。
//
// 実際に残っていたもの（2026 年 9 月 13 日に発見）
//   - 画面のキーボード案内「1〜4 で選択」…… 3 画面。
//     `choiceIndexOf` は 5 に直っていたので、**押せば動くのに案内だけが 4** だった
//   - `scripts/drive.mjs` が選択肢を /^[アイウエ]/ で拾っていた …… 5 つめを数えていなかった
//
// どちらも「壊れていないように見えて、5 つめだけが無いことになる」壊れ方をする。
{
  const FOUR = [
    {
      roots: ['src/pages', 'src/components'],
      exts: ['.tsx', '.ts'],
      re: /<kbd>1<\/kbd>\s*〜\s*<kbd>4<\/kbd>/,
      why: '画面の案内が「1〜4」です。五肢択一なので「1〜5」にしてください',
    },
    {
      roots: ['src/pages', 'src/components', 'src/lib', 'scripts'],
      exts: ['.tsx', '.ts', '.mjs'],
      re: /\[アイウエ\]/,
      why: '選択肢を「ア〜エ」で拾っています。五肢択一なので「オ」まで含めてください',
    },
    {
      roots: ['src/lib'],
      exts: ['.ts'],
      re: /choiceIndexOf\(key: string, max = 4\)/,
      why: 'choiceIndexOf の既定値が 4 です。五肢択一なので 5 にしてください',
    },
  ];

  for (const rule of FOUR) {
    for (const root of rule.roots) {
      let files;
      try {
        files = listSrc(root, rule.exts);
      } catch {
        continue;
      }
      for (const file of files) {
        // この検査ファイル自身は飛ばす。**探している字面をコメントに書いてあるため。**
        if (file.endsWith('check-source.mjs')) continue;
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (rule.re.test(line)) {
              problems.push({ file, line: i + 1, text: line.trim().slice(0, 60), why: rule.why });
            }
          });
      }
    }
  }
}

// --- 描画中にストアを書き換えていないか ---
//
// `setSession((s) => { ... actions.answer(...) ... })` のように、
// **状態の更新関数の中でストアを書き換える**と 2 つのことが起きる。
//
//   1. React が「描画中に別のコンポーネントを更新した」と警告する
//   2. **StrictMode では更新関数が 2 回走るので、学習記録が二重に入る**
//
// 2 は画面に何も出ないまま成績だけが狂うので、目で見ても気づけない。
// 姉妹アプリの `Practice.tsx` と、このアプリの `Drill.tsx` の両方で起きた
// （`scripts/drive.mjs` がコンソールの警告を拾って見つけた）。
//
// **正しい形は、記録を更新関数の外で 1 回だけ呼ぶこと。**
{
  let files;
  try {
    files = listSrc('src/pages', ['.tsx']).concat(listSrc('src/components', ['.tsx']));
  } catch {
    files = [];
  }
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    // set*((...) => { ... }) の中身を取り出して、actions.* が入っていないか見る
    const re = /set[A-Z]\w*\(\s*\((\w*)\)\s*=>\s*\{/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      // 対応する閉じ括弧まで数える
      let depth = 1;
      let i = m.index + m[0].length;
      for (; i < text.length && depth > 0; i += 1) {
        if (text[i] === '{') depth += 1;
        else if (text[i] === '}') depth -= 1;
      }
      const inner = text.slice(m.index + m[0].length, i);
      const hit = inner.match(/actions\.\w+\(/);
      if (hit) {
        problems.push({
          file,
          line: text.slice(0, m.index).split('\n').length,
          text: m[0] + ' … ' + hit[0],
          why:
            '状態の更新関数の中でストア（' +
            hit[0] +
            '）を書き換えています。StrictMode で 2 回走り、記録が二重に入ります',
        });
      }
    }
  }
}

/*
 * 4. 姉妹アプリと共有する入れ物に、アプリ固有の名前が付いているか。
 *
 * localStorage も Cache Storage も**オリジン単位**なので、
 * github.io に姉妹アプリを並べると 1 つの入れ物を共有する。
 *   - localStorage のキーがぶつかれば、学習記録が混ざる
 *   - サービスワーカーの activate が「自分以外」を消せば、隣のキャッシュまで巻き添えになる
 *
 * どちらも `package.json` の名前を接頭辞にすれば、ぶつからない。
 * **リポジトリ名を改めたときに、片方だけ直し忘れる形で起きる。**
 * 実際に、乙 4 版の改名で見つかった（2026 年 9 月 15 日）。
 */
{
  let pkgName = '';
  try {
    pkgName = JSON.parse(readFileSync('package.json', 'utf8')).name || '';
  } catch {
    pkgName = ''; // package.json が読めないときは、この検査を飛ばす
  }

  const lineOf = (text, index) => text.slice(0, index).split('\n').length;

  if (pkgName) {
    try {
      const sw = readFileSync('public/sw.js', 'utf8');
      const m = sw.match(/const CACHE_PREFIX = '([^']*)'/);
      if (!m) {
        problems.push({
          file: 'public/sw.js',
          line: 1,
          text: 'CACHE_PREFIX が見つからない',
          why: 'キャッシュ名がオリジンの中でアプリ固有になっていません',
        });
      } else if (m[1] !== pkgName + '-') {
        problems.push({
          file: 'public/sw.js',
          line: lineOf(sw, m.index),
          text: m[1] + '  （package.json は ' + pkgName + '）',
          why: 'キャッシュの接頭辞がオリジンの中でアプリ固有になっていません。package.json の名前 + "-" にしてください',
        });
      }
      if (!/startsWith\(CACHE_PREFIX\)/.test(sw)) {
        problems.push({
          file: 'public/sw.js',
          line: 1,
          text: 'activate が startsWith(CACHE_PREFIX) で絞っていない',
          why: 'オリジンを共有する姉妹アプリのキャッシュまで消します。消すのは自分の接頭辞が付いたものだけにしてください',
        });
      }
    } catch {
      /* まだ sw.js が無いなら飛ばす */
    }

    try {
      const st = readFileSync('src/lib/storage.ts', 'utf8');
      const m = st.match(/const KEY = '([^']*)'/);
      if (m && !m[1].startsWith(pkgName + '-')) {
        problems.push({
          file: 'src/lib/storage.ts',
          line: lineOf(st, m.index),
          text: m[1] + '  （package.json は ' + pkgName + '）',
          why: 'localStorage のキーがオリジンの中でアプリ固有になっていません。package.json の名前で始めてください',
        });
      }
    } catch {
      /* まだ storage.ts が無いなら飛ばす */
    }
  }
}

if (problems.length > 0) {
  console.error('--- 束ねる前の検査で見つかりました（' + problems.length + ' 件）---');
  for (const p of problems) {
    console.error('  ' + p.file + ':' + p.line + '  ' + p.why);
    console.error('    ' + p.text);
  }
  console.error('');
  if (problems.some((p) => p.why.includes('バックティック'))) {
    console.error('本文は TypeScript のテンプレートリテラルの中にあります。');
    console.error('中のバックティックは ' + BS + BT + ' と書いてください（CLAUDE.md「バックスラッシュの落とし穴」）。');
    console.error('bash のヒアドキュメントはバックスラッシュを落とすので、Write ツールを使ってください。');
  }
  if (problems.some((p) => p.why.includes('五肢択一'))) {
    console.error('この試験は**五肢択一**です（姉妹アプリ 5 本は四肢択一でした）。');
    console.error('CLAUDE.md の「姉妹アプリと決定的に違う 4 点」を参照してください。');
  }
  if (problems.some((p) => p.why.includes('更新関数'))) {
    console.error('記録は更新関数の外で 1 回だけ呼んでください。');
    console.error('正しい形は src/pages/Practice.tsx の submit にあります。');
  }
  if (problems.some((p) => p.why.includes('オリジン'))) {
    console.error('localStorage と Cache Storage はオリジン単位です。姉妹アプリを同じ github.io に並べると共有します。');
    console.error('名前は package.json の名前を接頭辞にして、消すときも自分の接頭辞が付いたものだけにしてください。');
  }
  process.exit(1);
}

console.log('本文の書式・五肢択一の取りこぼし: 問題なし');
