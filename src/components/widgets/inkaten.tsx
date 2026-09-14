import { useState, type JSX } from 'react';

/**
 * 液温を動かして、引火するかどうかを見るツール。
 *
 * **引火点・燃焼範囲・蒸気の濃さは、同じことを別の角度から見ている。**
 * 言葉で読むと 3 つの別の話に見えるので、
 * 「液温を上げる → 蒸気が濃くなる → 下限値に届いた瞬間が引火点」
 * という 1 本の線につなげるための道具。
 *
 * **実在の物質の値は使っていない。**`docs/primary-numbers.md` の B 節にあるとおり、
 * 引火点も燃焼範囲も出典によって値が食い違う。
 * ここで見せたいのは値ではなく**順序と向き**なので、目盛りだけを置いている。
 */

export const widgetId = 'inkaten';

/** 目盛りの上の位置（%）。実在の物質の値ではない */
const MARKS = [
  { at: 18, label: '引火点', desc: '火を近づけると引火する最低の液温' },
  { at: 30, label: '燃焼点', desc: '引火したあと、燃え続けるようになる液温' },
  { at: 82, label: '発火点', desc: '火を近づけなくても、自分から燃え出す温度' },
];

export default function InkatenWidget(): JSX.Element {
  const [pos, setPos] = useState(10);

  const state =
    pos < MARKS[0]!.at
      ? {
          title: '引火しません',
          body:
            '液面から出ている蒸気が薄すぎて、燃焼範囲の下限値に届いていません。' +
            '火を近づけても引火しません。',
          tone: 'safe',
        }
      : pos < MARKS[1]!.at
        ? {
            title: '引火します（ただし燃え続けない）',
            body:
              '蒸気の濃さが燃焼範囲の下限値に届きました。火を近づけると引火します。' +
              'ただし燃焼点にはまだ届いていないので、火を離すと消えます。',
            tone: 'warn',
          }
        : pos < MARKS[2]!.at
          ? {
              title: '引火し、燃え続けます',
              body:
                '燃焼点を超えました。いったん引火すると、火を離しても燃焼が続きます。' +
                'ここから先は、液温が上がるほど蒸気が増えて勢いが強くなります。',
              tone: 'warn',
            }
          : {
              title: '火を近づけなくても発火します',
              body:
                '発火点に達しました。点火源がなくても、それ自体が燃え出します。' +
                '高温の配管や排気管に触れるだけで火が出る、というのがこの状態です。',
              tone: 'danger',
            };

  return (
    <div className="widget-body">
      <p className="widget-lead">
        液温のつまみを動かしてください。<strong>引火点・燃焼点・発火点はこの順に並びます。</strong>
        目盛りは順序を見るためのもので、実在の物質の値ではありません。
      </p>

      <label className="widget-slider">
        <span>液温</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="液温"
        />
      </label>

      <ul className="widget-list">
        {MARKS.map((m) => (
          <li key={m.label} className={pos >= m.at ? 'passed' : ''}>
            <strong>{m.label}</strong>
            {pos >= m.at ? '（超えました）' : '（まだです）'} — {m.desc}
          </li>
        ))}
      </ul>

      <p className={`widget-result tone-${state.tone}`}>
        <strong>{state.title}</strong>
        <br />
        {state.body}
      </p>

      <p className="widget-note">
        <strong>引火点は、蒸気の濃さが燃焼範囲の下限値に達する液温です。</strong>
        温度から見るか濃さから見るかの違いで、同じ瞬間を指しています。
        発火点だけは「火を近づけるかどうか」という別の軸の話なので、
        引火点と大小を比べるときに取り違えないでください。
        <strong>同じ物質では、発火点のほうが引火点よりずっと高くなります。</strong>
      </p>
    </div>
  );
}
