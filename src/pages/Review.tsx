import { useCallback, useMemo, useState, type JSX } from 'react';
import { questionById } from '../data/questions';
import { QuestionCard } from '../components/QuestionCard';
import { actions, useStore } from '../store';
import { dueCards, GRADE_LABEL, type Grade } from '../lib/srs';
import { navigate } from '../lib/router';
import { choiceIndexOf, useKeys } from '../lib/useKeys';
import { isCorrectAnswer, toggleChoice } from '../lib/answer';

/** SRS カードの qid から出題内容を解決する */
interface Item {
  qid: string;
  categoryId: string;
  question: NonNullable<ReturnType<typeof questionById>>;
}

function resolve(qid: string, categoryId: string): Item | null {
  const q = questionById(qid);
  if (!q) return null;
  return { qid, categoryId, question: q };
}

export function Review(): JSX.Element {
  const state = useStore();
  const [idx, setIdx] = useState(0);
  // 未選択は空配列。複数選択の問題があるので、単一選択でも配列で持つ
  const [selected, setSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState({ total: 0, correct: 0 });

  /** セッション開始時点の期限到来カードを固定して使う */
  const queue = useMemo(() => {
    return dueCards(state.srs)
      .map((c) => resolve(c.qid, c.categoryId))
      .filter((item): item is Item => item !== null);
    // マウント時の 1 回だけ確定させる（解答するたびに並びが変わるのを防ぐ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 手応えを記録して次の問題へ進む */
  const applyGrade = useCallback(
    (g: Grade) => {
      const item = queue[idx];
      if (!item) return;
      const correct = isCorrectAnswer(item.question.answer, selected);
      actions.answer({ qid: item.qid, categoryId: item.categoryId, correct, mode: 'review', grade: g });
      setDone((d) => ({ total: d.total + 1, correct: d.correct + (correct ? 1 : 0) }));
      setIdx((i) => i + 1);
      setSelected([]);
      setRevealed(false);
    },
    [queue, idx, selected],
  );

  // 1〜4 で選択／手応えの指定、Enter で解答・標準の手応え
  useKeys(
    useCallback(
      (key: string) => {
        const item = queue[idx];
        if (!item) return;
        if (!revealed) {
          const choice = choiceIndexOf(key);
          if (choice !== null) {
            setSelected((prev) => toggleChoice(item.question.answer, prev, choice));
            return;
          }
          if (key === 'Enter' && selected.length > 0) setRevealed(true);
          return;
        }
        const isCorrect = isCorrectAnswer(item.question.answer, selected);
        const grades: Grade[] = isCorrect ? ['again', 'hard', 'good', 'easy'] : ['again'];
        if (key === 'Enter') {
          applyGrade(isCorrect ? 'good' : 'again');
          return;
        }
        const picked = choiceIndexOf(key, grades.length);
        if (picked !== null) applyGrade(grades[picked]);
      },
      [queue, idx, revealed, selected, applyGrade],
    ),
  );

  if (queue.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>復習</h1>
          <p className="lead">
            期限を迎えた問題はありません。演習で解いた問題は、忘却曲線に沿って自動的にここへ戻ってきます。
          </p>
        </header>
        <div className="read-actions">
          <button type="button" className="btn primary" onClick={() => navigate('practice')}>
            確認問題を解く
          </button>
          <button type="button" className="btn" onClick={() => navigate('textbook')}>
            教本を読む
          </button>
        </div>
      </div>
    );
  }

  if (idx >= queue.length) {
    return (
      <div className="page">
        <header className="page-head">
          <h1>復習おつかれさまでした</h1>
        </header>
        <div className="card result-summary">
          <span className="stat-value">
            {done.correct} / {done.total}
          </span>
          <span className="stat-sub">今回の復習の正解数</span>
        </div>
        <p className="hint">
          手応えに応じて次回の出題日が決まります。「もう一度」を選んだ問題は 10 分後に再び出題されます。
        </p>
        <div className="read-actions">
          <button type="button" className="btn primary" onClick={() => navigate('home')}>
            ホームへ
          </button>
        </div>
      </div>
    );
  }

  const item = queue[idx];
  const isCorrect = isCorrectAnswer(item.question.answer, selected);

  const footer = revealed ? (
    <div className="grade-row">
      <span className="grade-hint">
        {isCorrect ? '次に出題する間隔を選んでください' : '不正解のため 10 分後に再出題します'}
      </span>
      <div className="grade-buttons">
        {(isCorrect ? (['again', 'hard', 'good', 'easy'] as Grade[]) : (['again'] as Grade[])).map((g, i) => (
          <button key={g} type="button" className={`btn grade grade-${g}`} onClick={() => applyGrade(g)}>
            {GRADE_LABEL[g]}
            <span className="kbd-inline">{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  ) : (
    <button type="button" className="btn primary" disabled={selected.length === 0} onClick={() => setRevealed(true)}>
      解答する
    </button>
  );

  return (
    <div className="page">
      <div className="progress-line">
        <div className="progress-fill" style={{ width: `${(idx / queue.length) * 100}%` }} />
      </div>
      <QuestionCard
        q={item.question}
        selected={selected}
        revealed={revealed}
        onSelect={(i) => setSelected((prev) => toggleChoice(item.question.answer, prev, i))}
        counter={`${idx + 1} / ${queue.length}`}
        footer={footer}
      />
    </div>
  );
}
