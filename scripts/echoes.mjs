// ある主張が、リポジトリの中の「どこに何回」書いてあるかを数える。
//
//     node scripts/echoes.mjs 爆発範囲のまん中
//     node scripts/echoes.mjs "安全率" "腐食"      … すべてを含む行だけ出す
//
// ★ なぜ要るか。**1 つの主張は、1 つの節の中に 5 つ以上の居場所を持ちます。**
//
//     本文 ／ 表 ／ 試験のポイント ／ よくある勘違い ／ この節のまとめ ／ 一問一答
//
// **これが別々の文字列なので、本文だけ直しても残りは古いままになります。**
// さらに外側に、確認問題・計算ドリル・体験ウィジェット・画面の文言があります。
//
// 2026 年 9 月 20 日の 2 巡目は、**19 件の指摘のうち 14 件がこの型**でした。
// 「安全率は設計者が下げられない」と本文を直したのに、**まとめは「ばらつきが小さくなれば
// 安全率も小さくできる」のまま**で、同じ節の中で正面から矛盾していた、という具合です。
//
// **直す前にこれを走らせて、出てきた場所を全部直すこと。**
// ★ この道具は 8 つめ（`kouatsugas_otsu_exam_app`）で作り、系譜の全リポジトリへ配りました。
//   コメントの例は高圧ガス版のものですが、**型はどのアプリでも同じ**です。


import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const words = process.argv.slice(2);
if (words.length === 0) {
  console.error('使い方: node scripts/echoes.mjs <語> [<語> ...]');
  process.exit(1);
}

/** src/ と docs/ の中のテキストを全部たどる。node_modules と dist は見ない。 */
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx|mjs|md|html|css)$/.test(name)) files.push(full);
  }
};
for (const d of ['src', 'docs', 'scripts']) walk(d);

/** その行が、節の中のどの居場所にあたるかを見分ける。 */
const place = (line) => {
  if (/試験のポイント/.test(line)) return '試験のポイント';
  if (/よくある勘違い/.test(line)) return 'よくある勘違い';
  if (/^\s*-\s/.test(line)) return 'まとめ・箇条書き';
  if (/\s::\s/.test(line)) return '一問一答';
  if (/^\s*\|/.test(line)) return '表';
  if (/^\s*#/.test(line)) return '見出し';
  if (/^\s*\/\/|^\s*\* /.test(line)) return 'コメント';
  return '本文';
};

/** ファイルの種類。「別の居場所」を見落とさないため。 */
const kind = (p) => {
  const r = relative('.', p).replace(/\\/g, '/');
  if (r.startsWith('src/data/textbook/')) return '教本';
  if (r.startsWith('src/data/questions/')) return '確認問題';
  if (r.includes('drills')) return '計算ドリル';
  if (r.startsWith('src/components/widgets/')) return 'ウィジェット';
  if (r.startsWith('src/pages/') || r.startsWith('src/components/')) return '画面';
  if (r.startsWith('docs/')) return '文書';
  if (r.startsWith('scripts/')) return 'スクリプト';
  return 'そのほか';
};

const hits = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (words.every((w) => line.includes(w))) hits.push({ f, i: i + 1, line, k: kind(f), p: place(line) });
  });
}

if (hits.length === 0) {
  console.log(`「${words.join('」と「')}」を含む行はありません。`);
  process.exit(0);
}

const byKind = new Map();
for (const h of hits) {
  if (!byKind.has(h.k)) byKind.set(h.k, []);
  byKind.get(h.k).push(h);
}

for (const [k, rows] of byKind) {
  console.log(`\n===== ${k}（${rows.length} 件） =====`);
  for (const r of rows) {
    const body = r.line.trim().replace(/\s+/g, ' ');
    console.log(`  ${relative('.', r.f).replace(/\\/g, '/')}:${r.i}  [${r.p}]`);
    console.log(`    ${body.length > 140 ? body.slice(0, 140) + '…' : body}`);
  }
}

console.log(`\n合計 ${hits.length} 件 / ${byKind.size} 種類。★ 直すなら全部直すこと。`);
