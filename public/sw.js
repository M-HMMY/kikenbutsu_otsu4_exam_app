/*
 * オフライン用のサービスワーカー。
 *
 * ビルドのたびに JS/CSS のファイル名（ハッシュ）が変わるため、
 * 事前にファイル名を列挙せず「取得したものを順次キャッシュする」方式にしている。
 *   - ナビゲーション（ページ遷移）: ネットワーク優先。失敗したらキャッシュした index を返す
 *   - それ以外の同一オリジンの GET: キャッシュ優先 + 裏で更新（stale-while-revalidate）
 */

/*
 * **キャッシュ名には、必ずこのアプリ固有の接頭辞を付ける。**
 * Cache Storage はオリジン単位なので、姉妹アプリを同じドメイン（github.io）に
 * 並べると 1 つの入れ物を共有する。activate で「自分以外」を消すと、
 * 隣のアプリのオフラインキャッシュまで巻き添えにする。
 * 消してよいのは、自分の接頭辞が付いたものだけ。
 */
const CACHE_PREFIX = 'kikenbutsu-otsu4-exam-app-';
const CACHE = CACHE_PREFIX + 'v1';

/** 改名前の接頭辞。既存の利用者のブラウザに残るので、ここで片づける。 */
const LEGACY_PREFIX = 'otsu4-exam-app-';

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
      .then((keys) => {
        const mine = keys.filter(
          (k) => k !== CACHE && (k.startsWith(CACHE_PREFIX) || k.startsWith(LEGACY_PREFIX)),
        );
        return Promise.all(mine.map((k) => caches.delete(k)));
      })
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
