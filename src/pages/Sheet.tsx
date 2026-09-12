import { useMemo, useState, type JSX } from 'react';
import { useStore } from '../store';
import { CATEGORIES, categoriesOfField, FIELDS } from '../data/categories';
import { SECTIONS } from '../data/textbook';
import { allDigests, DIGEST_LABEL, type DigestKind } from '../lib/digest';
import { Markdown } from '../lib/markdown';
import { navigate } from '../lib/router';

const KINDS: DigestKind[] = ['recap', 'point', 'pitfall'];

/**
 * 直前チェックシート。教本の各節に埋め込まれている要点だけを抜き出して並べる。
 * 本文を読み直す時間がないときの総復習と、試験直前の見返しに使う。
 */
export function Sheet(): JSX.Element {
  const state = useStore();
  const [kinds, setKinds] = useState<Set<DigestKind>>(new Set(KINDS));
  const [field, setField] = useState<string>('all');
  const [readOnly, setReadOnly] = useState(false);
  const [shakyOnly, setShakyOnly] = useState(false);

  const digests = useMemo(() => allDigests(), []);
  const readSet = useMemo(() => new Set(state.readSections), [state.readSections]);
  const levels = state.understanding ?? {};

  const catField = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of CATEGORIES) m.set(c.id, c.field);
    return m;
  }, []);

  const shown = useMemo(
    () =>
      digests
        .filter((d) => field === 'all' || catField.get(d.categoryId) === field)
        .filter((d) => !readOnly || readSet.has(d.sectionId))
        .filter((d) => !shakyOnly || levels[d.sectionId] === 1)
        .map((d) => ({ ...d, items: d.items.filter((it) => kinds.has(it.kind)) }))
        .filter((d) => d.items.length > 0),
    [digests, field, readOnly, shakyOnly, readSet, levels, kinds, catField],
  );

  const total = shown.reduce((n, d) => n + d.items.length, 0);

  const toggleKind = (k: DigestKind): void => {
    const next = new Set(kinds);
    if (next.has(k) && next.size > 1) next.delete(k);
    else next.add(k);
    setKinds(next);
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>直前チェックシート</h1>
        <p className="lead">
          教本 {SECTIONS.length} 節に埋め込まれている「まとめ」「試験のポイント」「よくある勘違い」だけを抜き出して並べたものです。本文を読み返す時間がないときの総復習と、試験直前の見返しに使ってください。項目をタップすると、その節の本文へ移動します。
        </p>
      </header>

      <section className="section">
        <div className="chips">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={`chip ${kinds.has(k) ? 'on' : ''}`}
              onClick={() => toggleKind(k)}
            >
              {DIGEST_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="chips">
          <button type="button" className={`chip ${field === 'all' ? 'on' : ''}`} onClick={() => setField('all')}>
            全分野
          </button>
          {FIELDS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${field === f.id ? 'on' : ''}`}
              onClick={() => setField(f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
        <div className="chips">
          <button
            type="button"
            className={`chip ${readOnly ? 'on' : ''}`}
            onClick={() => setReadOnly(!readOnly)}
          >
            読了した節だけ
          </button>
          <button
            type="button"
            className={`chip ${shakyOnly ? 'on' : ''}`}
            onClick={() => setShakyOnly(!shakyOnly)}
          >
            もう一度読みたい節だけ
          </button>
        </div>
        <p className="hint">{total} 項目 / {shown.length} 節</p>
      </section>

      {shown.length === 0 && (
        <section className="section">
          <p className="hint">
            条件に合う項目がありません。
            {shakyOnly && '「もう一度読みたい」と記録した節がまだありません。'}
            {readOnly && !shakyOnly && '「読了した節だけ」を外すか、教本を読み進めてください。'}
          </p>
        </section>
      )}

      {FIELDS.filter((f) => field === 'all' || f.id === field).map((f) => {
        const catIds = categoriesOfField(f.id).map((c) => c.id);
        const inField = shown.filter((d) => catIds.includes(d.categoryId));
        if (inField.length === 0) return null;
        return (
          <section key={f.id} className="section">
            <h2>{f.name}</h2>
            {inField.map((d) => (
              <div key={d.sectionId} className="sheet-block">
                <button
                  type="button"
                  className="sheet-title link-btn"
                  onClick={() => navigate(`textbook/${d.sectionId}`)}
                >
                  {readSet.has(d.sectionId) ? '✓ ' : ''}
                  {d.title}
                </button>
                <ul className="sheet-items">
                  {d.items.map((it, i) => (
                    <li key={i} className={`sheet-item k-${it.kind}`}>
                      <span className="sheet-kind">{DIGEST_LABEL[it.kind]}</span>
                      <span className="sheet-text">
                        <Markdown source={it.text} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
