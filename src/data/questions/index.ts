import type { Question } from '../../types';

/**
 * 確認問題の全体。
 *
 * **まだ 1 問もない。**章立てが確定し、教本を書いてから作る。
 * 章ごとに 1 ファイル（`src/data/questions/<章 ID>.ts`）にして、ここへ足すこと。
 * 1 ファイル 1 担当にしておくと、複数のエージェントを並行で走らせても衝突しない。
 *
 * 目安は**本番の 3 倍（105 問）**。入門編を除く全節にひも付ける（`sectionId` は必須）。
 */
export const QUESTIONS: Question[] = [];

export const questionById = (id: string): Question | undefined => QUESTIONS.find((q) => q.id === id);

export const questionsOfCategory = (categoryId: string): Question[] =>
  QUESTIONS.filter((q) => q.categoryId === categoryId);

export const questionsOfSection = (sectionId: string): Question[] =>
  QUESTIONS.filter((q) => q.sectionId === sectionId);
