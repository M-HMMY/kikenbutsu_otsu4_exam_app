// 確認問題に出てくるのに、教本のどこにも無い語を挙げる。
//
// **これは `npm run check` に入れていません。**誤検知が多すぎて、エラーにすると邪魔になります。
// **レビューのときに人が目で見るための道具**です。`node scripts/terms.mjs` で走ります。
//
// ★ なぜ要るか。**解説から教本へ戻る導線があるのに、その語が教本に無い**ことがあります。
// 2026 年 9 月 20 日の 2 巡目で、次の 6 件が出ました。
//
// | 語 | どうなっていたか |
// | --- | --- |
// | 酸素供給源 | 確認問題が使っているが、教本は「支燃物」としか書いていない |
// | 熱起電力・測温接点 | 熱電対の原理を問うているのに、教本にこの語が無い |
// | 理論火炎温度 | 教本は「断熱火炎温度」と呼んでいる。同じものの別名 |
// | 活量係数 | ラウールの法則のずれを問うているのに、教本は言葉でしか説明していない |
// | 平均垂直応力 | 教本は「応力」としか書いていない |
// | 認定指定設備 | 許可の処理能力から外れる設備を問うているのに、教本に無い |
//
// **出力の 8 割は誤検知です。**「超低温容器及」のように、助詞や列挙でつながった断片が拾われます。
// **ざっと眺めて、意味のある語だけ拾ってください。**それで十分に元が取れます。
// ★ この道具は 8 つめ（`kouatsugas_otsu_exam_app`）で作り、系譜の全リポジトリへ配りました。
//   コメントの例は高圧ガス版のものですが、**型はどのアプリでも同じ**です。


import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');

const textbook = read('src/data/textbook');

/** 問題文を、ID ごとに取り出す。**ソースを素のテキストとして読む**（check-source.mjs と同じ作法）。 */
const questions = [];
for (const f of readdirSync('src/data/questions').filter((x) => x.endsWith('.ts'))) {
  const s = readFileSync(join('src/data/questions', f), 'utf8');
  const re = /id: '([a-z0-9-]+)',[\s\S]*?question:\s*\n?\s*'([\s\S]*?)',\n\s*choices/g;
  let m;
  while ((m = re.exec(s)) !== null) questions.push([m[1], m[2]]);
}

// 列挙や位置を表す漢字で切る。「超低温容器及」「第一種設備距離以上」のような断片を減らす。
const CUT = /[及又若並以当該其]/;
// 単位と日常語。技術用語ではないので外す。
const STOP = new Set([
  'ミリグラム', 'センチメートル', 'メートル', 'キログラム', 'パーセント',
  'リットル', 'パスカル', 'メガパスカル', 'キロパスカル', 'デシリットル',
  'コンクリート', 'トン',
]);

const found = new Map();
for (const [id, body] of questions) {
  const words = new Set();
  for (const w of body.match(/[ァ-ヴ]{4,}/g) ?? []) if (!STOP.has(w)) words.add(w);
  for (const run of body.match(/[一-鿿]{3,}/g) ?? []) {
    for (const part of run.split(CUT)) if (part.length >= 4) words.add(part);
  }
  for (const w of words) {
    if (textbook.includes(w)) continue;
    if (!found.has(w)) found.set(w, new Set());
    found.get(w).add(id);
  }
}

// ---- その 2：解説だけが持っている「除外・限定」 ----
//
// ★ 確認問題の解説が条文の括弧書きを引いているのに、**その問の節の教本に無い**ことがあります。
//   2026 年 9 月 20 日の 2 巡目で 1 件見つけました。`ho-safety-2` のイが
//   一般則 6 ②一イのただし書（安全弁の止め弁を閉じてよい場合）を引いているのに、
//   **教本は「元弁を閉めてはいけない」と言い切っていました。**
//   **系譜でいちばん重い型（誤答が実は正しい）が、ここで起きます。**
//
// **16 件挙げて、実害は 1 件でした。**残りは言い回しの違いです（教本が「除かれます」と書いている等）。

const sections = new Map();
for (const f of readdirSync('src/data/textbook').filter((x) => x.endsWith('.ts'))) {
  const t = readFileSync(join('src/data/textbook', f), 'utf8');
  const re = /id: '([a-z]+-\d+)',/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const i = t.indexOf('body: `', m.index);
    const j = t.indexOf('`,', i + 8);
    if (i > 0 && j > i) sections.set(m[1], t.slice(i + 7, j));
  }
}

const limits = [];
for (const f of readdirSync('src/data/questions').filter((x) => x.endsWith('.ts'))) {
  const t = readFileSync(join('src/data/questions', f), 'utf8');
  const re =
    /id: '([a-z0-9-]+)',\s*\n\s*categoryId: '[^']+',\s*\n\s*sectionId: '([a-z]+-\d+)',([\s\S]*?)\n  \},/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const body = sections.get(m[2]) ?? '';
    const seen = new Set();
    for (const w of m[3].matchAll(/([ぁ-んァ-ヴ一-龥ー・]{3,20})(?:を除く|に限る|を除き|に限り)/g)) {
      if (seen.has(w[1]) || body.includes(w[1])) continue;
      seen.add(w[1]);
      limits.push([m[1], m[2], w[1]]);
    }
  }
}

const rows = [...found.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja'));
for (const [w, ids] of rows) {
  console.log(`${w.padEnd(14, '　')} ${[...ids].sort().join('、')}`);
}
console.log(`\n${rows.length} 語（★ 多くは断片。意味のある語だけ拾うこと）`);

console.log('');
console.log('===== 解説だけが持っている除外・限定 =====');
for (const [qid, sec, w] of limits) {
  console.log(`  ${qid.padEnd(14, '　')} 節 ${sec.padEnd(7, ' ')} 「${w}」`);
}
console.log(`\n${limits.length} 件（★ ほとんどは言い回しの違い。条文の括弧書きだけ拾うこと）`);
