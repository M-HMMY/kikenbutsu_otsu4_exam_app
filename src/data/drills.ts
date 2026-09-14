/**
 * 計算ドリル：出題のたびに数値が変わる自動生成問題。
 *
 * 計算問題は同じ問題文を暗記してしまうと本番で崩れるため、
 * 値を振り直して「手順」だけが身に付くようにしている。
 * 生成した問題は復習カード（SRS）には登録しない（同じ問題が二度と現れないため）。
 *
 * **この試験には計算問題が出る。**「基礎的な物理学及び基礎的な化学」の科目で、
 * 比熱と熱量、熱膨張による体積変化、密度、濃度、熱化学あたりが出る。
 * 姉妹アプリはこのファイルを骨格だけ残して使っていなかったが、このアプリでは中身を作った。
 *
 * **試験会場で電卓は使えない**（受験案内の注意事項。2026 年 9 月 13 日確認）。
 * だから四則演算だけで解ける形にしてある。桁も、暗算か筆算で追える範囲に収める。
 *
 * **物性値をこちらで決め打ちしない。**比熱も体膨張率も、問題文の中で与えている。
 * 実在の物質の値を書くと `docs/primary-numbers.md` の裏づけが要るうえ、
 * 出典によって値が違う（同 B 節を参照）。**ドリルは手順の練習なので、値は与えてよい。**
 *
 * 手順で必ず解けるものに絞ること。有効数字や単位の扱いで割れる問題は、
 * 自動生成すると答えが一意にならない。
 */

export interface DrillItem {
  question: string;
  choices: string[];
  answer: number;
  /** 計算手順の解説 */
  explanation: string;
}

export interface Drill {
  id: string;
  name: string;
  categoryId: string;
  sectionId: string;
  summary: string;
  generate: () => DrillItem;
}

// ---------------------------------------------------------------- 補助関数

const rnd = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));

/** 選択肢や条件をランダムに 1 つ選ぶ。新しいドリルを書くときに使う */
export function pick<T>(items: readonly T[]): T {
  return items[rnd(0, items.length - 1)];
}

/** 小数を読みやすく整える（末尾の 0 を落とす）。新しいドリルを書くときに使う */
export function fx(n: number, digits = 2): string {
  return Number(n.toFixed(digits)).toString();
}

/**
 * 正解と誤答候補から 5 択を作る。重複は除き、足りなければ補充関数で埋める。
 *
 * **5 択なのは、この試験が五肢択一式だから。**姉妹アプリは四肢択一で 4 択だった。
 * 本番と選択肢の数が違うと、消去法の手応えが変わってしまう。
 */
function build(
  correct: string,
  wrongs: string[],
  fallback?: (i: number) => string,
): { choices: string[]; answer: number } {
  const pool: string[] = [];
  for (const w of wrongs) {
    if (w !== correct && !pool.includes(w)) pool.push(w);
    if (pool.length === 4) break;
  }
  for (let i = 1; pool.length < 4 && i < 80; i++) {
    const extra = fallback ? fallback(i) : String(i);
    if (extra !== correct && !pool.includes(extra)) pool.push(extra);
  }
  const all = [correct, ...pool];
  for (let j = all.length - 1; j > 0; j--) {
    const k = rnd(0, j);
    [all[j], all[k]] = [all[k], all[j]];
  }
  return { choices: all, answer: all.indexOf(correct) };
}

/**
 * 数値の 5 択。ありがちな誤答を先に使い、足りない分は倍率でずらして作る。
 * 正解が 0 や負になりうる問題では倍率では埋まらないので、build に自前の
 * 補充関数を渡すこと（npm run check が「選択肢が 2 個になる」で捕まえる）。
 */
export function buildNumeric(
  correct: number,
  fmt: (n: number) => string,
  mistakes: number[],
): { choices: string[]; answer: number } {
  const wrongs = mistakes.filter((n) => Number.isFinite(n) && n >= 0).map(fmt);
  const factors = [2, 0.5, 1.5, 0.8, 1.25, 3, 0.25, 1.1, 0.9, 1.4, 0.6];
  let fi = 0;
  return build(fmt(correct), wrongs, () => fmt(correct * factors[fi++ % factors.length]));
}

// ---------------------------------------------------------------- ドリル本体

