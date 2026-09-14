import { useCallback, useMemo, useState, type JSX } from 'react';
import type { Question } from '../types';
import { QUESTIONS, questionsOfCategory, questionsOfSection } from '../data/questions';
import { CATEGORIES, categoryName } from '../data/categories';
import { sectionById } from '../data/textbook';
import { QuestionCard } from '../components/QuestionCard';
import { actions, useStore } from '../store';
import { navigate, useRoute } from '../lib/router';
import { choiceIndexOf, useKeys } from '../lib/useKeys';
import { isCorrectAnswer, toggleChoice } from '../lib/answer';

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Session {
  queue: Question[];
  idx: number;
  /** 選択済みの添字。未選択は空配列（複数選択があるので配列で持つ） */
  selected: number[];
  revealed: boolean;
  correctCount: number;
  /** 誤答した問題（復習用に最後に出す） */
  missed: Question[];
}

export function Practice(): JSX.Element {
  const route = useRoute();
  const state = useStore();
  const [session, setSession] = useState<Session | null>(null);
  const [count, setCount] = useState(10);
  const [onlyWeak, setOnlyWeak] = useState(false);
  const [category, setCategory] = useState<string>(route.query.cat ?? 'all');

  const sectionId = route.query.section;
  const section = sectionId ? sectionById(sectionId) : undefined;

  /** 一度でも誤答した問題 ID（その後正解していても候補に残す） */
  const missedIds = useMemo(() => {
    const set = new Set<string>();
    for (const log of state.logs) if (!log.correct) set.add(log.qid);
    return set;
  }, [state.logs]);

  const pool = useMemo(() => {
    let base: Question[];
    if (section) base = questionsOfSection(section.id);
    else if (category === 'all') base = QUESTIONS;
    else base = questionsOfCategory(category);
    if (onlyWeak) {
      const filtered = base.filter((q) => missedIds.has(q.id));
      return filtered.length > 0 ? filtered : base;
    }
    return base;
  }, [section, category, onlyWeak, missedIds]);

  const start = (questions: Question[]) => {
    if (questions.length === 0) return;
    setSession({ queue: questions, idx: 0, selected: [], revealed: false, correctCount: 0, missed: [] });
  };

  // --- 出題中の操作（キーボードからも呼べるよう早期 return より前に定義する） ---
  const select = useCallback(
    (index: number) => {
      setSession((s) => {
        if (s === null || s.revealed) return s;
        const q = s.queue[s.idx];
        if (!q) return s;
        return { ...s, selected: toggleChoice(q.answer, s.selected, index) };
      });
    },
    [],
  );

  // actions.answer を setSession の更新関数の中で呼んではいけない。
  // 更新関数はレンダリング中に実行されるうえ、StrictMode では 2 回呼ばれるため、
  // 学習記録が二重に登録されて成績分析と復習キューが狂う（実際に起きた）。
  // 記録は更新関数の外で 1 回だけ行う。Review.tsx / Mock.tsx も同じ形。
  const submit = useCallback(() => {
    if (session === null || session.revealed || session.selected.length === 0) return;
    const q = session.queue[session.idx];
    if (!q) return;
    const correct = isCorrectAnswer(q.answer, session.selected);
    actions.answer({ qid: q.id, categoryId: q.categoryId, correct, mode: section ? 'check' : 'practice' });
    setSession({
      ...session,
      revealed: true,
      correctCount: session.correctCount + (correct ? 1 : 0),
      missed: correct ? session.missed : [...session.missed, q],
    });
  }, [session, section]);

  const next = useCallback(() => {
    setSession((s) => (s === null ? s : { ...s, idx: s.idx + 1, selected: [], revealed: false }));
  }, []);

  useKeys(
    useCallback(
      (key: string) => {
        if (session === null || session.idx >= session.queue.length) return;
        const choice = choiceIndexOf(key);
        if (choice !== null) {
          select(choice);
          return;
        }
        if (key === 'Enter') {
          if (session.revealed) next();
          else submit();
        }
      },
      [session, select, submit, next],
    ),
  );

  // ---- 設定画面 ----
  if (!session) {
    const startCount = Math.min(count, pool.length);
    return (
      <div className="page">
        <header className="page-head">
          <h1>確認問題</h1>
          <p className="lead">
            五肢択一の問題を 1 問ずつ解き、その場で解説を確認します。解答内容は自動的に間隔反復の復習キューへ登録されます。
          </p>
        </header>

        {section && (
          <div className="notice">
            教本「{section.title}」の確認問題（{pool.length} 問）を出題します。
            <button type="button" className="link-btn" onClick={() => navigate('practice')}>
              分野を選び直す
            </button>
          </div>
        )}

        {!section && (
          <section className="section">
            <h2>出題する分野</h2>
            <div className="chips">
              <button
                type="button"
                className={`chip ${category === 'all' ? 'on' : ''}`}
                onClick={() => setCategory('all')}
              >
                すべて（{QUESTIONS.length}）
              </button>
              {CATEGORIES.map((c) => {
                const n = questionsOfCategory(c.id).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip ${category === c.id ? 'on' : ''}`}
                    onClick={() => setCategory(c.id)}
                    disabled={n === 0}
                  >
                    {c.name}（{n}）
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="section">
          <h2>出題数</h2>
          <div className="chips">
            {[5, 10, 20, 30].map((n) => (
              <button key={n} type="button" className={`chip ${count === n ? 'on' : ''}`} onClick={() => setCount(n)}>
                {n} 問
              </button>
            ))}
            <button
              type="button"
              className={`chip ${count === 999 ? 'on' : ''}`}
              onClick={() => setCount(999)}
            >
              すべて
            </button>
          </div>
          <label className="check-label">
            <input type="checkbox" checked={onlyWeak} onChange={(e) => setOnlyWeak(e.target.checked)} />
            間違えたことがある問題を優先する
          </label>
        </section>

        <div className="read-actions">
          <button
            type="button"
            className="btn primary"
            disabled={pool.length === 0}
            onClick={() => start(shuffle(pool).slice(0, startCount))}
          >
            {startCount} 問を開始する
          </button>
          <span className="hint">対象 {pool.length} 問</span>
        </div>
      </div>
    );
  }

  // ---- 終了画面 ----
  if (session.idx >= session.queue.length) {
    const rate = Math.round((session.correctCount / session.queue.length) * 100);
    return (
      <div className="page">
        <header className="page-head">
          <h1>演習おつかれさまでした</h1>
        </header>
        <div className="card result-summary">
          <span className="stat-value">
            {session.correctCount} / {session.queue.length}
          </span>
          <span className="stat-sub">正答率 {rate}%</span>
        </div>

        {session.missed.length > 0 && (
          <section className="section">
            <h2>間違えた問題（{session.missed.length}）</h2>
            <ul className="missed-list">
              {session.missed.map((q) => (
                <li key={q.id}>
                  <span className="tag tag-cat">{categoryName(q.categoryId)}</span>
                  <span className="missed-q">{q.question}</span>
                  {q.sectionId && (
                    <button type="button" className="link-btn" onClick={() => navigate(`textbook/${q.sectionId}`)}>
                      教本で復習
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="read-actions">
          {session.missed.length > 0 && (
            <button type="button" className="btn primary" onClick={() => start(shuffle(session.missed))}>
              間違えた問題をもう一度
            </button>
          )}
          <button type="button" className="btn" onClick={() => setSession(null)}>
            別の条件で演習する
          </button>
          <button type="button" className="btn ghost" onClick={() => navigate('home')}>
            ホームへ
          </button>
        </div>
      </div>
    );
  }

  // ---- 出題中 ----
  const q = session.queue[session.idx];

  return (
    <div className="page">
      <div className="progress-line">
        <div className="progress-fill" style={{ width: `${(session.idx / session.queue.length) * 100}%` }} />
      </div>
      <QuestionCard
        q={q}
        selected={session.selected}
        revealed={session.revealed}
        onSelect={select}
        counter={`${session.idx + 1} / ${session.queue.length}`}
        footer={
          session.revealed ? (
            <button type="button" className="btn primary" onClick={next}>
              {session.idx + 1 === session.queue.length ? '結果を見る' : '次の問題へ'}
            </button>
          ) : (
            <button type="button" className="btn primary" disabled={session.selected.length === 0} onClick={submit}>
              解答する
            </button>
          )
        }
      />
      <div className="read-actions">
        <button type="button" className="btn ghost" onClick={() => setSession(null)}>
          中断する
        </button>
        <span className="kbd-hint">
          <kbd>1</kbd>〜<kbd>5</kbd> で選択、<kbd>Enter</kbd> で解答・次へ
        </span>
      </div>
    </div>
  );
}
