import type { TextbookSection } from '../../types';
import { intro } from './intro';
import { lawWhat } from './law-what';
import { lawPlace } from './law-place';
import { lawPeople } from './law-people';
import { lawRule } from './law-rule';
import { sciBase } from './sci-base';
import { sciBurn } from './sci-burn';
import { sciStop } from './sci-stop';
import { propCommon } from './prop-common';
import { propEach } from './prop-each';

/**
 * 教本の全セクション。CATEGORIES の並び順に対応させる。
 *
 * **10 章ぶんのファイルは揃っている。**中身は入門編 4 節だけで、残り 9 章は空。
 * 1 章 1 ファイル（`src/data/textbook/<章 ID>.ts`）にしてあるので、
 * 複数のエージェントを並行で走らせても衝突しない。
 * **並びは `CATEGORIES` と同じ順にすること。**目次の表示順がここで決まる。
 */
export const SECTIONS: TextbookSection[] = [
  ...intro,
  ...lawWhat,
  ...lawPlace,
  ...lawPeople,
  ...lawRule,
  ...sciBase,
  ...sciBurn,
  ...sciStop,
  ...propCommon,
  ...propEach,
];

export const sectionById = (id: string): TextbookSection | undefined => SECTIONS.find((s) => s.id === id);

export const sectionsOfCategory = (categoryId: string): TextbookSection[] =>
  SECTIONS.filter((s) => s.categoryId === categoryId);

/** 教本全体の目安学習時間（分）。ホームと目次に出す */
export const totalMinutes = SECTIONS.reduce((sum, s) => sum + s.minutes, 0);