/** 比熱と熱量。熱量 ＝ 質量 × 比熱 × 温度の差 */
function heat(): DrillItem {
  const mass = rnd(2, 10) * 50; // 100〜500 g
  const c = pick([0.45, 0.9, 1.8, 2.1, 2.5, 4.2]);
  const t1 = rnd(1, 6) * 5; // 5〜30 ℃
  const t2 = t1 + rnd(2, 12) * 5; // 10〜60 ℃ 上がる
  const dt = t2 - t1;
  const kj = (mass * c * dt) / 1000;
  const fmt = (n: number): string => `${fx(n, 2)} kJ`;
  const { choices, answer } = buildNumeric(kj, fmt, [
    (mass * c * t2) / 1000, // 温度の「差」ではなく到達温度を使った
    (mass * dt) / 1000, // 比熱を掛け忘れた
    (c * dt) / 1000, // 質量を掛け忘れた
    mass * c * dt, // kJ に直し忘れた（J のまま）
  ]);
  return {
    question:
      `比熱が ${c} J/(g・K) の液体 ${mass} g を、${t1} ℃ から ${t2} ℃ まで温めた。` +
      '必要な熱量はおよそいくらか。',
    choices,
    answer,
    explanation:
      `**熱量 ＝ 質量 × 比熱 × 温度の差**です。\n\n` +
      `まず温度の差を出します。${t2} − ${t1} ＝ **${dt} ℃**。` +
      `到達温度の ${t2} をそのまま使わないでください。\n\n` +
      `${mass} × ${c} × ${dt} ＝ ${fx(mass * c, 2)} × ${dt} ＝ **${fx(mass * c * dt, 0)} J**。\n\n` +
      `選択肢が kJ なので 1,000 で割って **${fx(kj, 2)} kJ** です。`,
  };
}

/** 熱膨張。増える体積 ＝ もとの体積 × 体膨張率 × 温度の差 */
function expand(): DrillItem {
  const v0 = rnd(2, 20) * 100; // 200〜2,000 L
  const beta = pick([0.0008, 0.001, 0.0012, 0.00135, 0.0016]);
  const t1 = rnd(0, 4) * 5; // 0〜20 ℃
  const t2 = t1 + rnd(2, 8) * 5; // 10〜40 ℃ 上がる
  const dt = t2 - t1;
  const dv = v0 * beta * dt;
  const fmt = (n: number): string => `${fx(n, 2)} L`;
  const { choices, answer } = buildNumeric(dv, fmt, [
    v0 + dv, // 増加分ではなく、増えたあとの体積を答えた
    v0 * beta * t2, // 温度の「差」ではなく到達温度を使った
    beta * dt, // もとの体積を掛け忘れた
    v0 * beta, // 温度の差を掛け忘れた
  ]);
  return {
    question:
      `体膨張率が ${beta} /℃ の液体 ${v0} L を、${t1} ℃ から ${t2} ℃ まで温めた。` +
      '増加する体積はおよそいくらか。',
    choices,
    answer,
    explanation:
      `**増える体積 ＝ もとの体積 × 体膨張率 × 温度の差**です。\n\n` +
      `温度の差は ${t2} − ${t1} ＝ **${dt} ℃**。\n\n` +
      `${v0} × ${beta} × ${dt} ＝ **${fx(dv, 2)} L** です。\n\n` +
      `**聞かれているのは「増加する体積」**であって、増えたあとの体積（${fx(v0 + dv, 2)} L）ではありません。` +
      'どちらを聞かれているか、問題文を必ず確かめてください。',
  };
}

/** 比重から質量を出す。水 1 L ＝ 1 kg を使う */
function mass(): DrillItem {
  const v = rnd(2, 20) * 50; // 100〜1,000 L
  const d = pick([0.65, 0.72, 0.79, 0.8, 0.87, 0.9, 1.05, 1.26]);
  const kg = v * d;
  const fmt = (n: number): string => `${fx(n, 1)} kg`;
  const { choices, answer } = buildNumeric(kg, fmt, [
    v / d, // 割ってしまった
    v, // 比重を使わなかった
    v * d * 1000, // L と mL を取り違えた
  ]);
  return {
    question: `比重 ${d} の液体が ${v} L ある。この液体の質量はおよそいくらか。`,
    choices,
    answer,
    explanation:
      `**比重は「水を 1 としたときの重さ」**です。そして**水 1 L はおよそ 1 kg**。\n\n` +
      `つまり、この液体は 1 L あたり ${d} kg です。\n\n` +
      `${v} × ${d} ＝ **${fx(kg, 1)} kg**。\n\n` +
      (d > 1
        ? '比重が 1 より大きいので、**この液体は水に沈みます。**'
        : '比重が 1 より小さいので、**この液体は水に浮きます。**'),
  };
}

/**
 * 指定数量の倍数。**法令の計算だが、手順は算数。**
 *
 * 指定数量は政令別表第三の値（`docs/primary-numbers.md` A-2）。
 * **ここだけは実在の値を使っている。**法令の値で、一次資料で確認済みのため。
 */
