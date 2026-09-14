/**
 * データの整合性チェック。`npm run check` で実行する。
 *
 * 教本・問題・ドリルは手で書き足していくため、型では防げない食い違いが必ず混ざる。
 * ここで機械的に潰しておくと、あとから「なぜか画面に出ない」を探さずに済む。
 * 新しい不整合の型を見つけたら、直すついでにこのファイルへ検査を足すこと。
 */
import { CATEGORIES, FIELDS } from '../src/data/categories';
import { SECTIONS } from '../src/data/textbook';
import { QUESTIONS } from '../src/data/questions';
import { DRILLS } from '../src/data/drills';
import { isKnownCommand } from '../src/lib/mathSymbols';
import { answerIndices, isMultiAnswer } from '../src/lib/answer';
import { renderCheck } from './render-check';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const BACKSLASH = String.fromCharCode(92);
const LF = String.fromCharCode(10);

const errors: string[] = [];
const warnings: string[] = [];

const err = (m: string): void => {
  errors.push(m);
};
const warn = (m: string): void => {
  warnings.push(m);
};

/** 重複した ID を探す */
function dupes(label: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) err(`${label}: ID が重複している → ${id}`);
    seen.add(id);
  }
}

const categoryIds = new Set(CATEGORIES.map((c) => c.id));
const sectionIds = new Set(SECTIONS.map((s) => s.id));

// ---- ID の重複 ----
dupes('分野', CATEGORIES.map((c) => c.id));
dupes('教本セクション', SECTIONS.map((s) => s.id));
dupes('確認問題', QUESTIONS.map((q) => q.id));
dupes('ドリル', DRILLS.map((d) => d.id));

// ---- 参照先の存在 ----
for (const s of SECTIONS) {
  if (!categoryIds.has(s.categoryId)) err(`教本 ${s.id}: 存在しない分野 ${s.categoryId}`);
}
for (const q of QUESTIONS) {
  if (!categoryIds.has(q.categoryId)) err(`問題 ${q.id}: 存在しない分野 ${q.categoryId}`);
  if (q.sectionId === undefined) warn(`問題 ${q.id}: sectionId が未設定（教本への復習導線が出ない）`);
  else if (!sectionIds.has(q.sectionId)) err(`問題 ${q.id}: 存在しない節 ${q.sectionId}`);
}
for (const d of DRILLS) {
  if (!categoryIds.has(d.categoryId)) err(`ドリル ${d.id}: 存在しない分野 ${d.categoryId}`);
  if (!sectionIds.has(d.sectionId)) err(`ドリル ${d.id}: 存在しない節 ${d.sectionId}`);
}

// ---- 章の出題数の合計が、科目の公表値と合っているか ----
// この試験は科目ごとの問題数（法令 15 / 物化 10 / 性消 10）が公表されている。
// 章の questions はそれを章へ割ったものなので、合計は公表値と一致しなければならない。
// ずれたまま章を足すと、模試の構成比が黙って本番と違うものになる（画面にも型にも出ない）。
for (const f of FIELDS) {
  const sum = CATEGORIES.filter((c) => c.field === f.id).reduce((n, c) => n + c.questions, 0);
  if (sum !== f.questions) {
    err(`科目「${f.name}」: 章の questions の合計が ${sum} 問。公表値は ${f.questions} 問`);
  }
}

// ---- 問題の形 ----
for (const q of QUESTIONS) {
  // **五肢択一。**四肢択一の姉妹アプリから写した問題は、ここで止まる。
  if (q.choices.length !== 5) err(`問題 ${q.id}: 選択肢が ${q.choices.length} 個（5 個であること）`);
  if (new Set(q.choices).size !== q.choices.length) err(`問題 ${q.id}: 選択肢に重複がある`);
  if (q.explanation.trim() === '') err(`問題 ${q.id}: 解説が空`);

  // ---- 正解の添字 ----
  // 公式の出題形式は五肢択一。answer は添字ひとつを取るのが通常だが、
  // 型としては配列（複数選択）も受けられるので、どちらでも数えられるようにしてある。
  const right = answerIndices(q.answer);
  if (right.length === 0) err(`問題 ${q.id}: answer が空`);
  for (const i of right) {
    if (!Number.isInteger(i) || i < 0 || i > 4) err(`問題 ${q.id}: answer が範囲外 ${i}`);
  }
  if (new Set(right).size !== right.length) err(`問題 ${q.id}: answer に同じ添字が 2 回ある`);
  if (right.length === q.choices.length) {
    err(`問題 ${q.id}: 選択肢が全部正解になっている（選ばない選択肢が要る）`);
  }
  if (isMultiAnswer(q.answer)) {
    if (right.length === 1) {
      // 配列で 1 つだけだと、画面には「複数選択」と出るのに実際は単一選択になる。
      err(`問題 ${q.id}: 複数選択なのに正解が 1 つしかない。単一選択なら answer を数値で書くこと`);
    }
    // **いくつ選ぶのかは画面に出さない方針。**（QuestionCard のコメントを参照）
    // 本番がそれを教えてくれる保証がないため、必要なら問題文に書く。
    // ここで書き忘れを止めないと、受験者は選び終わりが分からないまま解くことになる。
    if (!/(すべて|全て|あてはまるもの)(を)?選|[2-5]\s*つ選|(二|三|四|五)つ選/.test(q.question)) {
      err(
        `問題 ${q.id}: 複数選択なのに、問題文にいくつ選ぶかが書かれていない。` +
          '「2 つ選びなさい」などを問題文へ入れること',
      );
    }
  }
}

