// 開発サーバのアプリを、実際にブラウザで開いて操作する。
//
// なぜこれが要るか：`npm run check` は React で描画までするが、それは
// 「描ける」ことしか見ていない。クリックしたとき何が起きるかは見ていない。
// このスクリプトを書いたことで、確認問題の解答が学習記録へ二重登録される
// 不具合が実際に見つかった（Practice.tsx で actions.answer を setSession の
// 更新関数の中で呼んでいた。StrictMode では更新関数が 2 回走る）。
// 検査でもビルドでも型でも捕まらない種類の不具合で、押してみるしかなかった。
//
// なぜ Playwright を入れないか：このリポジトリの方針が「ランタイム依存は
// React だけ」なので、開発用でも重い依存は足したくない。Node 24 には
// WebSocket が組み込みで入っているため、Chrome DevTools Protocol へ
// 直接つなげば追加インストールなしで済む。Edge は Windows に最初からある。
//
// 使い方：
//   1. 別の端末で `npm run dev` を起動しておく
//   2. node scripts/drive.mjs
//
// 別の画面を見たいときは、いちばん下の「筋書き」だけ書き換える。

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;
// vite は 5173 が埋まっていると 5174、5175 と繰り上がる。
// 別のアプリの開発サーバを同時に立てていると起きるので、環境変数で渡せるようにする。
//   DEV_PORT=5174 node scripts/drive.mjs
const BASE = `http://localhost:${process.env.DEV_PORT ?? 5173}`;

// **どのアプリにつないだかを必ず確かめる。**
// ポートを固定していたせいで、姉妹アプリの開発サーバを相手に
// 「確認できました」と報告しかけた。取り違えは黙って起きるので、機械に見張らせる。
const EXPECT_TITLE = '危険物乙4';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Edge を headless で起動して DevTools につなぐ ---

const profile = mkdtempSync(join(tmpdir(), 'drive-'));
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    // 使い捨てのプロファイルにしないと、ふだん使いの Edge が開いているときに
    // 起動が奪われて DevTools につながらない。
    `--user-data-dir=${profile}`,
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function debuggerUrl() {
  // 起動直後は /json/list がまだ応答しない。数秒ぶんだけ待つ。
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* まだ起動中 */
    }
    await sleep(250);
  }
  throw new Error('DevTools につながらなかった。Edge のパスを確かめること');
}

const ws = new WebSocket(await debuggerUrl());
await new Promise((r) => (ws.onopen = r));

let id = 0;
const waiting = new Map();
const errors = [];

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg);
    waiting.delete(msg.id);
    return;
  }
  // 画面は出ているのにコンソールだけ荒れている、という状態を見逃さないため、
  // 例外と console.error を拾っておく。React の警告もここに出る。
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
};

function send(method, params = {}) {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((r) => waiting.set(n, r));
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.result?.exceptionDetails) {
    throw new Error(JSON.stringify(res.result.exceptionDetails));
  }
  return res.result?.result?.value;
}

// --- 操作のことば ---