const SHITEI: readonly { name: string; n: number }[] = [
  { name: 'ガソリン', n: 200 },
  { name: 'ベンゼン', n: 200 },
  { name: 'アセトン', n: 400 },
  { name: 'メタノール', n: 400 },
  { name: '灯油', n: 1000 },
  { name: '軽油', n: 1000 },
  { name: '酢酸', n: 2000 },
  { name: '重油', n: 2000 },
  { name: 'グリセリン', n: 4000 },
  { name: 'ギヤー油', n: 6000 },
];

function multiple(): DrillItem {
  // 同じ品名を 2 回選ばないよう、添字で選んでから重複を外す
  const picked: { name: string; n: number }[] = [];
  while (picked.length < (Math.random() < 0.5 ? 2 : 3)) {
    const s = pick(SHITEI);
    if (!picked.some((p) => p.name === s.name)) picked.push(s);
  }
  const rows = picked.map((p) => {
    const half = rnd(1, 8); // 0.5 刻みの倍数になるようにする
    return { ...p, amount: (p.n * half) / 2, ratio: half / 2 };
  });
  const total = rows.reduce((a, r) => a + r.ratio, 0);
  const sumAmount = rows.reduce((a, r) => a + r.amount, 0);
  const sumShitei = rows.reduce((a, r) => a + r.n, 0);
  const fmt = (n: number): string => `${fx(n, 2)} 倍`;
  const { choices, answer } = buildNumeric(total, fmt, [
    sumAmount / sumShitei, // 量を全部足してから、指定数量を全部足したもので割った
    rows.reduce((a, r) => a * r.ratio, 1), // 商を掛けてしまった
    sumShitei / sumAmount, // 逆にした
  ]);
  const list = rows.map((r) => `${r.name} ${r.amount} L`).join('、');
  const steps = rows.map((r) => `${r.name}：${r.amount} ÷ ${r.n} ＝ ${fx(r.ratio, 2)}`).join('\n');
  return {
    question: `同一の場所に ${list} を貯蔵している。指定数量の倍数はいくらか。`,
    choices,
    answer,
    explanation:
      `**品名ごとに「貯蔵量 ÷ 指定数量」を出してから、その商を足します。**\n\n` +
      `${steps}\n\n` +
      `足して **${fx(total, 2)} 倍**です。\n\n` +
      `**量を全部足してから、指定数量を全部足したもので割ってはいけません。**` +
      `それだと ${fx(sumAmount / sumShitei, 2)} 倍になり、まったく違う答えになります。`,
  };
}

/** 質量パーセント濃度 */
function concentration(): DrillItem {
  const p = pick([4, 5, 8, 10, 20, 25, 40, 50]);
  const total = pick([200, 250, 400, 500, 800, 1000]);
  const solute = (total * p) / 100;
  const solvent = total - solute;
  const fmt = (n: number): string => `${fx(n, 1)} %`;
  const { choices, answer } = buildNumeric(p, fmt, [
    (solute / solvent) * 100, // 溶媒で割ってしまった
    (solvent / total) * 100, // 溶媒の割合を答えた
    (total / solute) * 100, // 逆にした
  ]);
  return {
    question: `水 ${solvent} g に物質を ${solute} g 溶かした。この水溶液の質量パーセント濃度はいくらか。`,
    choices,
    answer,
    explanation:
      `**質量パーセント濃度 ＝ 溶けているものの質量 ÷ 水溶液全体の質量 × 100** です。\n\n` +
      `**分母は「水溶液全体」であって「水」ではありません。**\n\n` +
      `水溶液全体は ${solvent} ＋ ${solute} ＝ **${total} g**。\n\n` +
      `${solute} ÷ ${total} × 100 ＝ **${fx(p, 1)} %** です。\n\n` +
      `水の ${solvent} g で割ると ${fx((solute / solvent) * 100, 1)} % になってしまいます。`,
  };
}

/**
 * ヘスの法則で生成熱を求める。
 *
 * **公開問題（乙種第 4 類）の問 22 と同じ形。**
 * 水素 286 kJ/mol、炭素 394 kJ/mol、プロパン 2,219 kJ/mol という値は、
 * その問題文で与えられていたもの（`docs/public-questions.md`）。
 * ほかの炭化水素の燃焼熱も、同じ標準的な表から採った値を使う。
 * **値を乱数で作らない。**実在の物質の燃焼熱として嘘の数字を出すことになるため。
 */