// ---- 問題が「解かなくても当てられる」形になっていないか ----
// 実際にこれで偏っていた。試験対策として見抜かれる形は、問題として弱い。
{
  const sameText = new Map<string, string[]>();
  for (const q of QUESTIONS) {
    const key = q.question.replace(/\s+/g, '');
    sameText.set(key, [...(sameText.get(key) ?? []), q.id]);
  }
  for (const ids of sameText.values()) {
    if (ids.length > 1) err(`問題文がまったく同じ: ${ids.join(' / ')}`);
  }

  // 完全一致だけでは、数字も選択肢も同じで語だけ言い換えた重複を見逃す。
  // 生成AIパスポートは範囲が広く浅いので、同じモデル名・同じ用語が別の章にも出てくる。
  // 章をまたいだ重複は 1 節ずつ見ている限り気づけないため、機械に数えさせる。
  // 問題文だけで測ると「〜の説明として、最も適切なものはどれか」という定型が
  // 効いて全部が似てしまうので、選択肢も混ぜて測る。
  {
    const grams = (q: (typeof QUESTIONS)[number]): Set<string> => {
      const t = (q.question + [...q.choices].sort().join('')).replace(
        /[\s。、，,．.「」『』（）()]/g,
        '',
      );
      const set = new Set<string>();
      for (let i = 0; i < t.length - 1; i += 1) set.add(t.slice(i, i + 2));
      return set;
    };
    /** 問題文と選択肢に出てくる数を、順序どおりに並べた文字列 */
    const numbers = (q: (typeof QUESTIONS)[number]): string =>
      (q.question + q.choices.join(' ')).match(/[0-9][0-9,.]*/g)?.join('/') ?? '';
    const rows = QUESTIONS.map((q) => ({ q, g: grams(q), nums: numbers(q) }));
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const a = rows[i].g;
        const b = rows[j].g;
        let hit = 0;
        a.forEach((g) => {
          if (b.has(g)) hit += 1;
        });
        const sim = (2 * hit) / (a.size + b.size);
        // 同じ節の中で似るのは、対比のために対で作った問題（直列と並列、暗号化と
        // 署名）なので正常。節をまたいで似ているものが、気づかずに書いた重複。
        const sameSection =
          rows[i].q.sectionId !== undefined && rows[i].q.sectionId === rows[j].q.sectionId;
        // 同じ公式を、理論の節と演習の節で**数値だけ変えて**出すのは意図した
        // 繰返しなので重複ではない（稼働率・損益分岐点・伝送時間など）。
        // 文面が似ていても、出てくる数が違えば別の問題として扱う。
        if (sim >= 0.6 && !sameSection && rows[i].nums === rows[j].nums) {
          warn(
            `問題 ${rows[i].q.id} と ${rows[j].q.id} が別の節でほぼ同じ内容（類似度 ${sim.toFixed(2)}）。` +
              '片方の数値か観点を変える',
          );
        }
      }
    }
  }

  // 正解の位置の偏りは**単一選択の問題だけで数える。**
  // 複数選択は 1 問で 2 つ以上の位置を埋めるので、混ぜると
  // 「ア が多い」のような偏りが実際より薄まって見えなくなる。
  const pos = [0, 0, 0, 0, 0];
  let single = 0;
  let longest = 0;
  let absoluteInCorrect = 0;
  let absoluteInWrong = 0;
  // 「すべて」は数え方が難しい。「すべての入力に対して」のようなただの記述まで
  // 拾ってしまうので、断定を強める語だけを見る。
  // 「常に」は部分一致だと「非常に」「通常に」まで拾ってしまうので、直前の字で除く。
  const absolute = /必ず|(?<![非通日])常に|まったく|全く|一切|絶対|例外なく|いかなる場合|どのような場合|どんな場合|一律|あらゆる/;
  for (const q of QUESTIONS) {
    const right = new Set(answerIndices(q.answer));
    if (!isMultiAnswer(q.answer)) {
      pos[answerIndices(q.answer)[0]] += 1;
      single += 1;
    }
    // 空白は見た目の長さに効かないので、除いてから数える。
    const lens = q.choices.map((c) => c.replace(/\s/g, '').length);
    q.choices.forEach((c, i) => {
      if (!absolute.test(c)) return;
      if (right.has(i)) absoluteInCorrect += 1;
      else absoluteInWrong += 1;
    });
    // 正解だけが長いと、読まずに「長いものを選ぶ」で当てられてしまう。
    //
    // **比で測ってはいけない。** 以前は「1.3 倍かつ 6 字差」で見ていたが、
    // 長い選択肢どうしだと 40 字 / 34 字が 1.18 倍にしかならず素通りする。
    // そうして漏れたものが積み上がり、このアプリでは 180 問のうち 44 問で
    // 正解が最長になっていた（選択肢の長さの分布から計算した期待値の 3.6 倍）。
    // 受験者がやるのは比の計算ではなく見比べなので、**字数の差**で見る。
    //
    // 複数選択では「正解のうちいちばん短いもの」と「誤答のうちいちばん長いもの」を
    // 比べる。正解が軒並み誤答より長ければ、やはり長い順に選ぶだけで当たるため。
    const other = Math.max(...lens.filter((_, i) => !right.has(i)));
    const mine = Math.min(...lens.filter((_, i) => right.has(i)));
    if (mine >= other * 1.25 && mine - other >= 5) longest += 1;
    if (mine - other >= 5) {
      warn(`問題 ${q.id}: 正解だけが突出して長い（正解 ${mine} 字 / 最長の誤答 ${other} 字）`);
    }

    // 言い切りが誤答にだけ出ていると、
    // 内容を知らなくても「言い切っているものを外す」だけで当てられる。
    // 全体の集計（下の absoluteInWrong）は 1 問ごとの偏りを拾えず、
    // 実際にレビューで 10 問以上この型を指摘された。
    //
    // **「3 つすべて」では緩すぎた。** 2 つ消去できれば残りは二択になり、
    // それだけで正答率が 25 % から 50 % に上がる。2 つ以上で数える。
    const wrongAbsolute = q.choices.filter((_, i) => !right.has(i)).filter((c) => absolute.test(c)).length;
    if (wrongAbsolute >= 2 && !q.choices.some((c, i) => right.has(i) && absolute.test(c))) {
      warn(
        `問題 ${q.id}: 誤答 ${wrongAbsolute} つに言い切りがあり、正解にはない。` +
          '言い切りを外すだけで選べてしまうので、誤答側からも言い切りを減らすこと',
      );
    }

    // 「本文で挙げられているものはどれか」は、知識ではなく直前の記載を
    // 覚えているかを問う形になっていて、教本を閉じた受験者には答えようがない。
    // 「本文」だけで見ると、文字列照合の「本文（探索される側の文字列）」まで
    // 拾ってしまう。記載を指す動詞と組になっているときだけ数える。
    if (/(本文|教本|この節)(で|に)(挙げ|述べ|示さ|説明さ|書か)/.test(q.question)) {
      warn(`問題 ${q.id}: 設問が教本の記載そのものを指している。知識を問う形にすること`);
    }
  }
  const n = QUESTIONS.length;
  if (n >= 40) {
    pos.forEach((c, i) => {
      const rate = c / single;
      // **五肢択一なので、ならせば 20 %。**四肢択一（25 %）の姉妹アプリから
      // 閾値を写すと、正常な分布まで警告してしまう。
      if (rate < 0.12 || rate > 0.30) {
        warn(`正解の位置が ${'アイウエオ'[i]} に偏っている（${c} / ${single} 問）。選択肢を並べ替えて散らすこと`);
      }
    });
    if (longest / n > 0.3) {
      warn(`正解がはっきり長い問題が ${longest} / ${n} 問。誤答も同じ密度で書くこと`);
    }
    if (absoluteInWrong >= 10 && absoluteInCorrect === 0) {
      warn(
        `「必ず」「すべて」などの言い切りが誤答だけに ${absoluteInWrong} 個ある。` +
          'それ自体が手掛かりになるので、正しく言い切れる場面では正解側にも使うこと',
      );
    }
  }
}

