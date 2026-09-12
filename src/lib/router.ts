import { useEffect, useState } from 'react';

export interface Route {
  /** 画面名（home / textbook / practice / ...） */
  page: string;
  /** 追加のパスセグメント（教本のセクション ID など） */
  params: string[];
  /** ?key=value 形式のクエリ */
  query: Record<string, string>;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path, search = ''] = raw.split('?');
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  const query: Record<string, string> = {};
  for (const pair of search.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    query[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return { page: segments[0] ?? 'home', params: segments.slice(1), query };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(to: string): void {
  const next = to.startsWith('#') ? to : `#/${to.replace(/^\//, '')}`;
  if (location.hash === next) return;
  location.hash = next;
}

/** ページ遷移のたびに先頭までスクロールする */
export function useScrollTopOnChange(key: string): void {
  useEffect(() => {
    const main = document.querySelector('.main');
    if (main) main.scrollTo({ top: 0 });
  }, [key]);
}