const HC: readonly { name: string; formula: string; c: number; h2: number; burn: number }[] = [
  { name: 'メタン', formula: 'CH4', c: 1, h2: 2, burn: 891 },
  { name: 'エタン', formula: 'C2H6', c: 2, h2: 3, burn: 1560 },
  { name: 'プロパン', formula: 'C3H8', c: 3, h2: 4, burn: 2219 },
  { name: 'ブタン', formula: 'C4H10', c: 4, h2: 5, burn: 2878 },
];

const BURN_C = 394;
const BURN_H2 = 286;

function hess(): DrillItem {
  const s = pick(HC);
  const made = s.c * BURN_C + s.h2 * BURN_H2 - s.burn;
  const fmt = (n: number): string => `${fx(n, 0)} kJ/mol`;
  const { choices, answer } = buildNumeric(made, fmt, [
    s.burn - (s.c * BURN_C + s.h2 * BURN_H2), // 引く向きを逆にした
    s.c * BURN_C + s.h2 * BURN_H2 + s.burn, // 足してしまった
    s.c * BURN_C + s.h2 * BURN_H2, // 燃焼熱を引き忘れた
    BURN_C + BURN_H2 - s.burn, // 係数を掛け忘れた
  ]);
  return {
    question:
      `水素の燃焼熱が ${BURN_H2} kJ/mol、炭素の燃焼熱が ${BURN_C} kJ/mol、` +
      `${s.name}（${s.formula}）の燃焼熱が ${s.burn} kJ/mol であるとき、` +
      `${s.name}の生成熱はいくらか。`,
    choices,
    answer,
    explanation:
      `**ヘスの法則：出発点と到着点が同じなら、途中の道すじが違っても熱の出入りの合計は同じ**です。\n\n` +
      `${s.name}を燃やすと、炭素 ${s.c} 個ぶんの二酸化炭素と、水素 ${s.h2} 個ぶんの水ができます。\n\n` +
      `**道すじ 1**：炭素と水素をそのまま燃やす。\n` +
      `${s.c} × ${BURN_C} ＋ ${s.h2} × ${BURN_H2} ＝ ${s.c * BURN_C} ＋ ${s.h2 * BURN_H2} ＝ **${s.c * BURN_C + s.h2 * BURN_H2} kJ**\n\n` +
      `**道すじ 2**：いったん${s.name}を作ってから燃やす。\n` +
      `（${s.name}の生成熱）＋ ${s.burn} kJ\n\n` +
      `**この 2 つは等しい**ので、生成熱 ＝ ${s.c * BURN_C + s.h2 * BURN_H2} − ${s.burn} ＝ **${made} kJ/mol** です。\n\n` +
      `**引く向きを間違えると符号が逆になります。**「作るほうから、燃やすぶんを引く」と覚えてください。`,
  };
}

/**
 * ドリルの一覧。ここに足すと `/drill` の画面に自動で並ぶ。
 * `sectionId` は教本へ戻る導線に使うので必ず実在する節 ID にすること
 * （`npm run check` が参照切れを検出する）。
 */
export const DRILLS: Drill[] = [
  {
    id: 'heat',
    name: '比熱と熱量',
    categoryId: 'sci-base',
    sectionId: 'sb-2',
    summary: '熱量 ＝ 質量 × 比熱 × 温度の差。温度は「差」を使う',
    generate: heat,
  },
  {
    id: 'expand',
    name: '熱膨張',
    categoryId: 'sci-base',
    sectionId: 'sb-1',
    summary: '増える体積 ＝ もとの体積 × 体膨張率 × 温度の差',
    generate: expand,
  },
  {
    id: 'mass',
    name: '比重から質量',
    categoryId: 'sci-base',
    sectionId: 'sb-3',
    summary: '水 1 L ＝ 1 kg を足がかりに、体積と比重から質量を出す',
    generate: mass,
  },
  {
    id: 'concentration',
    name: '質量パーセント濃度',
    categoryId: 'sci-base',
    sectionId: 'sb-4',
    summary: '分母は「水溶液全体」であって「水」ではない',
    generate: concentration,
  },
  {
    id: 'hess',
    name: '生成熱（ヘスの法則）',
    categoryId: 'sci-base',
    sectionId: 'sb-5',
    summary: '燃焼熱から生成熱を出す。公開問題と同じ形',
    generate: hess,
  },
  {
    id: 'multiple',
    name: '指定数量の倍数',
    categoryId: 'law-what',
    sectionId: 'lw-4',
    summary: '品名ごとに割ってから足す。先に足してはいけない',
    generate: multiple,
  },
];

export const drillById = (id: string): Drill | undefined => DRILLS.find((d) => d.id === id);