// ---- 正解の位置の偏りを、章ごとにも見る ----
//
// **全体で平らでも、章ごとに偏っていれば意味がない。**
// このアプリの模試は**科目ごとに出題する**ので、科目のまとまりで当てられる。
//
// 実際に起きた（2026 年 9 月 13 日、別の目によるレビューで発覚）：
// 全体は 18/21/23/19/24 で平らだったのに、`prop-each` は**オが 15 問中 8 問**、
// アが 0 問だった。**「迷ったらオ」で 15 問中 8 問取れる状態。**
// 全体集計の検査は、この偏りを 1 件も警告しなかった。
{
  const byCategory = new Map<string, number[]>();
  for (const q of QUESTIONS) {
    if (typeof q.answer !== 'number') continue; // 複数選択は対象外
    const pos = byCategory.get(q.categoryId) ?? [0, 0, 0, 0, 0];
    pos[q.answer] = (pos[q.answer] ?? 0) + 1;
    byCategory.set(q.categoryId, pos);
  }
  for (const [categoryId, pos] of byCategory) {
    const total = pos.reduce((a, b) => a + b, 0);
    // 少ない章で閾値を当てると誤検出になる。10 問以上の章だけを見る。
    if (total < 10) continue;
    pos.forEach((c, i) => {
      const rate = c / total;
      // 章単位は問題数が少ないので、全体（0.12〜0.30）より幅を持たせる。
      // それでも「1 つの位置に 4 割」「1 つの位置が 0」は拾える。
      if (rate === 0 || rate > 0.4) {
        const name = CATEGORIES.find((c2) => c2.id === categoryId)?.name ?? categoryId;
        warn(
          `章「${name}」: 正解の位置が ${'アイウエオ'[i]} に ${c} / ${total} 問。` +
            '模試は科目ごとに出すので、章のまとまりで当てられる',
        );
      }
    });
  }
}