/** ハッシュルータなので、location.hash を書き換えれば画面が変わる。 */
async function go(hash) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`);
  await sleep(700);
}

/** いま画面に出ている文字。空行を潰して読みやすくする。 */
function visible() {
  return evaluate(
    `(() => {
       const t = document.querySelector('.page')?.innerText ?? document.body.innerText;
       return t.replace(/\\n{2,}/g, '\\n').trim();
     })()`,
  );
}

/**
 * 文字で要素を探して押す。セレクタではなく見えている文字で指すのは、
 * 画面の作りが変わっても筋書きを書き直さずに済むため。
 * 見つからなければ 'NOT_FOUND' が返る（例外にしない。押せなかったこと自体が結果）。
 */
function click(text, tag = 'button') {
  return evaluate(
    `(() => {
       const els = [...document.querySelectorAll(${JSON.stringify(tag)})];
       const el = els.find((e) => e.innerText.trim().includes(${JSON.stringify(text)}));
       if (!el) return 'NOT_FOUND';
       el.click();
       return 'OK';
     })()`,
  );
}

/**
 * 選択肢（ア〜オ）の n 番目を押す。確認問題と模試で使う。
 *
 * **この試験は五肢択一なので「オ」まである。**姉妹アプリは四肢択一で、
 * ここが「ア〜エ」のままだった。5 つめを押せないことに黙って気づけない形なので、
 * 下の筋書きで**選択肢が 5 つあることを数えて確かめている。**
 */
function choose(n) {
  return evaluate(
    `(() => {
       const b = [...document.querySelectorAll('button')]
         .filter((x) => /^[アイウエオ]/.test(x.innerText.trim()));
       if (!b[${n}]) return 'NO_CHOICES';
       b[${n}].click();
       return 'OK';
     })()`,
  );
}

/** いま選択されている選択肢の数。単一選択と複数選択の違いはここに出る。 */
function selectedCount() {
  return evaluate(`document.querySelectorAll('.choice.selected').length`);
}

/** いま出ている問題が複数選択かどうか。画面のタグで見る。 */
function isMulti() {
  return evaluate(`document.querySelector('.tag-multi') !== null`);
}

// 教本の 43 節。`docs/section-plan.md` と `src/data/textbook/index.ts` の並びに合わせてある。
//
// **ここに直接書いてあるのはわざとです。**アプリ側から拾うと、
// 節が 1 つ抜け落ちたときに「抜けたまま全部通った」ことになる。
// 数が合わなければ下で止まる。
const ALL_SECTIONS = [
  'i-1', 'i-2', 'i-3', 'i-4',
  'lw-1', 'lw-2', 'lw-3', 'lw-4',
  'lp-1', 'lp-2', 'lp-3', 'lp-4',
  'lm-1', 'lm-2', 'lm-3', 'lm-4',
  'lr-1', 'lr-2', 'lr-3', 'lr-4',
  'sb-1', 'sb-2', 'sb-3', 'sb-4', 'sb-5', 'sb-6',
  'sf-1', 'sf-2', 'sf-3',
  'ss-1', 'ss-2', 'ss-3',
  'pc-1', 'pc-2', 'pc-3', 'pc-4', 'pc-5',
  'pe-1', 'pe-2', 'pe-3', 'pe-4', 'pe-5', 'pe-6',
];

const report = [];
const show = (title, body) => report.push(`\n===== ${title} =====\n${body}`);

// ============================================================
// 筋書き — ここだけ書き換えて使う
//
// **いまは入門編 4 節・問題 0 問。**確認問題が入ったら、
// 姉妹アプリと同じく「節 → 確認問題を 1 問解いて採点 → 模試 → 体験ツール」まで
// 押すように書き換えること。いまは入門編 4 節が描けるかまでを見ている。
// ============================================================

await send('Page.enable');
await send('Runtime.enable');
await evaluate(`location.href = ${JSON.stringify(BASE + '/')}`);
await sleep(1200);
{
  const title = await evaluate('document.title');
  if (typeof title !== 'string' || !title.includes(EXPECT_TITLE)) {
    console.error(
      `つないだ先が違う：${BASE} のタイトルは「${title}」。` +
        `DEV_PORT を確かめること（このアプリは「${EXPECT_TITLE}」を含む）。`,
    );
    process.exit(1);
  }
}
await evaluate(`location.href = ${JSON.stringify(BASE + '/#/home')}`);
await sleep(1500);
show('ホーム', (await visible()).slice(0, 500));

// 教本の節が描けるか。表と quiz の記法が崩れていないかもここで分かる。
//
// **43 節すべてを開く。**節ごとに書いた人が違ううえ、図の記法は
// `npm run check` が書式までしか見ない。実際に描かせないと、
// 「枠は出るが中身が空」という壊れ方が残る。
//
// 全節ぶんの本文を貼ると報告が読めなくなるので、**節ごとには要約だけを出し、
// 異常があったものだけを本文つきで出す。**
const sectionReport = [];
const badSections = [];

for (const id of ALL_SECTIONS) {
  await go(`#/textbook/${id}`);
  const info = await evaluate(
    `(() => {
       const page = document.querySelector('.page');
       if (!page) return { missing: true };
       const text = page.innerText;
       return {
         chars: text.length,
         // 節の骨格。digest.ts が直前チェックシートへ抜き出すもの。
         hasSummary: text.includes('この節のまとめ'),
         hasPoint: text.includes('試験のポイント'),
         // 図と表と一問一答が、実際に要素として出ているか
         diagrams: document.querySelectorAll('.dgm').length,
         tables: document.querySelectorAll('table').length,
         quizzes: document.querySelectorAll('.selfcheck-item').length,
         // 描けなかったときに出る形跡
         nan: /NaN|undefined|\\[object Object\\]/.test(text),
         // 記法が崩れると、生の記号が本文に出てくる
         raw: new RegExp('\\\\*\\\\*|::|' + String.fromCharCode(96).repeat(3)).test(text),
       };
     })()`,
  );
  const flags = [];
  if (info.missing) flags.push('描けていない');
  if (!info.hasSummary) flags.push('まとめが無い');
  if (!info.hasPoint) flags.push('試験のポイントが無い');
  if (info.nan) flags.push('NaN/undefined が出ている');
  if (info.raw) flags.push('記法の生の記号が出ている');
  if (info.chars < 800) flags.push(`短すぎる（${info.chars} 字）`);

  sectionReport.push(
    `${id.padEnd(6)} ${String(info.chars ?? 0).padStart(5)}字  ` +
      `図${info.diagrams ?? 0} 表${info.tables ?? 0} 一問一答${info.quizzes ?? 0}` +
      (flags.length ? `  ★ ${flags.join(' / ')}` : ''),
  );
  if (flags.length) badSections.push(id);
}

