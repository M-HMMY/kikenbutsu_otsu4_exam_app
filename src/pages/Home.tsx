import type { JSX } from 'react';
import { useStore } from '../store';
import { SECTIONS, sectionById, totalMinutes } from '../data/textbook';
import { QUESTIONS } from '../data/questions';
import { navigate } from '../lib/router';
import { dueCards, upcoming } from '../lib/srs';
import { readingProgress, recentAccuracy, streakDays, weakCategories } from '../lib/stats';
import { categoryName } from '../data/categories';
import { DRILLS } from '../data/drills';

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 100)}%`;
}

const DAY_MS = 86400000;

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 試験日（YYYY-MM-DD）までの残り日数。当日は 0、過ぎていれば負数 */
function daysUntil(dateStr: string, now: number): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startOfDay(now)) / DAY_MS);
}

/** 目標に対する達成率（%）。目標が 0 以下（達成済み）なら 100 とする */
function progressPct(done: number, goal: number): number {
  if (goal <= 0) return 100;
  return Math.min(100, Math.round((done / goal) * 100));
}

export function Home(): JSX.Element {
  const state = useStore();
  const read = readingProgress(state, SECTIONS.length);
  const due = dueCards(state.srs).length;
  const recent = recentAccuracy(state.logs, 50);
  const weak = weakCategories(state.logs);
  const streak = streakDays(state.logs);
  const plan = upcoming(state.srs, 7);
  const bookmark = state.bookmark ? sectionById(state.bookmark) : undefined;
  const nextUnread = SECTIONS.find((s) => !state.readSections.includes(s.id));
  // 「もう一度読みたい」と記録した節。演習より先に戻るべき場所
  const shaky = SECTIONS.filter((s) => state.understanding?.[s.id] === 1);

  // 試験日カウントダウンと学習ペース
  const examDate = state.examDate;
  const remainingDays = examDate ? daysUntil(examDate, Date.now()) : null;
  const hasPace = remainingDays !== null && remainingDays > 0;

  const unreadSections = SECTIONS.filter((s) => !state.readSections.includes(s.id)).length;
  const aIds = new Set(QUESTIONS.map((q) => q.id));
  const answeredAIds = new Set(state.logs.filter((l) => aIds.has(l.qid)).map((l) => l.qid));
  const unansweredA = QUESTIONS.length - answeredAIds.size;

  const dailyGoalSections = hasPace ? Math.ceil(unreadSections / remainingDays) : 0;
  const dailyGoalQuestions = hasPace ? Math.ceil(unansweredA / remainingDays) : 0;

  const todayStart = startOfDay(Date.now());
  const sectionsReadToday = Object.values(state.readAt ?? {}).filter((at) => at >= todayStart).length;
  const answeredATodayCount = state.logs.filter((l) => l.at >= todayStart && aIds.has(l.qid)).length;

  return (
    <div className="page">
      <header className="page-head">
        <h1>危険物乙4 学習アプリ</h1>
        <p className="lead">
          教本で体系的に学び、演習と間隔反復で定着させ、模試で仕上げます。学習記録はこのブラウザに保存されます。
        </p>
      </header>

      <section className="cards">
        <div className="card stat">
          <span className="stat-label">教本の読了</span>
          <span className="stat-value">{Math.round(read * 100)}%</span>
          <span className="stat-sub">
            {state.readSections.length} / {SECTIONS.length} セクション（目安 {Math.round(totalMinutes / 60)} 時間）
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">今日の復習</span>
          <span className="stat-value">{due}</span>
          <span className="stat-sub">問が復習期限を迎えています</span>
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
        {examDate && remainingDays !== null && (
          <div className="card stat">
            <span className="stat-label">試験まで</span>
            <span className="stat-value">{remainingDays > 0 ? remainingDays : '—'}</span>
            <span className="stat-sub">
              {remainingDays > 0
                ? '日'
                : remainingDays === 0
                  ? '今日が試験日です'
                  : '試験日は過ぎています'}
            </span>
          </div>
        )}
        {hasPace && (
          <div className="card stat">
            <span className="stat-label">1 日あたりのノルマ（教本）</span>
            <span className="stat-value">{dailyGoalSections}</span>
            <span className="stat-sub">節（未読 {unreadSections} セクション）</span>
          </div>
        )}
        {hasPace && (
          <div className="card stat">
            <span className="stat-label">1 日あたりのノルマ（確認問題）</span>
            <span className="stat-value">{dailyGoalQuestions}</span>
            <span className="stat-sub">問（未解答 {unansweredA} 問）</span>
          </div>
        )}
      </section>

      {examDate && !hasPace && (
        <section className="section">
          <p className="hint">
            {remainingDays === 0
              ? '今日が試験日です。学習ノルマの計算はありません。'
              : '試験日は過ぎています。学習ノルマの計算はありません。'}
          </p>
        </section>
      )}

      {hasPace && (
        <section className="section">
          <h2>今日の進捗</h2>
          <p className="hint">今日解答した確認問題の数と、今日読了した教本セクション数を、1 日のノルマと比べています。</p>
          <div className="cards">
            <div className="card stat">
              <span className="stat-label">教本（今日）</span>
              <span className="stat-value">
                {sectionsReadToday} / {dailyGoalSections}
              </span>
              <span className="stat-sub">節</span>
              <div className="hbar">
                <div className="hbar-fill" style={{ width: `${progressPct(sectionsReadToday, dailyGoalSections)}%` }} />
              </div>
            </div>
            <div className="card stat">
              <span className="stat-label">確認問題（今日）</span>
              <span className="stat-value">
                {answeredATodayCount} / {dailyGoalQuestions}
              </span>
              <span className="stat-sub">問</span>
              <div className="hbar">
                <div
                  className="hbar-fill"
                  style={{ width: `${progressPct(answeredATodayCount, dailyGoalQuestions)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {!examDate && (
        <section className="section">
          <p className="hint">設定画面から試験日を登録すると、1 日あたりの学習ノルマを表示します。</p>
          <button type="button" className="link-btn" onClick={() => navigate('settings')}>
            設定画面を開く
          </button>
        </section>
      )}

      <section className="section">
        <h2>今日やること</h2>
        <div className="action-grid">
          <button type="button" className="action primary" onClick={() => navigate('textbook')}>
            <span className="action-title">教本を読む</span>
            <span className="action-sub">
              {bookmark
                ? `続きから：${bookmark.title}`
                : nextUnread
                  ? `次は「${nextUnread.title}」`
                  : '全セクション読了済み'}
            </span>
          </button>
          <button type="button" className="action" onClick={() => navigate('review')} disabled={due === 0}>
            <span className="action-title">復習する（SRS）</span>
            <span className="action-sub">{due > 0 ? `${due} 問が期限到来` : '期限を迎えた問題はありません'}</span>
          </button>
          <button type="button" className="action" onClick={() => navigate('practice')}>
            <span className="action-title">確認問題</span>
            <span className="action-sub">全 {QUESTIONS.length} 問／章別・ランダム出題</span>
          </button>
          <button type="button" className="action" onClick={() => navigate('drill')}>
            <span className="action-title">計算ドリル</span>
            <span className="action-sub">{DRILLS.length} 種類／毎回数値が変わる自動生成問題</span>
          </button>
          <button type="button" className="action" onClick={() => navigate('mock')}>
            <span className="action-title">模試を受ける</span>
            <span className="action-sub">本番同様の時間制限つき</span>
          </button>
          <button type="button" className="action" onClick={() => navigate('stats')}>
            <span className="action-title">成績を分析する</span>
            <span className="action-sub">章別の正答率と学習履歴</span>
          </button>
        </div>
      </section>

      {shaky.length > 0 && (
        <section className="section">
          <h2>もう一度読みたい節</h2>
          <p className="hint">
            読んだあとに「まだ腹に落ちていない」と記録した節です。演習で点が伸びないときは、まずここに戻るのが近道です。
          </p>
          <ul className="weak-list">
            {shaky.slice(0, 6).map((s) => (
              <li key={s.id}>
                <span className="weak-name">{s.title}</span>
                <span className="weak-count">{categoryName(s.categoryId)}</span>
                <button type="button" className="link-btn" onClick={() => navigate(`textbook/${s.id}`)}>
                  読み直す
                </button>
              </li>
            ))}
          </ul>
          {shaky.length > 6 && <p className="hint">ほか {shaky.length - 6} 節</p>}
        </section>
      )}

      {weak.length > 0 && (
        <section className="section">
          <h2>弱点の章</h2>
          <p className="hint">目標の正答率 90% に届いていない章です。教本に戻ってから演習すると効果的です。</p>
          <ul className="weak-list">
            {weak.map((w) => (
              <li key={w.categoryId}>
                <span className="weak-name">{categoryName(w.categoryId)}</span>
                <span className="weak-rate">{pct(w.rate)}</span>
                <span className="weak-count">
                  （{w.correct}/{w.total} 問）
                </span>
                <button type="button" className="link-btn" onClick={() => navigate(`practice?cat=${w.categoryId}`)}>
                  この章を演習
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {Object.keys(state.srs).length > 0 && (
        <section className="section">
          <h2>今後 7 日間の復習予定</h2>
          <div className="bar-chart">
            {plan.map((n, i) => {
              const max = Math.max(...plan, 1);
              const d = new Date(Date.now() + i * 86400000);
              return (
                <div key={i} className="bar-col">
                  <div className="bar" style={{ height: `${(n / max) * 100}%` }} title={`${n} 問`} />
                  <span className="bar-value">{n}</span>
                  <span className="bar-label">{i === 0 ? '今日' : `${d.getMonth() + 1}/${d.getDate()}`}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="section">
        <h2>試験の概要</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>項目</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>形式</td>
                <td>五肢択一式のマークカード方式。記述も実技もない</td>
              </tr>
              <tr>
                <td>問題数・時間</td>
                <td>35 問を 2 時間。法令 15 問 / 物化 10 問 / 性消 10 問</td>
              </tr>
              <tr>
                <td>実施</td>
                <td>都道府県ごと。全国一斉ではなく、回数も日程も県によって違う</td>
              </tr>
              <tr>
                <td>受験条件</td>
                <td>なし。誰でも受けられる</td>
              </tr>
              <tr>
                <td>受験手数料</td>
                <td>乙種 5,300 円</td>
              </tr>
              <tr>
                <td>科目免除</td>
                <td>乙種の免状を 1 つ持っていれば、他の類では法令と物化が免除（10 問 / 35 分）</td>
              </tr>
              <tr>
                <td>合格基準</td>
                <td>
                  <strong>試験科目ごとに 60 % 以上</strong>。合計点ではない
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="hint">
          <strong>3 科目それぞれで 6 割が必要です。</strong>合計点ではないので、
          いちばん低い科目がそのまま合否を決めます。「法令を捨てて物化で稼ぐ」は成り立ちません。
        </p>
        <p className="hint">
          ※ この表は 2026 年 9 月 13 日時点のものです。試験日程は都道府県ごとに違い、要項も改訂されます。
          申し込みの前に、受験する県の消防試験研究センター支部の案内で確認してください。
        </p>
      </section>
    </div>
  );
}