// ---- 設問の形の比率を、科目ごとにも見る ----
//
// **閾値を「本番の比率へ寄せる」ために使ってはいけない。**
// ここは一度そう作りかけて、実測で否定された（2026 年 9 月 14 日）。
//
// 経緯：レビューが「法令は誤り選択 44 % で、本番の 63 % よりかなり低い」と指摘した。
// **しかし 63 % は本番『全体』の数字で、科目ごとの数字ではない。**
// 公開問題 35 問を科目ごとに割って数え直すと、こうなる。
//
// |      | 本番   | このアプリ |
// | ---  | ---    | ---        |
// | 法令 | 33 %   | 47 %       |
// | 物化 | 50 %   | 67 %       |
// | 性消 | 100 %  | 80 %       |
//
// **本番のほうが偏っている。**しかも偏りの向きが同じで、
// 法令がいちばん「正しいものを選ぶ」寄り、性消がいちばん「誤っているものを選ぶ」寄り。
// **科目ごとの開きは欠陥ではなく、本番の姿だった。**
//
// だからこの検査が見るのは「本番に近いか」ではなく、
// **その科目がまるごと一方の形だけになっていないか**だけである。
// 幅を 40〜85 % にすると、**本番の法令（33 %）と性消（100 %）をどちらも弾く。**
// 実際の試験を弾く検査は、検査のほうが間違っている。
{
  const NEGATIVE = ['誤っている', '妥当でない', '該当しない', '正しくない'];
  const byField = new Map<string, { neg: number; total: number }>();
  for (const q of QUESTIONS) {
    const cat = CATEGORIES.find((c) => c.id === q.categoryId);
    if (cat === undefined) continue;
    const acc = byField.get(cat.field) ?? { neg: 0, total: 0 };
    acc.total += 1;
    if (NEGATIVE.some((w) => q.question.includes(w))) acc.neg += 1;
    byField.set(cat.field, acc);
  }
  for (const [fieldId, acc] of byField) {
    if (acc.total < 20) continue; // 少ない科目に閾値を当てると誤検出になる
    const rate = acc.neg / acc.total;
    // 振り切った場合だけを止める。本番の性消は 100 % なので、上は 100 % を弾かない。
    if (rate < 0.15 || rate >= 1) {
      const name = FIELDS.find((f) => f.id === fieldId)?.name ?? fieldId;
      warn(
        `科目「${name}」: 誤り選択が ${acc.neg} / ${acc.total} 問（${Math.round(rate * 100)} %）。` +
          'その科目が一方の形だけになっている。両方の形を少なくとも数問は入れること',
      );
    }
  }
}

// ---- 問題文が本番で読み切れる長さか ----
// **この試験は時間に余裕がある。**35 問 / 120 分なので 1 問あたり約 3 分 26 秒で、
// 姉妹アプリ（1 問 60 秒）の 3 倍以上ある。しかも法令の科目は条文を読ませるので、
// 問題文はもともと長くなる。**姉妹アプリの閾値（120 字 / 160 字）をそのまま
// 写すと、正常な問題まで警告が出て読み飛ばされるようになる。**
//
// それでも上限は要る。読むだけで 1 分かかる問題が並ぶと、本番の感覚から外れる。
// 日本語は 1 分でおよそ 400〜600 字読めるので、200 字を目安・300 字を上限にする。
// **出典のある問題（公開問題）は原文どおりなので、長さを直せない。検査から外す。**
for (const q of QUESTIONS) {
  if (q.source !== undefined) continue;
  const len = q.question.replace(/\s/g, '').length;
  if (len > 300) err(`問題 ${q.id}: 問題文が ${len} 字（200 字までを目安に切り詰める）`);
  else if (len > 200) warn(`問題 ${q.id}: 問題文が ${len} 字とやや長い`);
}

