import type { JSX } from 'react';

export const CHOICE_LABELS = ['ア', 'イ', 'ウ', 'エ', 'オ'];

interface Props {
  choices: readonly string[];
  /** 選択済みの添字。未選択は空配列（単一選択でも配列で持つ） */
  selected: readonly number[];
  /** 正解の添字。正誤を伏せる場合は null */
  answer: readonly number[] | null;
  /** 解答が確定して正誤を表示している状態か */
  revealed: boolean;
  /** 複数選択の問題か。押したときの挙動は呼び出し側が決めるので、ここでは見た目だけに使う */
  multi?: boolean;
  onSelect: (index: number) => void;
}

export function ChoiceList({
  choices,
  selected,
  answer,
  revealed,
  multi = false,
  onSelect,
}: Props): JSX.Element {
  const picked = new Set(selected);
  const right = answer === null ? null : new Set(answer);

  return (
    <ul className={`choices${multi ? ' choices-multi' : ''}`}>
      {choices.map((c, i) => {
        const classes = ['choice'];
        if (picked.has(i)) classes.push('selected');
        if (revealed && right !== null) {
          if (right.has(i)) classes.push('correct');
          else if (picked.has(i)) classes.push('wrong');
        }
        return (
          <li key={i}>
            <button
              type="button"
              className={classes.join(' ')}
              onClick={() => onSelect(i)}
              disabled={revealed}
              // 複数選択は入り切りするので、押しボタンではなくチェックボックスとして読ませる
              role={multi ? 'checkbox' : undefined}
              aria-checked={multi ? picked.has(i) : undefined}
              aria-pressed={multi ? undefined : picked.has(i)}
            >
              <span className="choice-label">{CHOICE_LABELS[i]}</span>
              <span className="choice-text">{c}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
