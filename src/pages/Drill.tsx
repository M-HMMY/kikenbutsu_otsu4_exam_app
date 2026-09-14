import { useCallback, useMemo, useState, type JSX } from 'react';
import { DRILLS, type Drill as DrillType, type DrillItem } from '../data/drills';
import { ChoiceList, CHOICE_LABELS } from '../components/ChoiceList';
import { categoryName } from '../data/categories';
import { actions, useStore } from '../store';
import { navigate, useRoute } from '../lib/router';
import { choiceIndexOf, useKeys } from '../lib/useKeys';
import { Markdown } from '../lib/markdown';

interface Session {
  /** 出題対象のドリル */
  pool: DrillType[];
  drill: DrillType;
  item: DrillItem;
  selected: number | null;
  revealed: boolean;
  total: number;
  correct: number;
  /** 連続正解数 */
  streak: number;
  bestStreak: number;
}

const drillQid = (id: string): string => `drill:${id}`;

export function Drill(): JSX.Element {
  const state = useStore();
  const route = useRoute();
  // 教本の節から ?type=xxx で来た場合は、その 1 種類だけを選んだ状態で始める
  const [chosen, setChosen] = useState<Set<string>>(() => {
    const wanted = route.query.type;
    if (wanted && DRILLS.some((d) => d.id === wanted)) return new Set([wanted]);
    return new Set(DRILLS.map((d) => d.id));
  });
  const [session, setSession] = useState<Session | null>(null);

  /** ドリル種別ごとの成績（これまでの全期間） */
  const record = useMemo(() => {
    const map = new Map<string, { total: number; correct: number }>();
    for (const log of state.logs) {
      if (!log.qid.startsWith('drill:')) continue;
      const id = log.qid.slice('drill:'.length);
      const e = map.get(id) ?? { total: 0, correct: 0 };
      e.total += 1;
      if (log.correct) e.correct += 1;
      map.set(id, e);
    }
    return map;
  }, [state.logs]);

  const next = useCallback((pool: DrillType[], prev?: Session) => {
    const drill = pool[Math.floor(Math.random() * pool.length)];
    setSession({
      pool,
      drill,
      item: drill.generate(),
      selected: null,
      revealed: false,
      total: prev?.total ?? 0,
      correct: prev?.correct ?? 0,
      streak: prev?.streak ?? 0,
      bestStreak: prev?.bestStreak ?? 0,
    });
  }, []);

  /**
   * 解答する。
   *
   * **`actions.answer` を `setSession` の更新関数の中で呼ばないこと。**
   * 更新関数は React の描画中に走るので、そこでストアを書き換えると
   * 「描画中に別のコンポーネントを更新した」という警告が出る。
   * さらに **StrictMode では更新関数が 2 回走るため、学習記録が二重に入る。**
   * 同じ誤りが姉妹アプリの `Practice.tsx` でも起き、`scripts/drive.mjs` で見つかった。
   * **記録は更新関数の外で、1 回だけ呼ぶ。**
   */
  const submit = useCallback(() => {
    if (session === null || session.revealed || session.selected === null) return;
    const ok = session.selected === session.item.answer;
    actions.answer({
      qid: drillQid(session.drill.id),
      categoryId: session.drill.categoryId,
      correct: ok,
      mode: 'drill',
    });
    const streak = ok ? session.streak + 1 : 0;
    setSession({
      ...session,
      revealed: true,
      total: session.total + 1,
      correct: session.correct + (ok ? 1 : 0),
      streak,
      bestStreak: Math.max(session.bestStreak, streak),
    });
  }, [session]);

  useKeys(
    useCallback(
      (key: string) => {
        if (session === null) return;
        const choice = choiceIndexOf(key);
        if (choice !== null && !session.revealed) {
          setSession((s) => (s === null || s.revealed ? s : { ...s, selected: choice }));
          return;
        }
        if (key === 'Enter') {
          if (session.revealed) next(session.pool, session);
          else submit();
        }
      },
      [session, submit, next],
    ),
  );

  // ---- 設定画面 ----
  if (session === null) {
    const toggle = (id: string) => {
      const s = new Set(chosen);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      setChosen(s);
    };
    const pool = DRILLS.filter((d) => chosen.has(d.id));

    return (
      <div className="page">
        <header className="page-head">
          <h1>計算ドリル</h1>
          <p className="lead">
            出題のたびに数値が変わる自動生成問題です。同じ問題を暗記するのではなく、計算の手順そのものを身に付けるための練習で、何問でも続けられます。計算問題を確実に取れるかどうかが、得点率を大きく左右します。
          </p>
        </header>

        <div className="chips">
          <button type="button" className="chip" onClick={() => setChosen(new Set(DRILLS.map((d) => d.id)))}>
            すべて選ぶ
          </button>
          <button type="button" className="chip" onClick={() => setChosen(new Set())}>
            すべて外す
          </button>
        </div>

        <section className="section">
          <h2>出題する種類（{chosen.size} / {DRILLS.length}）</h2>
          {DRILLS.length === 0 && (
            <p className="hint">
              計算ドリルはまだ 1 つも用意されていません。<code>src/data/drills.ts</code> に追加すると、この画面に並びます。
            </p>
          )}
          <ul className="drill-list">
            {DRILLS.map((d) => {
              const r = record.get(d.id);
              const rate = r && r.total > 0 ? Math.round((r.correct / r.total) * 100) : null;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    className={`drill-item ${chosen.has(d.id) ? 'on' : ''}`}
                    onClick={() => toggle(d.id)}
                    aria-pressed={chosen.has(d.id)}
                  >
                    <span className={`check ${chosen.has(d.id) ? 'done' : ''}`}>{chosen.has(d.id) ? '✓' : ''}</span>
                    <span className="drill-text">
                      <span className="drill-name">{d.name}</span>
                      <span className="drill-summary">{d.summary}</span>
                    </span>
                    <span className="drill-record">
                      {rate === null ? (
                        <span className="drill-untried">未挑戦</span>
                      ) : (
                        <>
                          <span className={`drill-rate ${rate < 80 ? 'low' : ''}`}>{rate}%</span>
                          <span className="drill-count">{r!.total} 問</span>
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="read-actions">
          <button type="button" className="btn primary" disabled={pool.length === 0} onClick={() => next(pool)}>
            ドリルを始める
          </button>
          <span className="hint">選択中 {pool.length} 種類</span>
        </div>
      </div>
    );
  }

  // ---- 出題中 ----
  const { drill, item } = session;
  const isCorrect = session.selected === item.answer;

  return (
    <div className="page">
      <div className="drill-bar">
        <span className="drill-bar-name">{drill.name}</span>
        <span className="drill-bar-stat">
          {session.correct} / {session.total} 問正解
          {session.total > 0 && `（${Math.round((session.correct / session.total) * 100)}%）`}
        </span>
        <span className={`drill-streak ${session.streak >= 5 ? 'hot' : ''}`}>{session.streak} 連続</span>
        <button type="button" className="btn small ghost" onClick={() => setSession(null)}>
          終了
        </button>
      </div>

      <article className="qcard">
        <header className="qcard-head">
          <div className="qcard-tags">
            <span className="tag">計算ドリル</span>
            <span className="tag tag-cat">{categoryName(drill.categoryId)}</span>
          </div>
          <span className="counter">{session.total + (session.revealed ? 0 : 1)} 問目</span>
        </header>

        <p className="qbody">{item.question}</p>

        {/* ドリルは常に単一選択。ChoiceList は複数選択にも使うので、配列にして渡す */}
        <ChoiceList
          choices={item.choices}
          selected={session.selected === null ? [] : [session.selected]}
          answer={[item.answer]}
          revealed={session.revealed}
          onSelect={(i) => setSession((s) => (s === null || s.revealed ? s : { ...s, selected: i }))}
        />

        {session.revealed && (
          <div className={`result ${isCorrect ? 'ok' : 'ng'}`}>
            <p className="verdict">
              {isCorrect ? '正解' : '不正解'}　正解は {CHOICE_LABELS[item.answer]}
            </p>
            <div className="explanation">
              <Markdown source={item.explanation} />
            </div>
            <button type="button" className="link-btn" onClick={() => navigate(`textbook/${drill.sectionId}`)}>
              教本で手順を確認する
            </button>
          </div>
        )}

        <div className="qcard-footer">
          {session.revealed ? (
            <button type="button" className="btn primary" onClick={() => next(session.pool, session)}>
              次の問題へ（新しい数値）
            </button>
          ) : (
            <button type="button" className="btn primary" disabled={session.selected === null} onClick={submit}>
              解答する
            </button>
          )}
          <span className="kbd-hint">
            <kbd>1</kbd>〜<kbd>5</kbd> で選択、<kbd>Enter</kbd> で解答・次へ
          </span>
        </div>
      </article>

      {session.bestStreak >= 5 && (
        <p className="hint">このセッションの最高連続正解は {session.bestStreak} 問です。</p>
      )}
    </div>
  );
}
