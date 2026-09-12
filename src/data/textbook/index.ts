import type { TextbookSection } from '../../types';
import { intro } from './intro';

/**
 * 教本の全セクション。CATEGORIES の並び順に対応させる。
 *
 * **いまは入門編の 1 節だけ。**章ごとに 1 ファイル（`src/data/textbook/<章 ID>.ts`）を作り、
 * ここへ足していく。1 ファイル 1 担当にしておくと、
 * 複数のエージェントを並行で走らせても衝突しない。
 */
export const SECTIONS: TextbookSection[] = [...intro];

export const sectionById = (id: string): TextbookSection | undefined => SECTIONS.find((s) => s.id === id);

export const sectionsOfCategory = (categoryId: string): TextbookSection[] =>
  SECTIONS.filter((s) => s.categoryId === categoryId);

/** 教本全体の目安学習時間（分）。ホームと目次に出す */
export const totalMinutes = SECTIONS.reduce((sum, s) => sum + s.minutes, 0);