show('教本 43 節', sectionReport.join('\n'));

// 異常のあった節だけ、本文を出して目で見る
for (const id of badSections.slice(0, 5)) {
  await go(`#/textbook/${id}`);
  show(`教本 ${id}（要確認）`, (await visible()).slice(0, 900));
}

// 直前チェックシート。各節の「まとめ」「試験のポイント」「よくある勘違い」を
// digest.ts が機械的に抜き出す。**書式が崩れていれば、ここに出てこない。**
await go('#/sheet');
{
  const n = await evaluate(
    `document.querySelectorAll('.sheet-section, .sheet h3, .page h3').length`,
  );
  show('直前チェックシート', `見出しの数: ${n}\n` + (await visible()).slice(0, 900));
}

// 計算ドリル。**この試験には計算問題が出る**ので、姉妹アプリと違って中身がある。
// 値を振り直して出すため、**選択肢が 5 つ揃うか**をここで数える。
await go('#/drill');
show('計算ドリルの一覧', (await visible()).slice(0, 600));

{
  // **一覧で名前を押すと、その種類の選択が外れるだけ**（チェックボックス）。
  // 実際に問題を出すのは「ドリルを始める」。ここを取り違えて
  // 「選択肢が 0 個」という誤った結果を出したことがある。
  const drillReport = [];

  await go('#/drill');
  await click('すべて選ぶ');
  await sleep(300);
  const started = await click('ドリルを始める');
  await sleep(800);

  if (started !== 'OK') {
    drillReport.push('「ドリルを始める」が押せなかった: ' + started);
  } else {
    // 6 種類すべてが出るまで、何問か続けて解く。
    // 値は毎回振り直されるので、**同じ種類でも別の問題**になる。
    const seen = new Set();
    for (let i = 0; i < 24; i += 1) {
      const info = await evaluate(
        `(() => {
           const page = document.querySelector('.page');
           const text = page ? page.innerText : '';
           const choices = [...document.querySelectorAll('button')]
             .filter((x) => /^[アイウエオ]/.test(x.innerText.trim()));
           return {
             choices: choices.length,
             labels: choices.map((c) => c.innerText.trim().slice(0, 28)),
             nan: /NaN|undefined|Infinity/.test(text),
             head: text.slice(0, 220).replace(/\s+/g, ' '),
           };
         })()`,
      );

      if (info.choices === 0) {
        drillReport.push(`${i + 1} 問目: 選択肢が出ていない  ${info.head}`);
        break;
      }

      const flags = [];
      if (info.choices !== 5) flags.push(`★ 選択肢が ${info.choices} 個（五肢択一なので 5 個のはず）`);
      if (info.nan) flags.push('★ NaN/undefined/Infinity が出ている');
      // 同じ文字列の選択肢が 2 つあると、正解が一意に決まらない
      if (new Set(info.labels).size !== info.labels.length) flags.push('★ 同じ選択肢が重複している');

      const key = info.head.slice(0, 40);
      if (!seen.has(key) || flags.length) {
        seen.add(key);
        drillReport.push(`${i + 1} 問目: 選択肢 ${info.choices} 個 ${flags.join(' ')}\n    ${info.head}`);
      }

      // 1 つ選んで採点し、次へ進む
      await choose(0);
      await sleep(200);
      await click('解答する');
      await sleep(200);
      const next = await click('次の問題へ');
      await sleep(400);
      if (next !== 'OK') {
        drillReport.push(`${i + 1} 問目のあと「次の問題」が押せなかった（${next}）`);
        break;
      }
    }
  }

  show('計算ドリル', drillReport.join('\n'));
}

