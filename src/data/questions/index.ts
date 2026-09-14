import type { Question } from '../../types';
import { lawWhatQuestions } from './law-what';
import { lawPlaceQuestions } from './law-place';
import { lawPeopleQuestions } from './law-people';
import { lawRuleQuestions } from './law-rule';
import { sciBaseQuestions } from './sci-base';
import { sciBurnQuestions } from './sci-burn';
import { sciStopQuestions } from './sci-stop';
import { propCommonQuestions } from './prop-common';
import { propEachQuestions } from './prop-each';

/**
 * 確認問題の全体。
 *
 * **まだ 1 問もない。**9 章ぶんの空ファイルは揃っているので、
 * `src/data/questions/<章 ID>.ts` にそれぞれ書き足していく。
 * 1 ファイル 1 担当にしておくと、複数のエージェントを並行で走らせても衝突しない。
 * **教本を書き終えて、そのレビューを反映してから作ること。**
 *
 * 目安は**本番の 3 倍（105 問）**。入門編を除く全節にひも付ける（`sectionId` は必須）。
 */
export const QUESTIONS: Question[] = [
  ...lawWhatQuestions,
  ...lawPlaceQuestions,
  ...lawPeopleQuestions,
  ...lawRuleQuestions,
  ...sciBaseQuestions,
  ...sciBurnQuestions,
  ...sciStopQuestions,
  ...propCommonQuestions,
  ...propEachQuestions,
];

export const questionById = (id: string): Question | undefined => QUESTIONS.find((q) => q.id === id);

export const questionsOfCategory = (categoryId: string): Question[] =>
  QUESTIONS.filter((q) => q.categoryId === categoryId);

export const questionsOfSection = (sectionId: string): Question[] =>
  QUESTIONS.filter((q) => q.sectionId === sectionId);
