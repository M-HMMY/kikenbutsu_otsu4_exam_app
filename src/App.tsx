import { useEffect, useState, type JSX } from 'react';
import { navigate, useRoute, useScrollTopOnChange } from './lib/router';
import { useStore } from './store';
import { dueCards } from './lib/srs';
import { Home } from './pages/Home';
import { Textbook } from './pages/Textbook';
import { Practice } from './pages/Practice';
import { Review } from './pages/Review';
import { Mock } from './pages/Mock';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';
import { Tools } from './pages/Tools';
import { Drill } from './pages/Drill';
import { Sheet } from './pages/Sheet';

const NAV: { page: string; label: string; icon: string }[] = [
  { page: 'home', label: 'ホーム', icon: '⌂' },
  { page: 'textbook', label: '教本', icon: '📖' },
  { page: 'tools', label: '体験ツール', icon: '🧪' },
  { page: 'practice', label: '確認問題', icon: '✎' },
  { page: 'drill', label: '計算ドリル', icon: '🧮' },
  { page: 'sheet', label: '直前チェック', icon: '📝' },
  { page: 'review', label: '復習', icon: '↻' },
  { page: 'mock', label: '模試', icon: '⏱' },
  { page: 'stats', label: '成績分析', icon: '📊' },
  { page: 'settings', label: '設定', icon: '⚙' },
];

function Page({ page }: { page: string }): JSX.Element {
  switch (page) {
    case 'textbook':
      return <Textbook />;
    case 'tools':
      return <Tools />;
    case 'drill':
      return <Drill />;
    case 'sheet':
      return <Sheet />;
    case 'practice':
      return <Practice />;
    case 'review':
      return <Review />;
    case 'mock':
      return <Mock />;
    case 'stats':
      return <Stats />;
    case 'settings':
      return <Settings />;
    default:
      return <Home />;
  }
}

export function App(): JSX.Element {
  const route = useRoute();
  const state = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const due = dueCards(state.srs).length;

  // 教本はセクションごとに読み直すので、キーに params を含める
  useScrollTopOnChange(`${route.page}/${route.params.join('/')}`);

  // 表示テーマを <html data-theme> に反映する。auto は OS 追従のため属性を外す
  useEffect(() => {
    const theme = state.theme ?? 'auto';
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [state.theme]);

  const go = (page: string) => {
    navigate(page);
    setMenuOpen(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="menu-toggle" onClick={() => setMenuOpen((v) => !v)} aria-label="メニュー">
          ☰
        </button>
        <button type="button" className="brand" onClick={() => go('home')}>
          危険物乙4 学習アプリ
        </button>
      </header>

      <nav className={`sidebar ${menuOpen ? 'open' : ''}`}>
        {NAV.map((n) => (
          <button
            key={n.page}
            type="button"
            className={`nav-item ${route.page === n.page ? 'active' : ''}`}
            onClick={() => go(n.page)}
          >
            <span className="nav-icon" aria-hidden>
              {n.icon}
            </span>
            <span className="nav-label">{n.label}</span>
            {n.page === 'review' && due > 0 && <span className="badge">{due}</span>}
          </button>
        ))}
      </nav>

      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <main className="main">
        <Page page={route.page} />
        <footer className="foot">
          学習記録はこのブラウザ（localStorage）にのみ保存されます。設定画面からエクスポートできます。
        </footer>
      </main>
    </div>
  );
}