// 体験ツール。**押して壊れないかまで見る。**
// 置いてあるだけでは、つまみを動かしたときに NaN が出ても分からない。
await go('#/tools');
show('体験ツールの一覧', (await visible()).slice(0, 600));

{
  const toolReport = [];
  const ids = await evaluate(`window.__widgetIds ?? null`);
  toolReport.push('教本に埋め込んだウィジェット: baisu / inkaten / shouka');

  // 教本の節に埋め込んだものを、節ごと開いて操作する
  for (const [sec, wid] of [['lw-4', 'baisu'], ['sf-2', 'inkaten'], ['ss-1', 'shouka']]) {
    await go(`#/textbook/${sec}`);
    const found = await evaluate(`document.querySelectorAll('.widget').length`);
    if (!found) {
      toolReport.push(`${sec}: ${wid} が描かれていない`);
      continue;
    }

    // つまみ・選択・ボタンを一通り動かす
    await evaluate(
      `(() => {
         const set = (el, v) => {
           const proto = Object.getPrototypeOf(el);
           const d = Object.getOwnPropertyDescriptor(proto, 'value');
           d.set.call(el, String(v));
           el.dispatchEvent(new Event('input', { bubbles: true }));
           el.dispatchEvent(new Event('change', { bubbles: true }));
         };
         for (const r of document.querySelectorAll('.widget input[type=range]')) set(r, r.max);
         for (const n of document.querySelectorAll('.widget input[type=number]')) set(n, 9999);
         for (const sel of document.querySelectorAll('.widget select')) {
           set(sel, sel.options[sel.options.length - 1].value);
         }
         for (const b of document.querySelectorAll('.widget .widget-card')) b.click();
         return true;
       })()`,
    );
    await sleep(400);

    const after = await evaluate(
      `(() => {
         const w = document.querySelector('.widget');
         const t = w ? w.innerText : '';
         return {
           chars: t.length,
           bad: /NaN|undefined|Infinity|\\[object Object\\]/.test(t),
           tail: t.slice(-180).replace(/\\s+/g, ' '),
         };
       })()`,
    );
    toolReport.push(
      `${sec} / ${wid}: ${after.chars} 字` +
        (after.bad ? '  ★ NaN/undefined が出ている' : '') +
        `\n    ${after.tail}`,
    );
  }
  show('体験ウィジェット（操作したあと）', toolReport.join('\n'));
}

// 確認問題。**105 問入ったので、実際に解いて採点まで押す。**
await go('#/practice');
show('確認問題の設定', (await visible()).slice(0, 500));
{
  const qReport = [];
  // ボタンの文言は「10 問を開始する」のように出題数が入る。**文字で押すので前方一致で探す。**
  const started = (await click('問を開始する')) === 'OK';
  await sleep(700);
  if (!started) {
    qReport.push('開始ボタンが押せなかった');
  } else {
    for (let i = 0; i < 6; i += 1) {
      const info = await evaluate(
        `(() => {
           const page = document.querySelector('.page');
           const text = page ? page.innerText : '';
           const choices = [...document.querySelectorAll('button')]
             .filter((x) => /^[アイウエオ]/.test(x.innerText.trim()));
           return { choices: choices.length, head: text.slice(0, 120).replace(/\\s+/g, ' ') };
         })()`,
      );
      if (info.choices === 0) {
        qReport.push(`${i + 1} 問目: 選択肢が出ていない  ${info.head}`);
        break;
      }
      qReport.push(
        `${i + 1} 問目: 選択肢 ${info.choices} 個` +
          (info.choices === 5 ? '' : '  ★ 五肢択一なので 5 個のはず'),
      );
      await choose(i % 5);
      await sleep(150);
      await click('解答する');
      await sleep(250);
      // 解説に教本への導線があるか（sectionId が効いているか）
      if (i === 0) {
        const link = await evaluate(
          `[...document.querySelectorAll('button, a')]
             .some((e) => /この節を読む|教本/.test(e.innerText))`,
        );
        qReport.push(`  解説から教本へ戻る導線: ${link ? 'ある' : '★ 無い'}`);
      }
      if (await click('次の問題') !== 'OK') break;
      await sleep(300);
    }
  }
  show('確認問題', qReport.join('\n'));
}

// 模試。**科目ごとの判定が出るのがこのアプリの要。**
await go('#/mock');
show('模試の設定', (await visible()).slice(0, 800));

// ============================================================

// ============================================================

show('コンソールエラー', errors.length ? errors.join('\n') : '(なし)');
console.log(report.join('\n'));
