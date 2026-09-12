/**
 * lib/deriv.ts — Đạo hàm KÝ HIỆU (V12.0)
 *
 * VÌ SAO PHẢI CÓ. Bộ giải bảng biến thiên (lib/bbtsolve.ts) làm việc bằng số:
 * nó tìm được nghiệm y′ = 0 nhưng không viết ra được y′ là biểu thức nào. Mà
 * bài khảo sát hàm số của SGK bắt buộc phải trình bày y′ thành công thức —
 * "y′ = (x² − 2x)/(x − 1)²" — rồi mới xét dấu.
 *
 * Ở đây làm đúng phần cần cho Toán THPT: đa thức, phân thức, căn, luỹ thừa,
 * sin, cos, tan, ln, log, e^x, và hợp của chúng. Có rút gọn ở mức vừa đủ để
 * công thức đọc được (0 + u = u, 1·u = u, u/1 = u, hằng nhân hằng...), không
 * cố làm một hệ đại số máy tính đầy đủ — thứ đó cần khai triển, quy đồng, phân
 * tích thành nhân tử, và sai một chỗ là dạy sai cả bài.
 *
 * Nguyên tắc: KHÔNG ĐOÁN. Gặp hàm chưa biết cách lấy đạo hàm thì trả về
 * `ok: false` kèm lý do, để phần gọi nói thật với giáo viên thay vì in ra một
 * công thức gần đúng.
 */

import { parseExpression, type Node } from "./mathexpr";

export type DerivResult = { ok: boolean; latex?: string; expr?: string; error?: string };

const num = (v: number): Node => ({ k: "num", v });
const ZERO = num(0);
const ONE = num(1);

const laSo = (n: Node, v?: number): boolean => n.k === "num" && (v === undefined || Math.abs(n.v - v) < 1e-12);

/* ------------------------------------------------------------------ */
/* Dựng cây có rút gọn ngay                                            */
/* ------------------------------------------------------------------ */

function cong(a: Node, b: Node): Node {
  if (laSo(a, 0)) return b;
  if (laSo(b, 0)) return a;
  if (a.k === "num" && b.k === "num") return num(a.v + b.v);
  return { k: "bin", op: "+", a, b };
}

function tru(a: Node, b: Node): Node {
  if (laSo(b, 0)) return a;
  if (a.k === "num" && b.k === "num") return num(a.v - b.v);
  if (laSo(a, 0)) return doiDau(b);
  return { k: "bin", op: "-", a, b };
}

function doiDau(a: Node): Node {
  if (a.k === "num") return num(-a.v);
  if (a.k === "neg") return a.a;
  return { k: "neg", a };
}

function nhan(a: Node, b: Node): Node {
  if (laSo(a, 0) || laSo(b, 0)) return ZERO;
  if (laSo(a, 1)) return b;
  if (laSo(b, 1)) return a;
  if (a.k === "num" && b.k === "num") return num(a.v * b.v);
  // Hằng số luôn đứng trước: 2x đọc dễ hơn x·2.
  if (b.k === "num") return { k: "bin", op: "*", a: b, b: a };
  // u · (1/u) = 1. Không có luật này thì (x·ln x)′ in ra "ln(x) + x·(1/x)".
  if (b.k === "bin" && b.op === "/" && laSo(b.a, 1) && bang(a, b.b)) return ONE;
  if (a.k === "bin" && a.op === "/" && laSo(a.a, 1) && bang(b, a.b)) return ONE;
  return { k: "bin", op: "*", a, b };
}

/** So sánh hai cây theo hình dạng, dùng để rút gọn u/u = 1. */
function bang(a: Node, b: Node): boolean {
  return viet(a) === viet(b);
}

function chia(a: Node, b: Node): Node {
  if (laSo(a, 0)) return ZERO;
  if (laSo(b, 1)) return a;
  if (a.k === "num" && b.k === "num" && Math.abs(b.v) > 1e-12 && Number.isInteger(a.v / b.v)) return num(a.v / b.v);
  if (bang(a, b)) return ONE;
  return { k: "bin", op: "/", a, b };
}

function luy(a: Node, b: Node): Node {
  if (laSo(b, 0)) return ONE;
  if (laSo(b, 1)) return a;
  return { k: "bin", op: "^", a, b };
}

