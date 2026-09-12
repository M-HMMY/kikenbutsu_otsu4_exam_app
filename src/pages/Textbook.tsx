import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { useStore, actions } from '../store';
import type { Understanding } from '../types';
import { SECTIONS, sectionById, sectionsOfCategory, totalMinutes } from '../data/textbook';
import { CATEGORIES, FIELDS, GLOSSARY_SECTION_ID, categoriesOfField, categoryName } from '../data/categories';
import { questionsOfSection } from '../data/questions';
import { Markdown } from '../lib/markdown';
import { navigate, useRoute } from '../lib/router';
import { countMatchingQuestions, searchSections } from '../lib/search';
import { useKeys } from '../lib/useKeys';

/** 検索結果の一覧 */
function SearchResults({ query }: { query: string }): JSX.Element {
  const hits = useMemo(() => searchSections(query), [query]);
  const questionCount = useMemo(() => countMatchingQuestions(query), [query]);

  if (hits.length === 0) {
    return (
      <section className="section">
        <p className="hint">
          「{query}」に一致する教本のセクションはありませんでした。
          {questionCount > 0 && `（問題文には ${questionCount} 件の一致があります）`}
        </p>
      </section>
    );
  }

  return (
    <section className="section">
      <h2>
        検索結果 {hits.length} 件
        {questionCount > 0 && <span className="hint-inline">　問題文にも {questionCount} 件</span>}
      </h2>
      <ul className="toc search-results">
        {hits.map((h) => (
          <li key={h.sectionId}>
            <button type="button" className="toc-item" onClick={() => navigate(`textbook/${h.sectionId}`)}>
              <span className="toc-text">
                <span className="toc-title">
                  {h.title}
                  <span className="tag tag-cat">{categoryName(h.categoryId)}</span>
                </span>
                {h.snippet ? (
                  <span className="toc-goal">
                    {h.snippet.before}
                    <mark>{h.snippet.hit}</mark>
                    {h.snippet.after}
                  </span>
                ) : (
                  <span className="toc-goal">見出し・ねらいに一致</span>
                )}
              </span>
              <span className="toc-min">{h.count > 0 ? `${h.count} 箇所` : '見出し'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 節を読んだあとに記録する手応え。ホームと直前チェックの絞り込みに使う */
const UNDERSTANDING_LEVELS: { level: Understanding; label: string; note: string }[] = [
  { level: 1, label: 'もう一度読みたい', note: 'まだ腹に落ちていない' },
  { level: 2, label: 'だいたい分かった', note: '問題を解けば固まりそう' },
  { level: 3, label: 'だいじょうぶ', note: '人に説明できる' },
];

/** 教本の目次 */
function Toc(): JSX.Element {
  const state = useStore();
  const [query, setQuery] = useState('');
  const readSet = new Set(state.readSections);
  const levels = state.understanding ?? {};
  const searching = query.trim().length > 0;

  return (
    <div className="page">
      <header className="page-head">
        <h1>教本</h1>
        <p className="lead">
          全 {SECTIONS.length} セクション（目安 {Math.round(totalMinutes / 60)}{' '}
          時間）。冒頭の「入門編」で試験の形・AI の全体像・数式の読み方をそろえてから、技術分野・法律・倫理分野の順に読み進める構成です。上から順に読めば試験範囲を一通りカバーできます。
        </p>
      </header>

      <div className="search-box">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="用語で探す（例：勾配消失、Attention、交差エントロピー）"
          aria-label="教本を検索"
        />
        {searching && (
          <button type="button" className="btn small ghost" onClick={() => setQuery('')}>
            クリア
          </button>
        )}
      </div>

      {searching && <SearchResults query={query} />}

      {!searching && state.readSections.length === 0 && (
        <button type="button" className="resume" onClick={() => navigate('textbook/i-1')}>
          <span className="resume-label">はじめての方はここから</span>
          <span className="resume-title">入門編：この試験はどんな試験か</span>
        </button>
      )}

      {!searching && state.bookmark && sectionById(state.bookmark) && (
        <button type="button" className="resume" onClick={() => navigate(`textbook/${state.bookmark}`)}>
          <span className="resume-label">前回の続きから</span>
          <span className="resume-title">{sectionById(state.bookmark)!.title}</span>
        </button>
      )}

      {!searching &&
        FIELDS.map((field) => (
        <section key={field.id} className="section">
          <h2>{field.name}</h2>
          <p className="hint">{field.note}</p>
          {categoriesOfField(field.id).map((cat) => {
            const sections = sectionsOfCategory(cat.id);
            const readCount = sections.filter((s) => readSet.has(s.id)).length;
            return (
              <div key={cat.id} className="chapter">
                <div className="chapter-head">
                  <h3>{cat.name}</h3>
                  <span className="chapter-progress">
                    {readCount} / {sections.length}
                  </span>
                </div>
                <p className="chapter-summary">{cat.summary}</p>
                <div className="chapter-intro">
                  <Markdown source={cat.intro} />
                </div>
                {sections.length === 0 && <p className="hint">この章はこれから執筆します。</p>}
                <ul className="toc">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="toc-item" onClick={() => navigate(`textbook/${s.id}`)}>
                        <span
                          className={`check ${readSet.has(s.id) ? 'done' : ''} ${levels[s.id] === 1 ? 'shaky' : ''}`}
                          title={levels[s.id] === 1 ? 'もう一度読みたい' : undefined}
                        >
                          {levels[s.id] === 1 ? '△' : readSet.has(s.id) ? '✓' : ''}
                        </span>
                        <span className="toc-text">
                          <span className="toc-title">{s.title}</span>
                          <span className="toc-goal">{s.goal}</span>
                        </span>
                        <span className="toc-min">{s.minutes} 分</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
        ))}
    </div>
  );
}

/** 教本の本文 */
function SectionView({ id }: { id: string }): JSX.Element {
  const state = useStore();
  const section = sectionById(id);
  const index = SECTIONS.findIndex((s) => s.id === id);
  const prev = index > 0 ? SECTIONS[index - 1] : undefined;
  const next = index >= 0 && index < SECTIONS.length - 1 ? SECTIONS[index + 1] : undefined;
  const checks = section ? questionsOfSection(section.id) : [];

  useEffect(() => {
    if (section) actions.setBookmark(section.id);
  }, [section]);

  // ← → で前後の節へ移動する
  useKeys(
    useCallback(
      (key: string) => {
        if (key === 'ArrowLeft' && prev) navigate(`textbook/${prev.id}`);
        if (key === 'ArrowRight' && next) navigate(`textbook/${next.id}`);
      },
      [prev, next],
    ),
  );

  if (!section) {
    return (
      <div className="page">
        <p>セクションが見つかりませんでした。</p>
        <button type="button" className="btn" onClick={() => navigate('textbook')}>
          目次へ戻る
        </button>
      </div>
    );
  }

  const isRead = state.readSections.includes(section.id);
  const level = state.understanding?.[section.id];
  const category = CATEGORIES.find((c) => c.id === section.categoryId);

  return (
    <div className="page reading">
      <nav className="crumbs">
        <button type="button" className="link-btn" onClick={() => navigate('textbook')}>
          教本
        </button>
        <span className="crumb-sep">›</span>
        <span>{category?.name}</span>
      </nav>

      <header className="page-head">
        <h1>{section.title}</h1>
        <p className="goal">この節のねらい：{section.goal}</p>
        <p className="hint">目安 {section.minutes} 分</p>
      </header>

      <article className="reading-body">
        <Markdown source={section.body} />
      </article>

      {section.id !== GLOSSARY_SECTION_ID && (
        <p className="hint glossary-link">
          知らない言葉が出てきたら{' '}
          <button type="button" className="link-btn" onClick={() => navigate(`textbook/${GLOSSARY_SECTION_ID}`)}>
            用語ミニ辞典
          </button>
          {' '}で引けます。
        </p>
      )}

      <div className="understanding">
        <p className="understanding-q">読み終えたら、いまの手応えを選んでください</p>
        <div className="understanding-btns">
          {UNDERSTANDING_LEVELS.map((u) => (
            <button
              key={u.level}
              type="button"
              className={`btn u-btn ${level === u.level ? 'primary' : ''}`}
              onClick={() => actions.setUnderstanding(section.id, u.level)}
            >
              <span className="u-label">{u.label}</span>
              <span className="u-note">{u.note}</span>
            </button>
          ))}
        </div>
        <p className="hint">
          「もう一度読みたい」を選んだ節は、ホームと直前チェックで優先的に表示されます。
        </p>
      </div>

      <div className="read-actions">
        {isRead && (
          <button type="button" className="btn ghost" onClick={() => actions.markRead(section.id, false)}>
            読了を取り消す
          </button>
        )}
        {!isRead && (
          <button type="button" className="btn" onClick={() => actions.markRead(section.id, true)}>
            手応えは選ばず読了にする
          </button>
        )}
        {checks.length > 0 && (
          <button type="button" className="btn" onClick={() => navigate(`practice?section=${section.id}`)}>
            確認問題を解く（{checks.length} 問）
          </button>
        )}
      </div>

      <nav className="pager">
        {prev ? (
          <button type="button" className="pager-btn" onClick={() => navigate(`textbook/${prev.id}`)}>
            <span className="pager-dir">← 前の節</span>
            <span className="pager-title">{prev.title}</span>
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button type="button" className="pager-btn right" onClick={() => navigate(`textbook/${next.id}`)}>
            <span className="pager-dir">次の節 →</span>
            <span className="pager-title">{next.title}</span>
          </button>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}

export function Textbook(): JSX.Element {
  const route = useRoute();
  const id = route.params[0];
  return id ? <SectionView id={id} /> : <Toc />;
}
