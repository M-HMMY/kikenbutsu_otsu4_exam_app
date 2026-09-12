import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root が見つかりません');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/*
 * オフライン利用のためのサービスワーカー登録。
 * 開発時は無効（HMR と干渉するため）。
 * サービスワーカーは HTTPS か localhost でしか動かないので、
 * LAN の http://192.168.x.x で開いた場合は登録されない（アプリ自体は普通に使える）。
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // 登録できない環境（HTTP 経由など）ではオフライン機能なしで動作する
    });
  });
}