const fn = (name: string, a: Node): Node => ({ k: "fn", name, a });

/* ------------------------------------------------------------------ */
/* Đạo hàm                                                             */
/* ------------------------------------------------------------------ */

class KhongBiet extends Error {}

function d(n: Node): Node {
  switch (n.k) {
    case "num": return ZERO;
    case "var": return ONE;
    case "neg": return doiDau(d(n.a));
    case "bin": {
      const { op, a, b } = n;
      if (op === "+") return cong(d(a), d(b));
      if (op === "-") return tru(d(a), d(b));
      if (op === "*") return cong(nhan(d(a), b), nhan(a, d(b)));
      if (op === "/") {
        // (u/v)′ = (u′v − uv′)/v². Mẫu là hằng thì gọn hơn nhiều.
        if (b.k === "num") return chia(d(a), b);
        return chia(tru(nhan(d(a), b), nhan(a, d(b))), luy(b, num(2)));
      }
      // Luỹ thừa: chỉ nhận số mũ HẰNG (u^k) và cơ số hằng (a^u) — hai dạng của
      // chương trình THPT. u^v tổng quát phải dùng e^(v ln u), lằng nhằng mà
      // gần như không gặp trong bài giảng phổ thông.
      if (op === "^") {
        if (b.k === "num") return nhan(nhan(b, luy(a, num(b.v - 1))), d(a));
        if (a.k === "num") {
          if (a.v <= 0) throw new KhongBiet(`không lấy được đạo hàm của ${a.v}^u với cơ số không dương`);
          return nhan(nhan(n, fn("ln", a)), d(b));
        }
        throw new KhongBiet("luỹ thừa có cả cơ số và số mũ chứa x");
      }
      throw new KhongBiet(`phép toán "${op}"`);
    }
    case "fn": {
      const u = n.a, du = d(u);
      switch (n.name) {
        case "sin": return nhan(fn("cos", u), du);
        case "cos": return doiDau(nhan(fn("sin", u), du));
        case "tan": return chia(du, luy(fn("cos", u), num(2)));
        case "cot": return doiDau(chia(du, luy(fn("sin", u), num(2))));
        case "exp": return nhan(n, du);
        case "ln": return chia(du, u);
        // log của SGK Việt Nam là log cơ số 10.
        case "log": return chia(du, nhan(fn("ln", num(10)), u));
        case "sqrt": return chia(du, nhan(num(2), fn("sqrt", u)));
        case "cbrt": return chia(du, nhan(num(3), luy(fn("cbrt", u), num(2))));
        case "abs": throw new KhongBiet("hàm |u| không có đạo hàm tại điểm u = 0");
        case "asin": return chia(du, fn("sqrt", tru(ONE, luy(u, num(2)))));
        case "acos": return doiDau(chia(du, fn("sqrt", tru(ONE, luy(u, num(2))))));
        case "atan": return chia(du, cong(ONE, luy(u, num(2))));
        case "sinh": return nhan(fn("cosh", u), du);
        case "cosh": return nhan(fn("sinh", u), du);
        default: throw new KhongBiet(`hàm "${n.name}"`);
      }
    }
    default: throw new KhongBiet("biểu thức lạ");
  }
}

/* ------------------------------------------------------------------ */
/* Rút gọn: khai triển đa thức và ước lược hệ số                        */
/*                                                                     */
/* Đạo hàm thô của phân thức ra dạng ((2x+2)(x-1) - (x²+2x-2))/(x-1)². */
/* Về toán thì đúng, nhưng không giáo viên nào chấp nhận in như vậy lên */
/* slide: SGK luôn viết gọn thành (x² - 2x)/(x - 1)². Vì các hàm của    */
/* Toán THPT hầu hết là phân thức, chỉ cần khai triển ĐA THỨC là đủ —   */
/* không cần một hệ đại số máy tính đầy đủ.                             */
/* ------------------------------------------------------------------ */

