/**
 * lib/latex.ts — Chuyển LaTeX sang Unicode để đưa vào PowerPoint/Word (V11)
 *
 * Vấn đề của V10: hàm cleanText() kết thúc bằng `.replace(/\\[a-zA-Z]+/g, "")`
 * nên MỌI lệnh LaTeX chưa liệt kê đều bị XOÁ ÂM THẦM.
 *   "\\sqrt{x+1}"  ->  "x+1"      (mất căn thức!)
 *   "\\int_0^1 x dx" -> "_0^1 x dx"
 * Giáo viên không hề được cảnh báo. V11 xử lý theo hướng ngược lại:
 *  - Dịch đầy đủ căn, phân số, mũ, chỉ số, chữ Hy Lạp, toán tử, hàm.
 *  - Lệnh chưa biết thì GIỮ NGUYÊN TÊN và báo cáo ra ngoài để kiểm định cảnh báo,
 *    tuyệt đối không xoá.
 */

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
  zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ",
  tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

const SYMBOLS: Record<string, string> = {
  infty: "∞", pm: "±", mp: "∓", times: "×", div: "÷", cdot: "·", ast: "∗",
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈",
  equiv: "≡", sim: "∼", propto: "∝",
  Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", rightarrow: "→",
  to: "→", leftarrow: "←", leftrightarrow: "↔", mapsto: "↦", implies: "⇒",
  in: "∈", notin: "∉", ni: "∋", subset: "⊂", subseteq: "⊆", supset: "⊃",
  supseteq: "⊇", cup: "∪", cap: "∩", setminus: "∖", emptyset: "∅", varnothing: "∅",
  forall: "∀", exists: "∃", nexists: "∄", neg: "¬", land: "∧", lor: "∨",
  sum: "∑", prod: "∏", int: "∫", iint: "∬", oint: "∮", partial: "∂", nabla: "∇",
  angle: "∠", perp: "⊥", parallel: "∥", triangle: "△", square: "□", degree: "°",
  circ: "∘", dots: "…", ldots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱",
  quad: " ", qquad: "  ", ", ": " ", vec: "→", overline: "‾", prime: "′",
  lim: "lim", log: "log", ln: "ln", sin: "sin", cos: "cos", tan: "tan",
  cot: "cot", sec: "sec", csc: "csc", max: "max", min: "min", arg: "arg",
  gcd: "ƯCLN", deg: "deg", det: "det",
};

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶",
  "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "(": "⁽", ")": "⁾",
  n: "ⁿ", i: "ⁱ", x: "ˣ", a: "ᵃ", b: "ᵇ", k: "ᵏ", m: "ᵐ", T: "ᵀ",
};

const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆",
  "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "(": "₍", ")": "₎",
  n: "ₙ", i: "ᵢ", j: "ⱼ", k: "ₖ", a: "ₐ", x: "ₓ", m: "ₘ", t: "ₜ",
};

function toScript(text: string, map: Record<string, string>): string | null {
  let out = "";
  for (const ch of text) {
    if (!(ch in map)) return null;
    out += map[ch];
  }
  return out;
}

export type LatexConvertResult = { text: string; unknownCommands: string[] };

