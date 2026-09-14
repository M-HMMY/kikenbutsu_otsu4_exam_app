import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { JSX } from 'react';
import { actions, useStore } from '../store';
import { exportState, importState } from '../lib/storage';
import { SECTIONS } from '../data/textbook';
import { QUESTIONS } from '../data/questions';

type ImportStatus = { kind: 'ok' | 'error'; message: string } | null;

/** ホーム画面に追加して単体のアプリとして起動しているか */
function isStandalone(): boolean {
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

/** スマートフォンへの追加手順 */
function InstallGuide(): JSX.Element {
  const standalone = isStandalone();
  const offlineReady = 'serviceWorker' in navigator && window.isSecureContext;

  return (
    <section className="section">
      <h2>スマートフォンで使う</h2>
      {standalone ? (
        <p className="hint">
          ホーム画面のアプリとして起動しています。
          {offlineReady
            ? '一度開いたページは端末に保存されるので、電波がなくても学習を続けられます。'
            : 'この配信方法ではオフライン保存が有効になりません（HTTPS で配信すると有効になります）。'}
        </p>
      ) : (
        <>
          <p className="hint">
            iPhone / iPad では、Safari で開いてホーム画面に追加すると、アドレスバーのないアプリとして起動できます。
          </p>
          <ol className="install-steps">
            <li>
              <strong>Safari</strong> でこのページを開く（Chrome など他のブラウザからは追加できません）
            </li>
            <li>
              画面下部の <strong>共有ボタン</strong>（□に↑のマーク）をタップ
            </li>
            <li>
              メニューを下にたどって <strong>「ホーム画面に追加」</strong> をタップ
            </li>
            <li>右上の「追加」をタップすると、ホーム画面にアイコンが並びます</li>
          </ol>
          <p className="hint">
            Android では Chrome のメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。
          </p>
        </>
      )}
      <p className="hint">
        学習記録は端末ごとに保存されるため、パソコンとスマートフォンでは共有されません。下のエクスポートとインポートで移せます。
      </p>
    </section>
  );
}

export function Settings(): JSX.Element {
  const state = useStore();
  const json = useMemo(() => exportState(state), [state]);
  const exportRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState('');
  const [importStatus, setImportStatus] = useState<ImportStatus>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);


  function selectExport(): void {
    const el = exportRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }

  function copy(): void {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(
        () => setCopied(true),
        () => selectExport(),
      );
    } else {
      selectExport();
    }
  }

  function runImport(): void {
    const next = importState(draft);
    if (next) {
      actions.replace(next);
      setDraft('');
      setImportStatus({ kind: 'ok', message: '取り込みました' });
    } else {
      setImportStatus({ kind: 'error', message: 'JSON を解釈できませんでした' });
    }
  }

  function saveToFile(): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url;
    a.download = `kikenbutsu-otsu4-exam-app-${y}${m}${d}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function loadFromFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const next = importState(text);
      if (next) {
        actions.replace(next);
        setImportStatus({ kind: 'ok', message: '取り込みました' });
      } else {
        setImportStatus({ kind: 'error', message: 'JSON を解釈できませんでした' });
      }
    } catch {
      setImportStatus({ kind: 'error', message: 'JSON を解釈できませんでした' });
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>設定とデータ</h1>
        <p className="lead">学習記録の書き出し・取り込みと、収録コンテンツの内訳を確認できます。</p>
      </header>

      <section className="section">
        <h2>試験日</h2>
        <p className="hint">試験日を登録すると、ホーム画面に残り日数と 1 日あたりの学習ノルマが表示されます。</p>
        <p>
          <input
            type="date"
            value={state.examDate ?? ''}
            onChange={(e) => actions.setExamDate(e.target.value || undefined)}
          />
          {state.examDate && (
            <button
              type="button"
              className="btn small"
              style={{ marginLeft: 10 }}
              onClick={() => actions.setExamDate(undefined)}
            >
              クリア
            </button>
          )}
        </p>
      </section>

      <section className="section">
        <h2>表示テーマ</h2>
        <p className="hint">端末の設定に合わせる「自動」のほか、ライト・ダークを固定できます。</p>
        <div className="chips">
          {(
            [
              { value: 'light', label: 'ライト' },
              { value: 'dark', label: 'ダーク' },
              { value: 'auto', label: '自動' },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              className={`chip ${(state.theme ?? 'auto') === t.value ? 'on' : ''}`}
              onClick={() => actions.setTheme(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>学習記録の保存場所</h2>
        <p className="hint">
          読了状況・解答履歴・復習カード・模試の結果は、すべてこのブラウザの localStorage
          に保存されます。サーバには一切送信されません。そのため、別のブラウザや別の端末、シークレットウィンドウでは記録が引き継がれません。ブラウザの閲覧データを消去すると学習記録も失われます。端末を移すときは、下のエクスポートとインポートを使ってください。
        </p>
      </section>

      <InstallGuide />

      <section className="section">
        <h2>エクスポート</h2>
        <p className="hint">下の JSON をコピーして保存しておけば、別の環境で取り込めます。</p>
        <textarea ref={exportRef} readOnly value={json} rows={10} spellCheck={false} />
        <p>
          <button type="button" className="btn" onClick={copy}>
            クリップボードにコピー
          </button>
          <button type="button" className="btn" onClick={saveToFile}>
            ファイルに保存
          </button>
          {copied && <span className="hint">コピーしました</span>}
        </p>
      </section>

      <section className="section">
        <h2>インポート</h2>
        <p className="hint">
          エクスポートした JSON を貼り付けて取り込みます。現在の学習記録は上書きされるので注意してください。
        </p>
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setImportStatus(null);
          }}
          rows={8}
          spellCheck={false}
          placeholder="ここに JSON を貼り付けてください"
        />
        <p>
          <button type="button" className="btn" onClick={runImport} disabled={draft.trim() === ''}>
            取り込む
          </button>
          <label className="btn">
            ファイルを選択
            <input
              type="file"
              accept="application/json,.json"
              onChange={loadFromFile}
              style={{ display: 'none' }}
            />
          </label>
          {importStatus && <span className="hint">{importStatus.message}</span>}
        </p>
      </section>

      <section className="section">
        <h2>学習記録の全消去</h2>
        <p className="hint">読了状況・解答履歴・復習カード・模試の結果をすべて削除します。元に戻せません。</p>
        {confirming ? (
          <p>
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                actions.resetAll();
                setConfirming(false);
              }}
            >
              本当に削除する
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              キャンセル
            </button>
          </p>
        ) : (
          <p>
            <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
              学習記録をすべて削除
            </button>
          </p>
        )}
      </section>

      <section className="section">
        <h2>収録コンテンツの内訳</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>区分</th>
                <th>収録数</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>教本セクション</td>
                <td>{SECTIONS.length} セクション</td>
              </tr>
              <tr>
                <td>確認問題</td>
                <td>{QUESTIONS.length} 問</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
