import { useSyncExternalStore } from 'react';
import type { AppState, AttemptLog, MockResult, Understanding } from './types';
import { emptyState, loadState, saveState } from './lib/storage';
import { newCard, review, type Grade } from './lib/srs';

let state: AppState = loadState();
const listeners = new Set<() => void>();

function set(next: AppState): void {
  state = next;
  saveState(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = (): AppState => state;

/** アプリのどこからでも最新の学習状態を購読する */
export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const actions = {
  markRead(sectionId: string, read: boolean): void {
    const current = new Set(state.readSections);
    const readAt = { ...(state.readAt ?? {}) };
    const understanding = { ...(state.understanding ?? {}) };
    if (read) {
      current.add(sectionId);
      readAt[sectionId] = Date.now();
    } else {
      current.delete(sectionId);
      delete readAt[sectionId];
      // 読了を取り消したら理解度の記録も残さない
      delete understanding[sectionId];
    }
    set({ ...state, readSections: [...current], readAt, understanding });
  },

  /** 理解度を記録する。同時に読了にもする（読まずに評価はできないため） */
  setUnderstanding(sectionId: string, level: Understanding): void {
    const current = new Set(state.readSections);
    current.add(sectionId);
    const readAt = { ...(state.readAt ?? {}) };
    if (readAt[sectionId] === undefined) readAt[sectionId] = Date.now();
    set({
      ...state,
      readSections: [...current],
      readAt,
      understanding: { ...(state.understanding ?? {}), [sectionId]: level },
    });
  },

  setBookmark(sectionId: string): void {
    if (state.bookmark === sectionId) return;
    set({ ...state, bookmark: sectionId });
  },

  setExamDate(date: string | undefined): void {
    set({ ...state, examDate: date });
  },

  setTheme(theme: NonNullable<AppState['theme']>): void {
    set({ ...state, theme });
  },

  /**
   * 解答を記録する。SRS カードも同時に更新し、
   * grade を省略した場合は正誤から自動で決める。
   */
  answer(params: {
    qid: string;
    categoryId: string;
    correct: boolean;
    mode: AttemptLog['mode'];
    grade?: Grade;
  }): void {
    const now = Date.now();
    const log: AttemptLog = {
      qid: params.qid,
      categoryId: params.categoryId,
      correct: params.correct,
      at: now,
      mode: params.mode,
    };
    // 計算ドリルは毎回数値が変わる自動生成問題なので、復習カードは作らない
    // （同じ問題文が二度と現れないため、間隔反復の対象にならない）
    if (params.mode === 'drill') {
      set({ ...state, logs: [...state.logs, log].slice(-5000) });
      return;
    }

    const card = state.srs[params.qid] ?? newCard(params.qid, params.categoryId, now);
    const grade: Grade = params.grade ?? (params.correct ? 'good' : 'again');
    const updated = review(card, grade, now);
    set({
      ...state,
      logs: [...state.logs, log].slice(-5000),
      srs: { ...state.srs, [params.qid]: updated },
    });
  },

  addMock(result: MockResult): void {
    set({ ...state, mocks: [...state.mocks, result] });
  },

  replace(next: AppState): void {
    set(next);
  },

  resetAll(): void {
    set({ ...emptyState });
  },
};
