/*
 * オフライン用のサービスワーカー。
 *
 * ビルドのたびに JS/CSS のファイル名（ハッシュ）が変わるため、
 * 事前にファイル名を列挙せず「取得したものを順次キャッシュする」方式にしている。
 *   - ナビゲーション（ページ遷移）: ネットワーク優先。失敗したらキャッシュした index を返す
 *   - それ以外の同一オリジンの GET: キャッシュ優先 + 裏で更新（stale-while-revalidate）
 */
const CACHE = 'otsu4-exam-app-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined) // 1 つでも取得できないと install が失敗するので握りつぶす
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ページ遷移はネットワーク優先（新しい版をすぐ反映するため）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached ?? caches.match('./'))),
    );
    return;
  }

  // 資産はキャッシュ優先。裏でこっそり更新しておく
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
