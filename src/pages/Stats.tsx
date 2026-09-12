import type { JSX } from 'react';
import { useStore } from '../store';
import { SECTIONS } from '../data/textbook';
import { QUESTIONS } from '../data/questions';
import { navigate } from '../lib/router';
import {
  TARGET_RATE,
  dailyCounts,
  readingProgress,
  recentAccuracy,
  statsByCategory,
  streakDays,
  untouchedByCategory,
} from '../lib/stats';
import { FIELDS, categoriesOfField } from '../data/categories';

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}

/** 秒を「n分n秒」に整形する */
function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒`;
}

function dateTime(at: number): string {
  const d = new Date(at);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** SRS の qid から問題の表示名を得る */
function questionLabel(qid: string): string {
  return QUESTIONS.find((q) => q.id === qid)?.question ?? qid;
}

export function Stats(): JSX.Element {
  const state = useStore();
  const total = state.logs.length;
  const correct = state.logs.filter((l) => l.correct).length;
  const overall = total ? correct / total : null;
  const recent = recentAccuracy(state.logs, 50);
  const streak = streakDays(state.logs);
  const read = readingProgress(state, SECTIONS.length);
  const catStats = statsByCategory(state.logs);
  const untouched = untouchedByCategory(state.logs, QUESTIONS);
  const days = dailyCounts(state.logs, 14);
  const maxCount = Math.max(...days.map((d) => d.count), 1);
  const mocks = [...state.mocks].sort((a, b) => b.at - a.at);
  const lapsed = Object.values(state.srs)
    .filter((c) => c.lapses >= 1)
    .sort((a, b) => b.lapses - a.lapses)
    .slice(0, 10);

  return (
    <div className="page">
      <header className="page-head">
        <h1>成績</h1>
        <p className="lead">
          これまでの解答をもとに、科目別の正答率・学習の継続状況・模試の結果をまとめています。3 科目それぞれで 6 割が要るので、いちばん低い科目から手を付けるのが近道です。
        </p>
      </header>

      <section className="cards">
        <div className="card stat">
          <span className="stat-label">総解答数</span>
          <span className="stat-value">{total}</span>
          <span className="stat-sub">問</span>
        </div>
        <div className="card stat">
          <span className="stat-label">全体の正答率</span>
          <span className="stat-value">{pct(overall)}</span>
          <span className="stat-sub">
            {correct} / {total} 問正解
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">直近 50 問の正答率</span>
          <span className="stat-value">{pct(recent.rate)}</span>
          <span className="stat-sub">
            {recent.correct} / {recent.total} 問正解
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">連続学習</span>
          <span className="stat-value">{streak}</span>
          <span className="stat-sub">日</span>
        </div>
        <div className="card stat">
          <span className="stat-label">教本の読了</span>
          <span className="stat-value">{Math.round(read * 100)}%</span>
          <span className="stat-sub">
            {state.readSections.length} / {SECTIONS.length} セクション
          </span>
        </div>
      </section>

      <section className="section">
        <h2>科目別の正答率</h2>
        <p className="hint">
          目標の正答率 {Math.round(TARGET_RATE * 100)}% に届いていない章を強調しています。「未解答」はまだ一度も解いていない問題数で、ここが残っているうちは正答率が安定しません。
          <strong>合格には 3 科目それぞれで 60 % 以上が必要です。</strong>合計点ではないので、
          いちばん低い科目がそのまま合否を決めます。ここに出るのは学習記録から数えた正答率で、
          本番の合否を予想するものではありません。
        </p>
        {FIELDS.filter((field) =>
          categoriesOfField(field.id).some((c) => QUESTIONS.some((q) => q.categoryId === c.id)),
        ).map((field) => {
          // 科目ごとに 6 割という基準は公表されている。ただしここは学習記録の集計なので、
          // 判定ではなく「いちばん低い科目がどれか」を見るために出す
          const inField = catStats.filter((x) => categoriesOfField(field.id).some((c) => c.id === x.categoryId));
          const total = inField.reduce((n, x) => n + x.total, 0);
          const correct = inField.reduce((n, x) => n + Math.round((x.rate ?? 0) * x.total), 0);
          const fieldRate = total > 0 ? correct / total : null;
          return (
          <div key={field.id}>
            <h3>
              {field.name}
              {fieldRate !== null && (
                <span className={`tag ${fieldRate < TARGET_RATE ? 'tag-danger' : 'tag-cat'}`}>
                  分野計 {pct(fieldRate)}
                </span>
              )}
            </h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>章</th>
                    <th>解答数</th>
                    <th>未解答</th>
                    <th>正答率</th>
                    <th>達成度</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {categoriesOfField(field.id).map((c) => {
                    const s = catStats.find((x) => x.categoryId === c.id);
                    const rate = s?.rate ?? null;
                    const low = rate !== null && rate < TARGET_RATE;
                    return (
                      <tr key={c.id} className={low ? 'low' : undefined}>
                        <td>{c.name}</td>
                        <td>{s?.total ?? 0} 問</td>
                        <td>{untouched.get(c.id) ?? 0} 問</td>
                        <td>{pct(rate)}</td>
                        <td>
                          {rate === null ? (
                            '—'
                          ) : (
                            <div className="hbar">
                              <div className="hbar-fill" style={{ width: `${rate * 100}%` }} />
                            </div>
                          )}
                        </td>
                        <td>
                          <button type="button" className="link-btn" onClick={() => navigate(`practice?cat=${c.id}`)}>
                            演習する
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          );
        })}
      </section>

      <section className="section">
        <h2>学習履歴（直近 14 日）</h2>
        <div className="bar-chart">
          {days.map((d) => (
            <div key={d.label} className="bar-col">
              <div className="bar" style={{ height: `${(d.count / maxCount) * 100}%` }} title={`${d.count} 問`} />
              <span className="bar-value">{d.count}</span>
              <span className="bar-label">{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>模試の履歴</h2>
        {mocks.length === 0 ? (
          <p className="hint">まだ模試の記録がありません。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>出題数</th>
                  <th>得点</th>
                  <th>正答率</th>
                  <th>所要時間</th>
                </tr>
              </thead>
              <tbody>
                {mocks.map((m) => (
                  <tr key={m.id}>
                    <td>{dateTime(m.at)}</td>
                    <td>{m.preset}</td>
                    <td>
                      {m.correct} / {m.total}
                    </td>
                    <td>{pct(m.total ? m.correct / m.total : null)}</td>
                    <td>{duration(m.elapsed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>間違えやすい問題</h2>
        {lapsed.length === 0 ? (
          <p className="hint">誤答が記録された問題はまだありません。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>問題</th>
                  <th>誤答回数</th>
                </tr>
              </thead>
              <tbody>
                {lapsed.map((c) => (
                  <tr key={c.qid}>
                    <td>{questionLabel(c.qid)}</td>
                    <td>{c.lapses} 回</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
