import type { SrsCard } from '../types';

export const DAY = 24 * 60 * 60 * 1000;

/** 自己申告の手応え。SM-2 の quality を 4 段階に丸めたもの */
export type Grade = 'again' | 'hard' | 'good' | 'easy';

/** 正解時に選べる手応え。誤答は自動的に again 扱いにする */
export const GRADE_LABEL: Record<Grade, string> = {
  again: 'もう一度',
  hard: '難しい',
  good: '普通',
  easy: '簡単',
};

export function newCard(qid: string, categoryId: string, now = Date.now()): SrsCard {
  return { qid, categoryId, ease: 2.5, interval: 0, streak: 0, due: now, reps: 0, lapses: 0 };
}

/**
 * SM-2 を簡略化した更新。初回は 1 日後、2 回目は 3 日後、以降は ease 倍で伸ばす。
 * 誤答すると間隔をリセットし、10 分後に再出題する。
 */
export function review(card: SrsCard, grade: Grade, now = Date.now()): SrsCard {
  const next: SrsCard = { ...card, reps: card.reps + 1 };

  if (grade === 'again') {
    next.lapses += 1;
    next.streak = 0;
    next.interval = 0;
    next.ease = Math.max(1.3, card.ease - 0.2);
    next.due = now + 10 * 60 * 1000;
    return next;
  }

  next.streak = card.streak + 1;
  if (grade === 'hard') next.ease = Math.max(1.3, card.ease - 0.15);
  if (grade === 'easy') next.ease = Math.min(3.0, card.ease + 0.15);

  if (next.streak === 1) next.interval = grade === 'easy' ? 3 : 1;
  else if (next.streak === 2) next.interval = grade === 'easy' ? 6 : 3;
  else {
    const factor = grade === 'hard' ? 1.2 : next.ease;
    next.interval = Math.round(card.interval * factor) || 1;
  }
  next.interval = Math.min(next.interval, 180);
  next.due = now + next.interval * DAY;
  return next;
}

/** 期限が来ているカードを、期限が古い順に返す */
export function dueCards(srs: Record<string, SrsCard>, now = Date.now()): SrsCard[] {
  return Object.values(srs)
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due);
}

/** 今日以降 7 日間の復習予定件数 */
export function upcoming(srs: Record<string, SrsCard>, days = 7, now = Date.now()): number[] {
  const buckets = new Array(days).fill(0) as number[];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (const c of Object.values(srs)) {
    const d = Math.floor((c.due - start.getTime()) / DAY);
    if (d < 0) buckets[0] += 1;
    else if (d < days) buckets[d] += 1;
  }
  return buckets;
}
