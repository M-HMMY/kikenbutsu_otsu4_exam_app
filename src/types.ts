/** アプリ全体で使う型定義 */

/**
 * 試験科目。
 *
 * **公式の 3 科目をそのまま分野にしてある。**危険物取扱者試験（乙種）は
 * 「危険物に関する法令」「基礎的な物理学及び基礎的な化学」
 * 「危険物の性質並びにその火災予防及び消火の方法」の 3 科目で、
 * **科目ごとに 6 割を取らないと合格にならない。**だから科目は表示の都合ではなく、
 * 成績を出す単位そのものである。前に範囲外の入門編を置く。
 */
export type FieldId = 'intro' | 'law' | 'science' | 'property';

/** 中分類（シラバスの「項目」相当）。教本の章と問題のタグを兼ねる */
export interface Category {
  id: string;
  field: FieldId;
  /** 表示名（例: 線形代数） */
  name: string;
  /** 一行説明 */
  summary: string;
  /** この章が公式シラバスのどの項目に当たるか（例: 技術分野 7〜10）。章の扉に出す */
  syllabus: string;
  /** 本番のおおよその出題数の推定値。GUGA は内訳を公表していない（categories.ts の注記を参照） */
  questions: number;
  /**
   * 章の扉に出す導入文（Markdown）。この章で何をやり、なぜ必要で、
   * どれくらい力を入れるべきかを、節を読む前に伝える。
   */
  intro: string;
}

/** 教本の 1 セクション（＝ひとつの学習単位） */
export interface TextbookSection {
  id: string;
  categoryId: string;
  title: string;
  /** 学習の狙い。一覧に出す */
  goal: string;
  /** 本文。Markdown サブセット（見出し/表/箇条書き/コード/強調/$数式$） */
  body: string;
  /** 目安学習時間（分） */
  minutes: number;
}

/**
 * 確認問題（多肢選択式）。
 *
 * **公式の出題形式は「五肢択一式」のマークカード方式。**選択肢は 5 つで、
 * 姉妹アプリ（四肢択一）から移植するときに必ず踏むところなので注意すること。
 *
 * 本番は 35 問 / 120 分なので 1 問あたり約 3 分 26 秒あり、姉妹アプリより時間に余裕がある。
 * ただし**法令の条文を読ませる問題は長くなりがち**なので、長さの上限は別に決めてある
 * （`scripts/check.ts` を参照）。
 *
 * `answer` は配列も取れる（複数選択）。公式は五肢択一なので**通常は数値ひとつ**だが、
 * 型としては姉妹アプリから引き継いである。読むときも比べるときも
 * `src/lib/answer.ts` を通すこと（画面ごとに場合分けを書くとずれる）。
 */
export interface Question {
  id: string;
  categoryId: string;
  /** 関連する教本セクション（解説からの復習導線に使う）。全問に付けるのが望ましい */
  sectionId?: string;
  question: string;
  /** 条文の引用など、原文のまま見せたい断片。等幅・行番号付きで表示する */
  code?: string;
  /** **五肢択一なので 5 つ。**四肢択一の姉妹アプリから写すときに必ず直すところ */
  choices: [string, string, string, string, string];
  /**
   * 正解の添字（0=ア, 1=イ, 2=ウ, 3=エ, 4=オ）。
   *
   * 複数選択の問題を作る場合は、正解の添字を昇順の配列で書く（例: `[0, 2]`）。
   * そのときは**問題文に「2 つ選びなさい」などと必ず書くこと。**
   * いくつ選ぶのかを画面側が教えてしまうと、本番より易しくなる。
   * `npm run check` が、書き忘れをエラーにする。
   *
   * **ただし公式の出題形式は五肢択一で、複数選択は含まれない。**
   * 配列を使う前に、本当にこの試験の形かを確かめること。
   */
  answer: 0 | 1 | 2 | 3 | 4 | readonly number[];
  explanation: string;
  /** 体感難易度 1（易）〜3（難） */
  level: 1 | 2 | 3;
  /**
   * 出典。消防試験研究センターが公開している過去問などから採った場合に設定する。
   *
   * **`source` が付いた問題は、文章の作りを検査しない。**原文どおりに収録するものなので、
   * 長さも正解の位置も直せない（`scripts/check.ts` を参照）。
   */
  source?: string;
}

/** 解答履歴の 1 レコード */
export interface AttemptLog {
  qid: string;
  categoryId: string;
  correct: boolean;
  /** epoch ms */
  at: number;
  /** 出題モード */
  mode: 'practice' | 'review' | 'mock' | 'check' | 'drill';
}

/** SRS（間隔反復）のカード状態。SM-2 を簡略化したもの */
export interface SrsCard {
  qid: string;
  categoryId: string;
  /** 難易度係数 */
  ease: number;
  /** 次回までの間隔（日） */
  interval: number;
  /** 連続正解数 */
  streak: number;
  /** 次回出題日時 epoch ms */
  due: number;
  /** 総解答回数 */
  reps: number;
  lapses: number;
}

/** 模試 1 回分の結果 */
export interface MockResult {
  id: string;
  at: number;
  /** 出題セットの名前（例: 本番形式 60 問） */
  preset: string;
  total: number;
  correct: number;
  /** 所要時間（秒） */
  elapsed: number;
  /** 分野別の正誤 */
  byCategory: Record<string, { total: number; correct: number }>;
}

/**
 * 節ごとの理解度。読了フラグだけでは「読んだが自信がない節」を拾えないため、
 * 3 段階で記録して復習の優先順位に使う。
 */
export type Understanding = 1 | 2 | 3;

/** localStorage に保存する状態のすべて */
export interface AppState {
  version: number;
  /** 読了した教本セクション ID */
  readSections: string[];
  logs: AttemptLog[];
  srs: Record<string, SrsCard>;
  mocks: MockResult[];
  /** 教本の栞（最後に開いたセクション） */
  bookmark?: string;
  /** セクション ID ごとの読了日時（epoch ms）。「今日の進捗」の集計に使う */
  readAt?: Record<string, number>;
  /** 試験日（YYYY-MM-DD）。未設定ならカウントダウン非表示 */
  examDate?: string;
  /** 表示テーマ。既定は 'auto'（OS 追従） */
  theme?: 'light' | 'dark' | 'auto';
  /**
   * セクション ID ごとの理解度（1=もう一度読みたい / 2=だいたい分かった / 3=だいじょうぶ）。
   * 記録がない読了済みの節は「水準は未記録」として扱う。
   */
  understanding?: Record<string, Understanding>;
}