// ---- 図の題の「N つ」と、実際の数の食い違い ----
// 「2 つのアプローチ」と題した図に 3 分岐が描いてある、という食い違いが実際に出た。
// CLAUDE.md が挙げる「図の名前と中身の食い違い」の型で、読者は数を数えて覚えるので
// そのまま誤記憶になる。数える対象は図の種類で変わる。
//   compare … 左右の見出し（actors）の数
//   tree    … 最上位の数、または 1 段下がった子の数
//   その他   … 要素の数
{
  // 算用数字だけを見ていたため、「三つの要件」と書いた図（要素は 4 個）を
  // 素通りしていた。日本語の本文では漢数字のほうがむしろ普通なので両方見る。
  const KANJI: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  };
  const NUM = /([0-9０-９]+|[一二三四五六七八九十])\s*つ/;
  const KEYS = new Set(['title', 'top', 'bottom', 'x', 'y', 'note', 'actors', 'caption']);
  const toNum = (t: string): number =>
    KANJI[t] ?? Number(t.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));

  for (const s of SECTIONS) {
    let type: string | null = null;
    let title: string | null = null;
    let actors = 0;
    let top = 0;
    let children = 0;

    const close = (): void => {
      if (type === null || title === null) {
        type = null;
        title = null;
        return;
      }
      const m = NUM.exec(title);
      if (m !== null) {
        const want = toNum(m[1]);
        const ok =
          type === 'compare'
            ? actors === 0 || want === actors
            : type === 'tree'
              ? want === top || want === children
              : top === 0 || want === top;
        if (!ok) {
          const actual = type === 'compare' ? `左右の見出し ${actors} 個` : `要素 ${top} 個`;
          warn(`教本 ${s.id}: 図の題「${title}」は ${want} つと言っているが、${actual}`);
        }
      }
      type = null;
      title = null;
    };

    for (const raw of s.body.split(LF)) {
      const t = raw.trim();
      if (t.startsWith('```')) {
        if (type !== null) close();
        else if (t.startsWith('```diagram:')) {
          type = t.slice('```diagram:'.length);
          title = null;
          actors = 0;
          top = 0;
          children = 0;
        }
        continue;
      }
      if (type === null || t === '') continue;
      const d = /^([a-z]+):\s*(.*)$/.exec(t);
      if (d !== null && KEYS.has(d[1])) {
        if (d[1] === 'title') title = d[2];
        if (d[1] === 'actors') actors = d[2].split('|').filter((x) => x.trim() !== '').length;
        continue;
      }
      const indent = /^\s*/.exec(raw)![0].length;
      if (indent === 0) top += 1;
      else if (indent <= 2) children += 1;
    }
    close();
  }
}

// ---- 別の文字体系の混入 ----
// 日本語の文章に、ハングルやキリル文字が 1 文字だけ紛れ込むことが実際に起きた
// （「データ」の「デ」がハングルに、「短い」がキリル文字に）。
// 見た目では気づきにくく、検索にも引っかからないので機械に数えさせる。
{
  // ギリシャ文字は対象外。αβ 法・ε-greedy・β-VAE のように、
  // 日本語の技術用語の一部として正当に使われるため。
  const STRAY = /[가-힣ᄀ-ᇿЀ-ӿ]/;
  const scan = (label: string, text: string): void => {
    for (const line of text.split(LF)) {
      const m = STRAY.exec(line);
      if (m === null) continue;
      err(`${label}: 日本語以外の文字体系が混ざっている（${m[0]}）→ ${line.trim().slice(0, 50)}`);
    }
  };
  for (const s of SECTIONS) {
    scan(`教本 ${s.id}`, s.title);
    scan(`教本 ${s.id}`, s.goal);
    scan(`教本 ${s.id}`, s.body);
  }
  for (const q of QUESTIONS) {
    scan(`問題 ${q.id}`, q.question);
    scan(`問題 ${q.id}`, q.explanation);
    q.choices.forEach((c) => scan(`問題 ${q.id}`, c));
  }
}