/** Chuyển một chuỗi LaTeX thuần sang Unicode đọc được. */
export function latexToUnicode(input: string): LatexConvertResult {
  const unknown = new Set<string>();
  let s = String(input ?? "").normalize("NFC");

  s = s.replace(/\\left|\\right|\\!|\\,|\\;|\\:/g, "");
  s = s.replace(/\\displaystyle|\\textstyle|\\limits/g, "");
  s = s.replace(/\\(?:text|mathrm|mathit|operatorname)\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\mathbb\{R\}/g, "ℝ").replace(/\\mathbb\{N\}/g, "ℕ")
       .replace(/\\mathbb\{Z\}/g, "ℤ").replace(/\\mathbb\{Q\}/g, "ℚ")
       .replace(/\\mathbb\{C\}/g, "ℂ").replace(/\\mathbb\{([A-Z])\}/g, "$1");

  // Căn thức — giữ nguyên ký hiệu √ thay vì xoá như V10
  for (let i = 0; i < 5; i++) {
    s = s.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, (_m, n, a) => `${toScript(String(n), SUP) ?? n}√(${a})`);
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, (_m, a) => (/^[0-9a-zA-Z]$/.test(a) ? `√${a}` : `√(${a})`));
  }

  // Phân số — dùng ký tự phân số đẹp cho các trường hợp phổ biến
  const NICE: Record<string, string> = {
    "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾",
    "1/5": "⅕", "1/6": "⅙", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
  };
  for (let i = 0; i < 6; i++) {
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a, b) => {
      const key = `${a}/${b}`;
      if (NICE[key]) return NICE[key];
      const wrapA = /^[0-9a-zA-Z]+$/.test(a) ? a : `(${a})`;
      const wrapB = /^[0-9a-zA-Z]+$/.test(b) ? b : `(${b})`;
      return `${wrapA}/${wrapB}`;
    });
  }

  // Tích phân, tổng có cận:  \int_0^1  ->  ∫₀¹
  s = s.replace(/\\(int|sum|prod|lim|oint)_\{?([^{}\s^]*)\}?(?:\^\{?([^{}\s]*)\}?)?/g,
    (_m, cmd, lo, hi) => {
      const base = SYMBOLS[cmd] ?? cmd;
      const l = toScript(String(lo ?? ""), SUB) ?? `_${lo}`;
      const h = hi ? (toScript(String(hi), SUP) ?? `^${hi}`) : "";
      return `${base}${l}${h}`;
    });

  // Mũ và chỉ số
  s = s.replace(/\^\{([^{}]*)\}/g, (_m, a) => toScript(a, SUP) ?? `^(${a})`);
  s = s.replace(/\^(-?[0-9a-zA-Z])/g, (_m, a) => toScript(a, SUP) ?? `^${a}`);
  s = s.replace(/_\{([^{}]*)\}/g, (_m, a) => toScript(a, SUB) ?? `_(${a})`);
  s = s.replace(/_(-?[0-9a-zA-Z])/g, (_m, a) => toScript(a, SUB) ?? `_${a}`);

  // Vectơ, gạch ngang
  s = s.replace(/\\vec\{([^{}]*)\}/g, "$1⃗").replace(/\\vec\s*([a-zA-Z])/g, "$1⃗");
  s = s.replace(/\\overline\{([^{}]*)\}/g, "$1̅").replace(/\\bar\{([^{}]*)\}/g, "$1̅");
  s = s.replace(/\\hat\{([^{}]*)\}/g, "$1̂");

  // Chữ Hy Lạp & ký hiệu
  // Ăn luôn một dấu cách sau tên lệnh, đúng quy tắc LaTeX ("\geq 0" -> "≥0")
  s = s.replace(/\\([a-zA-Z]+) ?/g, (_m, name: string) => {
    if (name in GREEK) return GREEK[name];
    if (name in SYMBOLS) return SYMBOLS[name];
    unknown.add(`\\${name}`);
    return name; // GIỮ LẠI, không xoá
  });

  s = s.replace(/[{}]/g, "").replace(/\s{2,}/g, " ").trim();
  return { text: s, unknownCommands: [...unknown] };
}

/**
 * Chuyển đoạn văn có công thức xen kẽ `$...$` sang Unicode.
 * Dùng cho phần chữ của slide PowerPoint.
 */
export function mixedLatexToUnicode(input: string): LatexConvertResult {
  const unknown = new Set<string>();
  const parts = String(input ?? "").split(/(\$[^$]*\$|\\\([\s\S]*?\\\))/g);
  const text = parts
    .map((part) => {
      const isMath =
        (part.startsWith("$") && part.endsWith("$") && part.length > 1) ||
        (part.startsWith("\\(") && part.endsWith("\\)"));
      if (!isMath) return part;
      const inner = part.startsWith("$") ? part.slice(1, -1) : part.slice(2, -2);
      const r = latexToUnicode(inner);
      r.unknownCommands.forEach((c) => unknown.add(c));
      return r.text;
    })
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { text, unknownCommands: [...unknown] };
}
