import { useState, type JSX } from 'react';
import { Widget, widgetIds } from '../components/Widget';
import { navigate } from '../lib/router';

/**
 * 体験ツール（対話ウィジェット）の一覧。教本の該当箇所にも同じものが埋め込まれている。
 *
 * ここに並べた id は、`src/components/widgets/<id>.tsx` を作れば自動で有効になる
 * （`Widget.tsx` がファイルを走査して登録する）。まだ書いていない id は表示されない。
 * つまり**この一覧は「作りたいものの計画表」も兼ねている。**
 */
/**
 * 体験ツールの並び。ここに並べた ID のファイルを `src/components/widgets/` に置くと
 * 自動で有効になる。**まだ 1 つも作っていない。**下の並びは作りたいものの計画表である。
 *
 * **先頭のグループを 1 つも実装しないまま置かないこと。**姉妹アプリでは、
 * 既定で開くグループが空で「この分類のツールはまだ用意されていません」だけの
 * 画面になる不具合が出た（下の `firstFilled` はその回避）。
 */
const GROUPS: { name: string; note: string; ids: string[] }[] = [
  {
    name: '指定数量',
    note: '品名と数量を変えると、指定数量の倍数と必要な手続きがどう変わるかを見ます',
    ids: ['shitei-suryo', 'baisu'],
  },
  {
    name: '物理と化学',
    note: '比熱・熱膨張・濃度など、計算問題になる量を数値を動かして確かめます',
    ids: ['hinetsu', 'nesshoucho', 'noudo'],
  },
  {
    name: '燃焼と消火',
    note: '引火点・発火点・燃焼範囲の関係と、消火の 3 要素のどれを断つのかを並べて見ます',
    ids: ['inkaten', 'nenshou-hani', 'shouka'],
  },
  {
    name: '品名の見分け',
    note: '特殊引火物から動植物油類まで、引火点で並べ替えて位置関係を覚えます',
    ids: ['hinmei'],
  },
];

export function Tools(): JSX.Element {
  const [openGroup, setOpenGroup] = useState<string>(GROUPS[0].name);
  const known = new Set(GROUPS.flatMap((g) => g.ids));
  const others = widgetIds.filter((id) => !known.has(id));

  if (widgetIds.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>体験ツール</h1>
          <p className="lead">
            文章だけでは掴みにくいところを、数値を動かして確かめるための道具です。教本の該当セクションにも同じものが埋め込まれます。
          </p>
        </header>
        <section className="section">
          <p className="hint">
            体験ツールはまだ 1 つも用意されていません。
            <code>src/components/widgets/</code> にファイルを追加すると、この画面と教本本文の両方で自動的に使えるようになります。
          </p>
        </section>
        <div className="read-actions">
          <button type="button" className="btn primary" onClick={() => navigate('textbook')}>
            教本を読む
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>体験ツール</h1>
        <p className="lead">
          文章だけでは掴みにくいところを、数値を動かして確かめるための道具です。教本の該当セクションにも同じものが埋め込まれています。
        </p>
      </header>

      <div className="chips">
        {GROUPS.map((g) => (
          <button
            key={g.name}
            type="button"
            className={`chip ${openGroup === g.name ? 'on' : ''}`}
            onClick={() => setOpenGroup(g.name)}
          >
            {g.name}（{g.ids.filter((id) => widgetIds.includes(id)).length}）
          </button>
        ))}
      </div>

      {GROUPS.filter((g) => g.name === openGroup).map((g) => {
        const ready = g.ids.filter((id) => widgetIds.includes(id));
        return (
          <section key={g.name} className="section">
            <h2>{g.name}</h2>
            <p className="hint">{g.note}</p>
            {ready.length === 0 && <p className="hint">この分類のツールはまだ用意されていません。</p>}
            {ready.map((id) => (
              <Widget key={id} id={id} />
            ))}
          </section>
        );
      })}

      {others.length > 0 && (
        <section className="section">
          <h2>その他</h2>
          {others.map((id) => (
            <Widget key={id} id={id} />
          ))}
        </section>
      )}
    </div>
  );
}
