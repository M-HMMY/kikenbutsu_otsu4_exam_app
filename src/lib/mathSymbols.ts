/**
 * 数式に使える記号と命令の一覧。
 *
 * 表示は math.tsx が行うが、`npm run check` からも参照したいのでここに分けている
 * （check.ts は JSX を含むファイルを読み込めないため）。
 * **ここに無いバックスラッシュ命令は、名前がそのまま画面に出てしまう。**
 * 新しい記号が要るときは、まずこの表に足すこと。
 */

/** 単独で 1 文字に置き換わる命令 */
export const SYMBOL: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
  nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ',
  phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', ell: 'ℓ',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
  Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  sum: '∑', prod: '∏', int: '∫', partial: '∂', nabla: '∇', infty: '∞',
  times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', circ: '∘',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠',
  approx: '≈', simeq: '≃', equiv: '≡', propto: '∝', sim: '∼', ll: '≪', gg: '≫',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', supset: '⊃',
  cup: '∪', cap: '∩', setminus: '∖',
  forall: '∀', exists: '∃', emptyset: '∅', neg: '¬', land: '∧', lor: '∨',
  to: '→', rightarrow: '→', leftarrow: '←', mapsto: '↦',
  Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', leftrightarrow: '↔',
  odot: '⊙', otimes: '⊗', oplus: '⊕', star: '⋆', ast: '∗',
  angle: '∠', perp: '⊥', parallel: '∥', top: '⊤', bot: '⊥',
  mid: '∣', vert: '∣', Vert: '‖', lVert: '‖', rVert: '‖',
  lvert: '|', rvert: '|', lbrace: '{', rbrace: '}',
  langle: '⟨', rangle: '⟩', lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋',
  ldots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱', quad: ' ', qquad: '  ',
  prime: '′', degree: '°', aleph: 'ℵ',
  // かっこの大きさ指定は無視して、中身の記号だけを出す
  left: '', right: '', big: '', Big: '', bigl: '', bigr: '',
  displaystyle: '', limits: '', nolimits: '',
};

/**
 * `\命令{中身}` の形で、中身の見た目だけを変える命令。
 * 値は付けるクラス名（styles.css の `.math .mbf` などに対応）。
 */
export const DECORATION: Record<string, string> = {
  mathbf: 'mbf', boldsymbol: 'mbf', bm: 'mbf',
  mathbb: 'mbb',
  mathcal: 'mcal', mathscr: 'mcal',
  mathrm: 'mrm', text: 'mrm', textrm: 'mrm', operatorname: 'mrm', mathsf: 'mrm',
  mathit: 'mit',
};

/** `\命令{中身}` の形で、中身の上に記号を重ねる命令。値は結合文字 */
export const ACCENT: Record<string, string> = {
  hat: '̂',
  tilde: '̃',
  bar: '̄',
  overline: '̄',
  vec: '⃗',
  dot: '̇',
};

/**
 * 関数名として立体（イタリックにしない）で出す命令。
 * `\log p` のように、変数と区別が付くようにする。
 */
export const FUNCTION = new Set([
  'log', 'ln', 'exp', 'max', 'min', 'arg', 'argmax', 'argmin', 'sup', 'inf',
  'sin', 'cos', 'tan', 'tanh', 'sinh', 'cosh', 'softmax', 'sigmoid', 'relu',
  'det', 'tr', 'diag', 'rank', 'dim', 'sign', 'mod', 'gcd', 'lim',
]);

/** `\frac{分子}{分母}` と `\sqrt{中身}` は個別に組み立てる */
export const SPECIAL = new Set(['frac', 'sqrt']);

/** この名前で書ける命令かどうか。`npm run check` の書き間違い検出に使う */
export function isKnownCommand(name: string): boolean {
  return (
    SPECIAL.has(name) ||
    FUNCTION.has(name) ||
    name in SYMBOL ||
    name in DECORATION ||
    name in ACCENT
  );
}
