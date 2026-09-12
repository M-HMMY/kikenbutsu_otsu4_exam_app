import type { AppState } from '../types';

const KEY = 'otsu4-exam-app-state-v1';

export const emptyState: AppState = {
  version: 1,
  readSections: [],
  logs: [],
  srs: {},
  mocks: [],
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...emptyState };
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...emptyState,
      ...parsed,
      readSections: parsed.readSections ?? [],
      logs: parsed.logs ?? [],
      srs: parsed.srs ?? {},
      mocks: parsed.mocks ?? [],
    };
  } catch {
    // 壊れた保存データやプライベートモードでも起動できるようにする
    return { ...emptyState };
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 保存できない環境では黙って諦める（学習自体は継続できる） */
  }
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): AppState | null {
  try {
    const parsed = JSON.parse(json) as Partial<AppState>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return { ...emptyState, ...parsed };
  } catch {
    return null;
  }
}
