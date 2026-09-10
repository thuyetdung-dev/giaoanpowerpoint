/**
 * lib/mathexpr.ts — Bộ phân tích & tính biểu thức Toán an toàn (V11)
 *
 * Thay thế cho `new Function(...)` trong V10:
 *  - Không dùng eval/Function  -> an toàn với CSP, không thể chèn mã.
 *  - Hỗ trợ đầy đủ hàm THPT: sin, cos, tan, cot, ln, log, sqrt, |x|, e^x, arcsin...
 *  - Xử lý đúng dấu trừ đơn nguyên: -x^2 = -(x^2)  (V10 sinh SyntaxError với "-x**2").
 *  - Hỗ trợ nhân ngầm: 2x, 3(x+1), 2sin(x), x(x-1).
 *  - Biên dịch một lần -> gọi hàng nghìn lần khi vẽ đồ thị (nhanh hơn V10).
 */

export type CompiledExpr = {
  ok: boolean;
  /** Tính giá trị tại x. Trả về NaN nếu không xác định (chia 0, ln số âm, biểu thức sai). */
  eval: (x: number) => number;
  /** Biểu thức đã chuẩn hoá, dùng để hiển thị. */
  source: string;
  /** Lý do biên dịch thất bại (chỉ có khi ok = false). */
  error?: string;
};

type Node =
  | { k: "num"; v: number }
  | { k: "var" }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node }
  | { k: "fn"; name: string; a: Node };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  Pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
};

const FUNCTIONS: Record<string, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  cot: (v) => 1 / Math.tan(v),
  sec: (v) => 1 / Math.cos(v),
  csc: (v) => 1 / Math.sin(v),
  asin: Math.asin,
  arcsin: Math.asin,
  acos: Math.acos,
  arccos: Math.acos,
  atan: Math.atan,
  arctan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10, // quy ước THPT Việt Nam: log = log cơ số 10
  lg: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
};

/** Chuẩn hoá cú pháp LaTeX thường gặp từ AI về dạng biểu thức phẳng. */
export function normalizeExpression(input: string): string {
  let s = String(input ?? "").trim();
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\\dfrac|\\tfrac|\\frac/g, "\\frac");
  // \frac{A}{B} -> (A)/(B), lặp để xử lý phân số lồng nhau
  for (let i = 0; i < 6 && s.includes("\\frac"); i++) {
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))");
  }
  s = s.replace(/\\sqrt\[3\]\{([^{}]*)\}/g, "cbrt($1)");
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)");
  s = s.replace(/\\(sin|cos|tan|cot|ln|log|exp|sinh|cosh|tanh|arcsin|arccos|arctan)/g, "$1");
  s = s.replace(/\\pi/g, "pi").replace(/\\cdot|\\times/g, "*").replace(/\\div/g, "/");
  s = s.replace(/\^\{([^{}]*)\}/g, "^($1)");
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\s+/g, "");
  return s;
}

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " ") { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const v = Number(src.slice(i, j));
      if (!Number.isFinite(v)) throw new Error(`Số không hợp lệ: "${src.slice(i, j)}"`);
      out.push({ t: "num", v });
      i = j;
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/^(),|".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    throw new Error(`Ký tự không được phép: "${c}"`);
  }
  return out;
}

function parse(tokens: Tok[]): Node {
  let p = 0;
  /** Đang ở trong cặp |...| hay không — để dấu | đóng không bị hiểu là nhân ngầm. */
  let absDepth = 0;
  const peek = () => tokens[p];
  const eat = (v: string) => {
    const t = tokens[p];
    if (t && t.t === "op" && t.v === v) { p++; return true; }
    return false;
  };

  // expr := term (('+'|'-') term)*
  function expr(): Node {
    let a = term();
    for (;;) {
      const t = peek();
      if (t && t.t === "op" && (t.v === "+" || t.v === "-")) {
        p++;
        a = { k: "bin", op: t.v as "+" | "-", a, b: term() };
      } else return a;
    }
  }

  // term := unary (('*'|'/'| ngầm) unary)*
  function term(): Node {
    let a = unary();
    for (;;) {
      const t = peek();
      if (t && t.t === "op" && (t.v === "*" || t.v === "/")) {
        p++;
        a = { k: "bin", op: t.v as "*" | "/", a, b: unary() };
        continue;
      }
      // nhân ngầm: 2x, 3(x+1), x sin(x), 2|x|
      const implicitAbs = t && t.t === "op" && t.v === "|" && absDepth === 0;
      if (t && (t.t === "num" || t.t === "id" || (t.t === "op" && (t.v === "(" || implicitAbs)))) {
        a = { k: "bin", op: "*", a, b: unary() };
        continue;
      }
      return a;
    }
  }

  // unary := '-' unary | power     (dấu trừ yếu hơn ^  =>  -x^2 = -(x^2))
  function unary(): Node {
    if (eat("-")) return { k: "neg", a: unary() };
    if (eat("+")) return unary();
    return power();
  }

  // power := atom ('^' unary)?      (kết hợp phải: 2^3^2 = 2^(3^2))
  function power(): Node {
    const a = atom();
    if (eat("^")) return { k: "bin", op: "^", a, b: unary() };
    return a;
  }

  function atom(): Node {
    const t = peek();
    if (!t) throw new Error("Biểu thức kết thúc đột ngột");
    if (t.t === "num") { p++; return { k: "num", v: t.v }; }
    if (t.t === "op" && t.v === "(") {
      p++;
      const inner = expr();
      if (!eat(")")) throw new Error("Thiếu dấu ')'");
      return inner;
    }
    if (t.t === "op" && t.v === "|") {
      p++;
      absDepth++;
      const inner = expr();
      absDepth--;
      if (!eat("|")) throw new Error("Thiếu dấu '|' đóng");
      return { k: "fn", name: "abs", a: inner };
    }
    if (t.t === "id") {
      p++;
      const name = t.v;
      if (name === "x" || name === "X") return { k: "var" };
      if (name in CONSTANTS) return { k: "num", v: CONSTANTS[name] };
      if (name in FUNCTIONS) {
        // cho phép sin^2(x) -> (sin(x))^2 theo quy ước THPT
        let pow: Node | null = null;
        if (eat("^")) pow = unary();
        const arg = atom();
        const call: Node = { k: "fn", name, a: arg };
        return pow ? { k: "bin", op: "^", a: call, b: pow } : call;
      }
      throw new Error(`Không nhận ra "${name}". Chỉ dùng x, pi, e và các hàm sin, cos, tan, ln, log, sqrt, abs...`);
    }
    throw new Error(`Không hiểu ký hiệu "${t.v}"`);
  }

  const root = expr();
  if (p < tokens.length) throw new Error("Còn ký tự thừa ở cuối biểu thức");
  return root;
}

