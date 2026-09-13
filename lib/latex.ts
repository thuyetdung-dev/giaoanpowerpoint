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
 *
 * ------------------------------------------------------------------------
 * V11.7 — BIẾT KHI NÀO UNICODE LÀ KHÔNG ĐỦ
 * ------------------------------------------------------------------------
 * V11.6 vẫn ép mọi công thức về Unicode một dòng, kể cả khi Unicode không có
 * ký hiệu tương ứng. Hậu quả thấy rõ trên bài giảng thật:
 *
 *   \frac{ax+b}{cx+d}          ->  (ax+b)/(cx+d)   (phải là phân số hai tầng)
 *   y_{CT}                     ->  y_(CT)          (C, T không có dạng chỉ số)
 *   \lim_{x \to -\infty}       ->  limₓ →-∞        (sai hẳn)
 *   \mathbb{R}\setminus\{1\}   ->  ℝ ∖ \1\         (dấu \{ \} không được xử lý)
 *
 * V11.7 sửa hai việc:
 *  1. Dịch đúng những gì Unicode làm được (giới hạn, tập hợp, chỉ số nhiều ký tự
 *     dạng số, dấu ngoặc nhọn thoát).
 *  2. TRUNG THỰC báo ra `lossy = true` khi Unicode KHÔNG diễn đạt nổi. Bộ xuất
 *     PowerPoint đọc cờ này để dựng riêng khối chữ đó bằng KaTeX thành ảnh —
 *     phân số hai tầng, lim có cận bên dưới, đúng như sách giáo khoa.
 *
 * Nguyên tắc: thà báo "tôi không diễn đạt được" còn hơn in ra một thứ gần đúng
 * mà học sinh đọc thành nghĩa khác.
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

/**
 * `lossy` = Unicode KHÔNG diễn đạt được đúng công thức này (phân số tổng quát,
 * chỉ số bằng chữ cái, giới hạn có cận...). Bộ xuất PowerPoint dùng cờ này để
 * quyết định dựng khối chữ bằng KaTeX thành ảnh thay vì in chữ thường.
 *
 * Kiểu PHẲNG (không phải hợp phân biệt) vì tsconfig.json của dự án đặt
 * "strict": false — TypeScript sẽ không thu hẹp được kiểu qua boolean.
 */
export type LatexConvertResult = { text: string; unknownCommands: string[]; lossy: boolean };

/** Chuyển một chuỗi LaTeX thuần sang Unicode đọc được. */
export function latexToUnicode(input: string): LatexConvertResult {
  const unknown = new Set<string>();
  let lossy = false;
  let s = String(input ?? "").normalize("NFC");

  // Dấu ngoặc nhọn THOÁT (\{ \}) là ngoặc thật của tập hợp, phải giữ lại. V11.6
  // để nguyên dấu \ rồi mới xoá { } ở cuối, nên "ℝ \setminus \{1\}" ra "ℝ ∖ \1\".
  // Tạm thay bằng ký tự riêng, cuối hàm mới đổi về { }.
  s = s.replace(/\\\{/g, "\u0001").replace(/\\\}/g, "\u0002");

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
  /**
   * PHÂN SỐ CÓ NGOẶC LỒNG (sửa ở V12.4).
   *
   * Bản cũ bắt hai nhóm bằng biểu thức chính quy `\{([^{}]*)\}` — tức là nhóm
   * KHÔNG được chứa ngoặc nào nữa. Gặp `\frac{36}{x^{2}}` (mẫu có `x^{2}`) thì
   * không khớp, `\frac` rơi xuống mục "lệnh lạ", và chữ in ra slide thành
   * "frac36x²". Đây là dạng phân số thường gặp bậc nhất của môn Toán, mà chính
   * prompt của phần mềm lại dạy giáo viên viết đúng như vậy.
   *
   * Nay đếm ngoặc để lấy đúng nhóm cân bằng, nên lồng bao nhiêu tầng cũng được.
   */
  const nhomCanBang = (chuoi: string, moNgoac: number): { noiDung: string; ketThuc: number } | null => {
    if (chuoi[moNgoac] !== "{") return null;
    let sau = 0;
    for (let k = moNgoac; k < chuoi.length; k++) {
      if (chuoi[k] === "{") sau++;
      else if (chuoi[k] === "}") {
        sau--;
        if (sau === 0) return { noiDung: chuoi.slice(moNgoac + 1, k), ketThuc: k + 1 };
      }
    }
    return null;
  };
  for (let i = 0; i < 6; i++) {
    const m = /\\[dt]?frac\{/.exec(s);
    if (!m) break;
    const batDau = m.index;
    const tu = nhomCanBang(s, batDau + m[0].length - 1);
    if (!tu) break;
    const mau = nhomCanBang(s, tu.ketThuc);
    if (!mau) break;
    const a = tu.noiDung, b = mau.noiDung;
    const key = `${a}/${b}`;
    let thay: string;
    if (NICE[key]) thay = NICE[key];
    else {
      // Unicode không có phân số hai tầng tổng quát. Vẫn trả về dạng một dòng
      // để chỗ nào cần chữ thuần (ghi chú, phiếu học tập) còn dùng được, nhưng
      // báo lossy để slide dựng lại bằng KaTeX.
      lossy = true;
      const wrapA = /^[0-9a-zA-Z]+$/.test(a) ? a : `(${a})`;
      const wrapB = /^[0-9a-zA-Z]+$/.test(b) ? b : `(${b})`;
      thay = `${wrapA}/${wrapB}`;
    }
    s = s.slice(0, batDau) + thay + s.slice(mau.ketThuc);
    i = -1;   // còn phân số nữa thì làm tiếp, kể cả phân số lồng trong phân số
  }

  /**
   * Toán tử có cận: \int_0^1, \sum_{i=1}^{n}, \lim_{x \to 2}.
   *
   * V11.6 dùng lớp ký tự [^{}\s^] nên cận DỪNG Ở DẤU CÁCH: "\lim_{x \to -\infty}"
   * chỉ bắt được "x", phần "\to -\infty" rơi ra ngoài thành "limₓ →-∞" — sai
   * hẳn nghĩa. Nay bắt trọn cặp ngoặc, cho phép dấu cách bên trong.
   */
  const braced = "\\{([^{}]*)\\}|([^{}\\s^_]+)";
  s = s.replace(
    new RegExp(`\\\\(int|sum|prod|lim|oint|iint)(?:_(?:${braced}))?(?:\\^(?:${braced}))?`, "g"),
    (_m, cmd, loB, loP, hiB, hiP) => {
      const base = SYMBOLS[cmd] ?? cmd;
      const lo = loB ?? loP ?? "";
      const hi = hiB ?? hiP ?? "";
      if (!lo && !hi) return base;
      // Chỉ số bằng Unicode chỉ đẹp khi cận ngắn và toàn chữ số. "lim" trong SGK
      // luôn viết cận XUỐNG DƯỚI chữ lim, Unicode không làm được -> lossy.
      const l = lo ? toScript(lo, SUB) : "";
      const h = hi ? toScript(hi, SUP) : "";
      if (cmd === "lim" || (lo && l === null) || (hi && h === null)) {
        lossy = true;
        const parts = [lo ? `${lo}` : "", hi ? `→${hi}` : ""].filter(Boolean).join(" ");
        return lo || hi ? `${base}(${parts})` : base;
      }
      return `${base}${l ?? ""}${h ?? ""}`;
    },
  );

  // Mũ và chỉ số. Không dịch nổi sang Unicode (ví dụ y_{CT}) thì báo lossy.
  const script = (a: string, map: Record<string, string>, fb: string) => {
    const t = toScript(a, map);
    if (t !== null) return t;
    lossy = true;
    return `${fb}(${a})`;
  };
  s = s.replace(/\^\{([^{}]*)\}/g, (_m, a) => script(a, SUP, "^"));
  s = s.replace(/\^(-?[0-9a-zA-Z])/g, (_m, a) => script(a, SUP, "^"));
  s = s.replace(/_\{([^{}]*)\}/g, (_m, a) => script(a, SUB, "_"));
  s = s.replace(/_(-?[0-9a-zA-Z])/g, (_m, a) => script(a, SUB, "_"));

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
    lossy = true;
    return name; // GIỮ LẠI, không xoá
  });

  s = s.replace(/[{}]/g, "");
  // Trả lại dấu ngoặc nhọn thật của tập hợp: \{1\} -> {1}
  s = s.replace(/\u0001/g, "{").replace(/\u0002/g, "}");
  // "ℝ∖{1}" đọc dính, SGK viết "ℝ \ {1}" — chừa khoảng thở hai bên dấu hiệu.
  s = s.replace(/\s*∖\s*/g, " ∖ ");
  s = s.replace(/\s{2,}/g, " ").trim();
  return { text: s, unknownCommands: [...unknown], lossy };
}