// ---- 節の骨格 ----
// 「# この節のまとめ」「> **試験のポイント**」「> **よくある勘違い**」は
// digest.ts が直前チェックシートへ機械的に抜き出す。書式を崩すと拾われないので、
// 崩れていないかではなく「そもそも在るか」をここで数える。
for (const s of SECTIONS) {
  const body = s.body;
  if (!body.includes('# ざっくり言うと')) warn(`教本 ${s.id}: 「# ざっくり言うと」がない`);
  if (!body.includes('# この節のまとめ')) warn(`教本 ${s.id}: 「# この節のまとめ」がない（チェックシートに載らない）`);
  if (!body.includes('> **試験のポイント**')) warn(`教本 ${s.id}: 「> **試験のポイント**」がない`);
  // この試験は 1 問あたり約 3 分 26 秒あり、速さより「数字を覚えているか」で決まる。
  // 指定数量・引火点・保安距離は一問一答が向くので、薄い節を数える。
  const quizzes = body.split(LF).filter((l) => l.includes('::')).length;
  if (quizzes === 0) warn(`教本 ${s.id}: quiz ブロックがない（この試験では一問一答が速度対策になる）`);
  else if (quizzes < 4) warn(`教本 ${s.id}: 一問一答が ${quizzes} 問と少ない（目安は 5 問以上）`);
}

// ---- ドリルは実際に生成して確かめる（乱数なので複数回試す） ----
for (const d of DRILLS) {
  for (let i = 0; i < 200; i++) {
    const item = d.generate();
    // **5 択。**この試験は五肢択一式なので、ドリルも本番と同じ数にそろえてある
    // （姉妹アプリは四肢択一で 4 択だった。移植したまま 4 だと手応えが変わる）。
    if (item.choices.length !== 5) {
      err(`ドリル ${d.id}: 選択肢が ${item.choices.length} 個になる場合がある（5 個であること）`);
      break;
    }
    if (new Set(item.choices).size !== item.choices.length) {
      err(`ドリル ${d.id}: 選択肢が重複する場合がある → ${item.choices.join(' / ')}`);
      break;
    }
    if (item.answer < 0 || item.answer >= item.choices.length) {
      err(`ドリル ${d.id}: answer が範囲外になる場合がある`);
      break;
    }
  }
}

// ---- 本文の記法 ----
const KNOWN_DIAGRAMS = new Set(['flow', 'stack', 'tree', 'matrix', 'cycle', 'seq', 'bits', 'compare']);
/**
 * ```widget: で呼べるウィジェットの id。`src/components/widgets/*.tsx` の
 * ファイル名がそのまま id になる（Widget.tsx が同じ規則で自動登録している）。
 * 手で並べると足したときに更新し忘れるので、ディレクトリを直接読む。
 */
const KNOWN_WIDGETS = new Set(
  existsSync('src/components/widgets')
    ? readdirSync('src/components/widgets')
        .filter((f) => f.endsWith('.tsx'))
        .map((f) => f.replace(/\.tsx$/, ''))
    : [],
);
/** 本文リンクで飛べるページ（ハッシュルータの第 1 要素） */
const KNOWN_PAGES = new Set([
  'home',
  'textbook',
  'tools',
  'practice',
  'drill',
  'sheet',
  'review',
  'mock',
  'stats',
  'settings',
]);

const fence = new RegExp('^```(.*)$');

for (const s of SECTIONS) {
  const lines = s.body.split(LF);
  let open: string | null = null;
  let quizBuf: string[] = [];

  for (const line of lines) {
    const m = fence.exec(line.trim());
    if (m) {
      if (open === null) {
        open = m[1].trim();
        quizBuf = [];
        const lang = open;
        if (lang.startsWith('diagram:')) {
          const t = lang.slice('diagram:'.length);
          if (!KNOWN_DIAGRAMS.has(t)) err(`教本 ${s.id}: 未知の図の種類 ${t}`);
        }
        if (lang.startsWith('widget:')) {
          const w = lang.slice('widget:'.length);
          if (!KNOWN_WIDGETS.has(w)) err(`教本 ${s.id}: 未登録のウィジェット ${w}`);
        }
      } else {
        if (open === 'quiz') {
          if (quizBuf.length === 0) err(`教本 ${s.id}: 空の quiz ブロック`);
          for (const q of quizBuf) {
            if (!q.includes('::')) err(`教本 ${s.id}: quiz の行に :: がない → ${q.slice(0, 30)}`);
          }
        }
        open = null;
      }
      continue;
    }
    if (open === 'quiz' && line.trim() !== '') quizBuf.push(line.trim());
  }
  if (open !== null) err(`教本 ${s.id}: 閉じていないコードフェンス（${open || '言語指定なし'}）`);
}