function evaluate(n: Node, x: number): number {
  switch (n.k) {
    case "num": return n.v;
    case "var": return x;
    case "neg": return -evaluate(n.a, x);
    case "fn": {
      const f = FUNCTIONS[n.name];
      return f ? f(evaluate(n.a, x)) : NaN;
    }
    case "bin": {
      const a = evaluate(n.a, x);
      const b = evaluate(n.b, x);
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return b === 0 ? NaN : a / b;
        case "^": {
          // căn bậc lẻ của số âm: (-8)^(1/3) = -2, chuẩn SGK
          if (a < 0 && !Number.isInteger(b)) {
            const inv = 1 / b;
            if (Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 !== 0) {
              return -Math.pow(-a, b);
            }
            return NaN;
          }
          return Math.pow(a, b);
        }
      }
    }
  }
  return NaN;
}

const cache = new Map<string, CompiledExpr>();

/** Biên dịch biểu thức một lần rồi tái sử dụng. */
export function compileExpression(raw: string): CompiledExpr {
  const source = normalizeExpression(raw);
  const hit = cache.get(source);
  if (hit) return hit;
  let result: CompiledExpr;
  try {
    const ast = parse(tokenize(source));
    result = {
      ok: true,
      source,
      eval: (x: number) => {
        const y = evaluate(ast, x);
        return Number.isFinite(y) ? y : NaN;
      },
    };
  } catch (e) {
    result = {
      ok: false,
      source,
      error: e instanceof Error ? e.message : "Biểu thức không hợp lệ",
      eval: () => NaN,
    };
  }
  if (cache.size > 400) cache.clear();
  cache.set(source, result);
  return result;
}

/** Tính nhanh một giá trị (dùng cho kiểm định). */
export function evalAt(raw: string, x: number): number {
  const c = compileExpression(raw);
  return c.ok ? c.eval(x) : NaN;
}

/** Đạo hàm số học, dùng để kiểm tra chéo bảng biến thiên do AI sinh ra. */
export function numericDerivative(raw: string, x: number, h = 1e-5): number {
  const c = compileExpression(raw);
  if (!c.ok) return NaN;
  const a = c.eval(x + h);
  const b = c.eval(x - h);
  return Number.isFinite(a) && Number.isFinite(b) ? (a - b) / (2 * h) : NaN;
}

/**
 * Dò tiệm cận đứng: tìm các điểm hàm số "nhảy" vô cực trong miền vẽ.
 * Nhờ đó đồ thị 1/(x-1) được vẽ đứt đoạn đúng chỗ thay vì nối liền qua cực.
 */
export function detectPoles(raw: string, xMin: number, xMax: number, samples = 900): number[] {
  const c = compileExpression(raw);
  if (!c.ok) return [];
  const poles: number[] = [];
  const step = (xMax - xMin) / samples;
  let prev = c.eval(xMin);
  for (let i = 1; i <= samples; i++) {
    const x = xMin + i * step;
    const y = c.eval(x);
    const jump = Math.abs(y - prev);
    if ((!Number.isFinite(y) && Number.isFinite(prev)) || (Number.isFinite(y) && !Number.isFinite(prev)) || jump > 1e4) {
      // nhị phân thu hẹp vị trí cực
      let lo = x - step, hi = x;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        const m = c.eval(mid);
        if (!Number.isFinite(m) || Math.abs(m) > 1e6) hi = mid; else lo = mid;
      }
      const p = (lo + hi) / 2;
      if (!poles.some((q) => Math.abs(q - p) < step * 2)) poles.push(p);
    }
    prev = y;
  }
  return poles;
}