/** Hệ số của đa thức theo x, chỉ số = số mũ. null nếu không phải đa thức. */
function heSo(n: Node): number[] | null {
  switch (n.k) {
    case "num": return [n.v];
    case "var": return [0, 1];
    case "neg": {
      const a = heSo(n.a);
      return a ? a.map((c) => -c) : null;
    }
    case "bin": {
      if (n.op === "+" || n.op === "-") {
        const a = heSo(n.a), b = heSo(n.b);
        if (!a || !b) return null;
        const out = new Array(Math.max(a.length, b.length)).fill(0);
        a.forEach((c, i) => { out[i] += c; });
        b.forEach((c, i) => { out[i] += n.op === "+" ? c : -c; });
        return out;
      }
      if (n.op === "*") {
        const a = heSo(n.a), b = heSo(n.b);
        if (!a || !b) return null;
        const out = new Array(a.length + b.length - 1).fill(0);
        a.forEach((ca, i) => b.forEach((cb, j) => { out[i + j] += ca * cb; }));
        return out;
      }
      if (n.op === "^" && n.b.k === "num" && Number.isInteger(n.b.v) && n.b.v >= 0 && n.b.v <= 8) {
        const a = heSo(n.a);
        if (!a) return null;
        let out = [1];
        for (let k = 0; k < n.b.v; k++) {
          const next = new Array(out.length + a.length - 1).fill(0);
          out.forEach((co, i) => a.forEach((ca, j) => { next[i + j] += co * ca; }));
          out = next;
        }
        return out;
      }
      return null;
    }
    default: return null;
  }
}

/** Dựng lại cây từ hệ số, viết từ số mũ cao xuống thấp như SGK. */
function tuHeSo(c: number[]): Node {
  const lam = (i: number): Node => (i === 0 ? ONE : i === 1 ? { k: "var" } : luy({ k: "var" }, num(i)));
  let ket: Node | null = null;
  for (let i = c.length - 1; i >= 0; i--) {
    const h = Number(c[i].toFixed(10));
    if (Math.abs(h) < 1e-12) continue;
    const hang = nhan(num(Math.abs(h)), lam(i));
    if (ket === null) ket = h < 0 ? doiDau(hang) : hang;
    else ket = h < 0 ? tru(ket, hang) : cong(ket, hang);
  }
  return ket ?? ZERO;
}

/** Tách một tích thành (hệ số, phần còn lại). */
function tachHeSo(n: Node): { k: number; con: Node } {
  if (n.k === "num") return { k: n.v, con: ONE };
  if (n.k === "neg") { const t = tachHeSo(n.a); return { k: -t.k, con: t.con }; }
  if (n.k === "bin" && n.op === "*") {
    const a = tachHeSo(n.a), b = tachHeSo(n.b);
    return { k: a.k * b.k, con: nhan(a.con, b.con) };
  }
  return { k: 1, con: n };
}

/** Rút gọn một lượt từ dưới lên: khai triển đa thức, ước lược hệ số phân thức. */
function rutGon(n: Node): Node {
  if (n.k === "neg") return doiDau(rutGon(n.a));
  if (n.k === "fn") return fn(n.name, rutGon(n.a));
  if (n.k === "bin") {
    const a = rutGon(n.a), b = rutGon(n.b);
    if (n.op === "/") {
      // Hệ số chung của tử và mẫu: (2x)/(2√(x²+1)) phải ra x/√(x²+1).
      const t = tachHeSo(a), m = tachHeSo(b);
      if (Math.abs(m.k) > 1e-12) {
        const ti = t.k / m.k;
        if (Number.isInteger(ti)) return chia(nhan(num(ti), t.con), m.con);
        if (Number.isInteger(m.k / t.k) && Math.abs(t.k) > 1e-12)
          return chia(t.k < 0 !== m.k < 0 ? doiDau(t.con) : t.con, nhan(num(Math.abs(m.k / t.k)), m.con));
      }
      return chia(a, b);
    }
    const gop = n.op === "+" ? cong(a, b) : n.op === "-" ? tru(a, b) : n.op === "*" ? nhan(a, b) : luy(a, b);
    const hs = heSo(gop);
    // Chỉ thay bằng dạng khai triển khi nó thực sự NGẮN HƠN: (x-1)^2 gọn hơn
    // x^2 - 2x + 1, và SGK cũng giữ dạng nhân tử ở mẫu.
    if (hs && hs.length <= 6) {
      const dep = tuHeSo(hs);
      if (viet(dep).length <= viet(gop).length) return dep;
    }
    return gop;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* In ra chữ                                                           */
/* ------------------------------------------------------------------ */

const UU_TIEN: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 };

function soDep(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(6)));
}