// ---- 図の中の書式 ----
// 図は Markdown を通らないので、`**強調**` を書くとアスタリスクがそのまま出る。
// compare は「1 行 1 セル、偶数行が左・奇数行が右」なので、要素が奇数だと対にならない。
const DIRECTIVE_KEYS = new Set(['title', 'top', 'bottom', 'x', 'y', 'note', 'actors', 'caption']);
for (const s of SECTIONS) {
  let type: string | null = null;
  let items = 0;
  let noted = 0;
  for (const raw of s.body.split(LF)) {
    const t = raw.trim();
    if (t.startsWith('```')) {
      if (type !== null) {
        if (type === 'compare' && items % 2 === 1) {
          err(`教本 ${s.id}: compare の要素が奇数個なので左右が対にならない（1 行 1 セルで書く）`);
        }
        // 奇数個の検査だけでは、`左 :: 右` を全行で書いた図を捕まえられない。
        // `::` は左右の区切りではなく補足なので、この書き方をすると
        // 「左の 1 行目」「左の 2 行目」…が左右に振り分けられて意味が壊れる。
        // 要素が偶数だと素通りするうえ、系譜で 4 回起きている型なので数えておく。
        // 補足付きのセルを並べた正当な図もあるため、全要素に付いている場合だけ疑う。
        if (type === 'compare' && items >= 4 && noted === items) {
          err(
            `教本 ${s.id}: compare の全 ${items} 要素に :: が付いている。` +
              '`::` は左右の区切りではなく補足。左右の対は 1 行 1 セルで書く',
          );
        }
        type = null;
      } else if (t.startsWith('```diagram:')) {
        type = t.slice('```diagram:'.length);
        items = 0;
        noted = 0;
      }
      continue;
    }
    if (type === null || t === '') continue;
    const m = /^([a-z]+):/.exec(t);
    if (m && DIRECTIVE_KEYS.has(m[1])) continue;
    items++;
    if (t.includes('::')) noted++;
    if (t.includes('**')) err(`教本 ${s.id}: 図の中の ** は強調にならずそのまま出る → ${t.slice(0, 40)}`);
    // seq は `A -> B :: 内容` の形。矢印がないと Diagram.tsx がラベル側を本文として出し、
    // `::` の右（補足）は画面に出ない。つまり書いた内容が黙って消える。
    // 描画自体は成立するので描画検査を素通りする。実際に 2 か所で起きた。
    if (type === 'seq' && t.includes('::') && !/->|<-/.test(t.split('::')[0])) {
      err(
        `教本 ${s.id}: seq の行に矢印（-> か <-）がないので :: の右が表示されない → ${t.slice(0, 40)}`,
      );
    }
  }
}

// ---- 本文リンクの飛び先 ----
// 飛び先が実在するかだけでは、**別の節を指してしまった**誤りを捕まえられない。
// 実際に「[誤差関数の節](textbook/i-3)」のように、ラベルと飛び先が食い違った例が出た。
// そこで、ラベルが他の節のタイトルと一致しているのに別の節を指している場合を警告する。
// **教本を並行で書かせている間は、まだ書かれていない節へのリンクが必ず出る。**
// 章を 1 ファイル 1 担当で同時に書く運用なので、他章への相互リンクは
// 「飛び先がまだ空」の状態で書かれる。これをエラーにすると、
// 全章が揃うまで npm run check が一度も通らなくなり、検査が使えなくなる。
//
// そこで、**執筆側に渡してある節 ID の一覧**（scripts/prompts/00-common.md の
// 「リンクしてよい節 ID」の表）を読み、そこに載っている id への未着の
// リンクは警告にとどめる。載っていない id は今までどおりエラー。
// 一覧を 2 か所に持たないよう、プロンプトの表をそのまま正本として読んでいる。
const plannedIds = new Set<string>();
{
  const promptPath = 'scripts/prompts/00-common.md';
  if (existsSync(promptPath)) {
    const md = readFileSync(promptPath, 'utf8');
    for (const m of md.matchAll(/^\| `([a-z]+-?\d+)` \|/gm)) plannedIds.add(m[1]);
  }
  if (plannedIds.size === 0) {
    warn('scripts/prompts/00-common.md から節 ID の一覧を読めなかった（表の書式が変わった可能性）');
  }
}

const titleToId = new Map(SECTIONS.map((s) => [s.title, s.id]));
const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
for (const s of SECTIONS) {
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(s.body)) !== null) {
    const label = m[1].replace(/\*\*/g, '').trim();
    const to = m[2];
    const [pathPart] = to.split('?');
    const [page, param] = pathPart.split('/');
    if (!KNOWN_PAGES.has(page)) {
      err(`教本 ${s.id}: 存在しないページへのリンク ${to}`);
      continue;
    }
    if (page !== 'textbook' || param === undefined) continue;
    if (!sectionIds.has(param)) {
      if (plannedIds.has(param)) {
        warn(`教本 ${s.id}: まだ書かれていない節へのリンク ${to}（その章を書けば消えます）`);
      } else {
        err(`教本 ${s.id}: 存在しない節へのリンク ${to}`);
      }
      continue;
    }
    const byTitle = titleToId.get(label);
    if (byTitle !== undefined && byTitle !== param) {
      err(`教本 ${s.id}: リンクのラベル「${label}」は節 ${byTitle} のタイトルなのに ${param} を指している`);
    }
    // 節へのリンクに「〜の章」というラベルを付けると、読者は章の扉に飛べると思う。
    // 章の扉へは飛べないので、ラベルを節の話に直すか、リンクを外す。
    if (/章$/.test(label)) {
      warn(`教本 ${s.id}: リンクのラベル「${label}」が章を指しているが、飛び先は節 ${param}。章の扉へは飛べない`);
    }
  }
}