/* ------------------------------------------------------------------ */
/* Tách đoạn văn thành phần chữ và phần công thức                      */
/* ------------------------------------------------------------------ */

export type MathSegment = { math: boolean; value: string };

/**
 * Cắt một đoạn văn thành các mảnh chữ thường và mảnh công thức.
 * Nhận cả hai lối viết `$...$` và `\( ... \)`.
 *
 * Dùng chung cho: bộ xuất PowerPoint (dựng KaTeX), khung xem trước, và bộ kiểm
 * định — để cả ba hiểu công thức nằm ở đâu giống hệt nhau.
 */
export function splitMathSegments(input: string): MathSegment[] {
  const parts = String(input ?? "").split(/(\$[^$]*\$|\\\([\s\S]*?\\\))/g);
  return parts
    .filter((p) => p !== "")
    .map((part) => {
      const isMath =
        (part.startsWith("$") && part.endsWith("$") && part.length > 1) ||
        (part.startsWith("\\(") && part.endsWith("\\)"));
      if (!isMath) return { math: false, value: part };
      return { math: true, value: part.startsWith("$") ? part.slice(1, -1) : part.slice(2, -2) };
    });
}

/**
 * Đoạn văn này có công thức mà Unicode một dòng KHÔNG diễn đạt nổi hay không?
 *
 * Đây là công tắc quyết định bộ xuất PowerPoint in chữ thường (sửa được trong
 * PowerPoint) hay dựng KaTeX thành ảnh (đẹp đúng như SGK). Chỉ những chỗ thật
 * sự cần mới thành ảnh, nhờ vậy phần lớn slide vẫn là chữ sửa được.
 */
export function needsRichMath(input: string): boolean {
  return splitMathSegments(input).some((seg) => seg.math && latexToUnicode(seg.value).lossy);
}

/**
 * Chuyển đoạn văn có công thức xen kẽ `$...$` sang Unicode.
 * Dùng cho phần chữ của slide PowerPoint, ghi chú và phiếu học tập Word.
 */
export function mixedLatexToUnicode(input: string): LatexConvertResult {
  const unknown = new Set<string>();
  let lossy = false;
  const text = splitMathSegments(input)
    .map((seg) => {
      if (!seg.math) return seg.value;
      const r = latexToUnicode(seg.value);
      r.unknownCommands.forEach((c) => unknown.add(c));
      if (r.lossy) lossy = true;
      return r.text;
    })
    .join("")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { text, unknownCommands: [...unknown], lossy };
}