/** Dạng phẳng để đưa lại cho lib/mathexpr.ts tính toán và vẽ đồ thị. */
function viet(n: Node, ngoai = 0): string {
  const boc = (s: string, uu: number) => (uu < ngoai ? `(${s})` : s);
  switch (n.k) {
    case "num": return n.v < 0 ? `(${soDep(n.v)})` : soDep(n.v);
    case "var": return "x";
    case "neg": return boc(`-${viet(n.a, 3)}`, 1);
    case "bin": {
      const uu = UU_TIEN[n.op] ?? 2;
      const dau = n.op === "*" ? "*" : n.op;
      return boc(`${viet(n.a, uu)}${dau}${viet(n.b, n.op === "^" ? uu + 1 : uu + 1)}`, uu);
    }
    case "fn": return `${n.name}(${viet(n.a, 0)})`;
    default: return "";
  }
}

/** Dạng LaTeX để hiện lên slide đúng lối Toán. */
function vietLatex(n: Node, ngoai = 0): string {
  const boc = (s: string, uu: number) => (uu < ngoai ? `\\left(${s}\\right)` : s);
  switch (n.k) {
    // Số âm chỉ cần ngoặc khi đứng CẠNH một phép toán khác; đứng một mình (tử
    // của phân số chẳng hạn) thì "\dfrac{\left(-2\right)}{...}" nhìn rất kỳ.
    case "num": return n.v < 0 && ngoai >= 2 ? `\\left(${soDep(n.v)}\\right)` : soDep(n.v);
    case "var": return "x";
    case "neg": return boc(`-${vietLatex(n.a, 3)}`, 1);
    case "bin": {
      if (n.op === "/") return `\\dfrac{${vietLatex(n.a, 0)}}{${vietLatex(n.b, 0)}}`;
      if (n.op === "^") return `${vietLatex(n.a, 5)}^{${vietLatex(n.b, 0)}}`;
      if (n.op === "*") {
        // Hằng nhân biến thì viết liền (2x), còn lại dùng dấu nhân của Toán.
        const trai = vietLatex(n.a, 2), phai = vietLatex(n.b, 2);
        const lien = n.a.k === "num" && (n.b.k === "var" || n.b.k === "bin" || n.b.k === "fn");
        return boc(lien ? `${trai}${phai}` : `${trai} \\cdot ${phai}`, 2);
      }
      const dau = n.op === "+" ? " + " : " - ";
      return boc(`${vietLatex(n.a, 1)}${dau}${vietLatex(n.b, 2)}`, 1);
    }
    case "fn": {
      const ten = n.name === "sqrt" ? null : n.name;
      if (n.name === "sqrt") return `\\sqrt{${vietLatex(n.a, 0)}}`;
      if (n.name === "cbrt") return `\\sqrt[3]{${vietLatex(n.a, 0)}}`;
      if (n.name === "exp") return `e^{${vietLatex(n.a, 0)}}`;
      if (n.name === "abs") return `\\left|${vietLatex(n.a, 0)}\\right|`;
      return `\\${ten}\\left(${vietLatex(n.a, 0)}\\right)`;
    }
    default: return "";
  }
}

/**
 * Đạo hàm của một biểu thức, trả về cả dạng LaTeX (để hiện) và dạng phẳng (để
 * tính tiếp). Không lấy được thì nói rõ vì sao.
 */
export function daoHam(bieuThuc: string): DerivResult {
  const p = parseExpression(bieuThuc);
  if (!p.ok || !p.node) return { ok: false, error: p.error || "Không đọc được biểu thức" };
  try {
    const kq = rutGon(d(p.node));
    return { ok: true, latex: vietLatex(kq), expr: viet(kq) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof KhongBiet
        ? `Chưa lấy được đạo hàm ký hiệu: ${e.message}.`
        : e instanceof Error ? e.message : "Không lấy được đạo hàm",
    };
  }
}

/** Biểu thức ban đầu, viết lại dưới dạng LaTeX (để hiện y = … trên slide). */
export function sangLatex(bieuThuc: string): string | null {
  const p = parseExpression(bieuThuc);
  return p.ok && p.node ? vietLatex(p.node) : null;
}
