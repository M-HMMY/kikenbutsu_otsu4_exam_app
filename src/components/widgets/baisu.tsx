import { useState, type JSX } from 'react';

/**
 * 指定数量の倍数を、品名と量を変えながら確かめるツール。
 *
 * **倍数は「量 ÷ 指定数量」を足すだけ**なのに、
 * 品名ごとに指定数量が違うせいで、慣れるまで手が止まる。
 * 数を動かして「1 を超えたところで規制がかかる」という感覚をつかむための道具。
 *
 * 指定数量は `docs/primary-numbers.md` の A-2（政令 別表第三）。
 * **法令の値なので断定してよい。**物性値と違って出典が割れていない。
 */

export const widgetId = 'baisu';

interface Item {
  name: string;
  /** 指定数量（L） */
  amount: number;
  note: string;
}

/** 第 4 類の品名と指定数量（政令 別表第三）。代表物質は覚えやすさのために添えている */
const ITEMS: Item[] = [
  { name: '特殊引火物', amount: 50, note: 'ジエチルエーテル、二硫化炭素' },
  { name: '第 1 石油類（非水溶性）', amount: 200, note: 'ガソリン、ベンゼン、トルエン' },
  { name: '第 1 石油類（水溶性）', amount: 400, note: 'アセトン、ピリジン' },
  { name: 'アルコール類', amount: 400, note: 'メタノール、エタノール' },
  { name: '第 2 石油類（非水溶性）', amount: 1000, note: '灯油、軽油、キシレン' },
  { name: '第 2 石油類（水溶性）', amount: 2000, note: '酢酸、アクリル酸' },
  { name: '第 3 石油類（非水溶性）', amount: 2000, note: '重油、クレオソート油' },
  { name: '第 3 石油類（水溶性）', amount: 4000, note: 'グリセリン、エチレングリコール' },
  { name: '第 4 石油類', amount: 6000, note: 'ギヤー油、シリンダー油' },
  { name: '動植物油類', amount: 10000, note: 'アマニ油などの乾性油' },
];

interface Row {
  itemIndex: number;
  volume: number;
}

/**
 * 小数を読みやすく整える（末尾の 0 を落とす）。
 *
 * **1 未満の値を「1」と表示しないこと。**
 * この画面は「倍数が 1 以上かどうか」で結論が変わるので、
 * 素朴に 3 桁で丸めると 0.9999 が「1 倍」と出て、
 * 下の判定（指定数量未満）と矛盾して見える。
 * **境目をまたぐ側だけ、桁を増やして正直に出す。**
 */
const fx = (n: number): string => {
  const rounded = Number(n.toFixed(3));
  if (n < 1 && rounded >= 1) return Number(n.toFixed(6)).toString();
  if (n >= 1 && rounded < 1) return Number(n.toFixed(6)).toString();
  return rounded.toString();
};

export default function BaisuWidget(): JSX.Element {
  const [rows, setRows] = useState<Row[]>([
    { itemIndex: 1, volume: 400 },
    { itemIndex: 4, volume: 2000 },
  ]);

  const each = rows.map((r) => {
    const item = ITEMS[r.itemIndex];
    return { item, volume: r.volume, ratio: item ? r.volume / item.amount : 0 };
  });
  const total = each.reduce((n, e) => n + e.ratio, 0);

  const setRow = (i: number, patch: Partial<Row>): void => {
    setRows((prev) => prev.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  };

  return (
    <div className="widget-body">
      <p className="widget-lead">
        品名と量を選ぶと、指定数量の倍数を計算します。
        <strong>倍数が 1 以上になると、製造所等でなければ扱えません。</strong>
      </p>

      <table className="widget-table">
        <thead>
          <tr>
            <th>品名</th>
            <th>貯蔵量</th>
            <th>指定数量</th>
            <th>倍数</th>
          </tr>
        </thead>
        <tbody>
          {each.map((e, i) => (
            <tr key={i}>
              <td>
                <select
                  value={rows[i]?.itemIndex ?? 0}
                  onChange={(ev) => setRow(i, { itemIndex: Number(ev.target.value) })}
                  aria-label={`${i + 1} つめの品名`}
                >
                  {ITEMS.map((it, k) => (
                    <option key={it.name} value={k}>
                      {it.name}
                    </option>
                  ))}
                </select>
                <span className="widget-note">{e.item?.note}</span>
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={rows[i]?.volume ?? 0}
                  onChange={(ev) => setRow(i, { volume: Math.max(0, Number(ev.target.value) || 0) })}
                  aria-label={`${i + 1} つめの貯蔵量（L）`}
                />{' '}
                L
              </td>
              <td>{e.item ? `${e.item.amount.toLocaleString()} L` : '—'}</td>
              <td>
                {fx(e.volume)} ÷ {e.item?.amount.toLocaleString()} ={' '}
                <strong>{fx(e.ratio)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="widget-actions">
        <button
          type="button"
          className="btn small ghost"
          onClick={() => setRows((p) => [...p, { itemIndex: 0, volume: 0 }])}
          disabled={rows.length >= 5}
        >
          品名を足す
        </button>
        <button
          type="button"
          className="btn small ghost"
          onClick={() => setRows((p) => (p.length > 1 ? p.slice(0, -1) : p))}
          disabled={rows.length <= 1}
        >
          最後の行を消す
        </button>
      </div>

      <p className="widget-result">
        合計の倍数 <strong>{fx(total)}</strong> 倍
        {' — '}
        {total >= 1 ? (
          <span className="widget-warn">
            指定数量以上です。製造所等として許可を受けた場所でなければ貯蔵・取扱いできません。
          </span>
        ) : (
          <span>指定数量未満です。市町村条例（少量危険物）の扱いになります。</span>
        )}
      </p>

      <p className="widget-note">
        倍数は品名ごとに出して足します。<strong>1 未満のものも切り捨てずに足してください。</strong>
        水溶性の指定数量は非水溶性のちょうど 2 倍で、アルコール類にはこの区別がありません。
      </p>
    </div>
  );
}