// ---- 数式のバックスラッシュ落ち ----
// TS のテンプレートリテラル／文字列の中では `\` を 2 つ重ねる必要がある。
// 忘れると `\sum` が `sum` になって画面に出てしまうので、それを検出する。
const COMMANDS = [
  'sum', 'prod', 'int', 'partial', 'nabla', 'infty', 'frac', 'sqrt',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'eta', 'theta', 'lambda',
  'mu', 'sigma', 'tau', 'phi', 'psi', 'omega', 'Sigma', 'Delta', 'Omega',
  'times', 'cdot', 'approx', 'propto', 'hat', 'bar', 'mathbf', 'mathbb', 'mid',
];
const mathSpan = /\$([^$\n]+)\$/g;
const cmdRe = /\\([A-Za-z]+)/g;

/** 本文から数式の断片を集める（行内の `$...$` と ```math フェンスの中身） */
function mathPieces(text: string): string[] {
  const pieces: string[] = [];
  let m: RegExpExecArray | null;
  mathSpan.lastIndex = 0;
  while ((m = mathSpan.exec(text)) !== null) pieces.push(m[1]);
  let inMath = false;
  for (const line of text.split(LF)) {
    const t = line.trim();
    if (t.startsWith('```')) {
      inMath = t === '```math';
      continue;
    }
    if (inMath && t !== '') pieces.push(t);
  }
  return pieces;
}

const checkMath = (label: string, text: string): void => {
  for (const expr of mathPieces(text)) {
    for (const cmd of COMMANDS) {
      const at = expr.indexOf(cmd);
      if (at < 0) continue;
      if (expr[at - 1] === BACKSLASH) continue;
      // 変数名の一部（例: gamma の中の mu）を拾わないよう、前後が英字なら見送る
      const before = expr[at - 1] ?? '';
      const after = expr[at + cmd.length] ?? '';
      if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) continue;
      warn(`${label}: 数式の ${cmd} にバックスラッシュがない（$ の中で ${BACKSLASH}${BACKSLASH}${cmd} と書く）→ ${expr}`);
    }
    // 表に無い命令は、記号にならずに名前がそのまま画面へ出る
    cmdRe.lastIndex = 0;
    let c: RegExpExecArray | null;
    while ((c = cmdRe.exec(expr)) !== null) {
      if (!isKnownCommand(c[1])) {
        err(`${label}: 数式に未知の命令 ${BACKSLASH}${c[1]}（記号にならず名前が表示される。src/lib/mathSymbols.ts に足すこと）→ ${expr}`);
      }
    }
  }
};
for (const s of SECTIONS) checkMath(`教本 ${s.id}`, s.body);
for (const q of QUESTIONS) {
  checkMath(`問題 ${q.id}`, q.question);
  checkMath(`問題 ${q.id}`, q.explanation);
  q.choices.forEach((c) => checkMath(`問題 ${q.id}`, c));
}

// ---- 実際に描いてみる ----
// 記法としては正しくても、描くと崩れている場合がある（強調の中の数式など）。
for (const p of renderCheck()) err(p);

// ---- 集計して表示 ----
const sectionsPerCategory = new Map<string, number>();
for (const s of SECTIONS) sectionsPerCategory.set(s.categoryId, (sectionsPerCategory.get(s.categoryId) ?? 0) + 1);
const emptyChapters = CATEGORIES.filter((c) => !sectionsPerCategory.has(c.id));

const chars = SECTIONS.reduce((n, s) => n + s.body.length, 0);
const linked = QUESTIONS.filter((q) => q.sectionId !== undefined).length;

console.log('--- 収録状況 ---');
console.log(`教本      : ${SECTIONS.length} 節 / ${chars.toLocaleString()} 字（未着手の章 ${emptyChapters.length}）`);
console.log(`確認問題  : ${QUESTIONS.length} 問（節にひも付き ${linked} 問）`);
console.log(`計算ドリル: ${DRILLS.length} 種類`);
if (emptyChapters.length > 0) {
  console.log(`未着手の章: ${emptyChapters.map((c) => c.name).join('、')}`);
}

console.log('');
if (warnings.length > 0) {
  console.log(`--- 注意 ${warnings.length} 件 ---`);
  warnings.forEach((w) => console.log('  ' + w));
  console.log('');
}
if (errors.length === 0) {
  console.log('整合性チェック: エラーなし');
} else {
  console.log(`--- エラー ${errors.length} 件 ---`);
  errors.forEach((e) => console.log('  ' + e));
  process.exit(1);
}
