/**
 * lib/bbtsolve.ts — Tự dựng bảng biến thiên từ BIỂU THỨC hàm số (V11.8)
 *
 * VÌ SAO PHẢI CÓ TỆP NÀY
 * ----------------------
 * Bộ sinh nội dung (mô hình ngôn ngữ) làm toán không đáng tin. Trong bài giảng
 * "Khảo sát và vẽ đồ thị của một số hàm số cơ bản" nó đưa ra bảng biến thiên của
 *
 *     y = (x² - x + 1)/(x + 1)
 *
 * với các mốc x = -3 và x = 1. Nhưng y′ = (x² + 2x - 2)/(x+1)², nghiệm thật là
 * x = -1 ± √3 ≈ -2,73 và 0,73. Giá trị cực đại thật là ≈ -6,46 (bảng ghi -7),
 * cực tiểu thật ≈ 0,46 (bảng ghi 1). Toàn bộ bảng sai, mà DẤU của y′ trên từng
 * khoảng lại đúng — nên bộ kiểm định cũ (chỉ đối chiếu dấu) không hề bắt được.
 *
 * Lược đồ dữ liệu đã có sẵn trường `expression` đúng để làm việc này. Ở đây phần
 * mềm TỰ GIẢI: dò tiệm cận đứng, giải y′ = 0 bằng phương pháp số, tính giá trị
 * và giới hạn. Kết quả thay thẳng vào bảng.
 *
 * RANH GIỚI RÕ RÀNG
 * -----------------
 * Chỉ tự tính khi CÓ `expression`. Bảng không kèm biểu thức (ví dụ đề bài cho
 * sẵn bảng để hỏi học sinh "hàm số đạt cực tiểu tại đâu") thì không đụng tới —
 * ở đó không có gì để đối chiếu, và bịa ra là sai nguyên tắc.
 *
 * Và khi không chắc chắn thì TRẢ VỀ ok = false để giữ nguyên bảng cũ, chứ không
 * đoán. Thà để giáo viên tự sửa còn hơn thay một cái sai bằng một cái sai khác.
 */

import { compileExpression, detectPoles, numericDerivative } from "./mathexpr";

/**
 * Kiểu PHẲNG, không phải hợp phân biệt theo `ok`. tsconfig.json của dự án đặt
 * "strict": false nên TypeScript KHÔNG thu hẹp được kiểu qua boolean — viết
 * { ok: true } | { ok: false; error } rồi đọc r.error sẽ làm hỏng npm run build.
 */
export type SolvedTable = {
  ok: boolean;
  error?: string;
  x: string[];
  derivative: string[];
  values: string[];
  discontinuities: { index: number; leftValue: string; rightValue: string }[];
  /** Những gì đã tính được, để báo lại cho giáo viên. */
  notes: string[];
};

const INF_POS = "+\\infty";
const INF_NEG = "-\\infty";

/* ------------------------------------------------------------------ */
/* Viết số cho đẹp                                                     */
/* ------------------------------------------------------------------ */

const EPS = 1e-7;
const gan = (a: number, b: number, eps = EPS) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

/** Số thập phân kiểu Việt Nam: dấu phẩy, tối đa 2 chữ số. */
function thapPhan(x: number): string {
  return (Math.round(x * 100) / 100).toString().replace(".", ",");
}

/**
 * Viết một số thực dưới dạng đẹp nhất có thể.
 *
 * Thứ tự thử: số nguyên -> phân số đơn giản -> dạng (a ± √b)/c -> số thập phân
 * xấp xỉ. Nghiệm của phương trình bậc hai hệ số nguyên luôn có dạng thứ ba, mà
 * đó chính là phần lớn bài tập khảo sát hàm số của lớp 12 — nên bảng sẽ ghi
 * "-1-√3" đúng như sách giáo khoa chứ không phải "-2,73".
 */
export function vietSo(x: number, eps = 1e-9): string {
  if (!Number.isFinite(x)) return x > 0 ? INF_POS : INF_NEG;
  if (Math.abs(x - Math.round(x)) <= eps * Math.max(1, Math.abs(x))) return String(Math.round(x));

  // phân số đơn giản p/q
  for (let q = 2; q <= 12; q++) {
    const p = Math.round(x * q);
    if (gan(x, p / q, eps)) return `\\frac{${p}}{${q}}`;
  }

  // dạng (a ± k√m)/c — nghiệm phương trình bậc hai hệ số nguyên
  for (let c = 1; c <= 6; c++) {
    for (let a = -30; a <= 30; a++) {
      const r = x * c - a; // = ±k√m
      const b = Math.round(r * r);
      if (b <= 1 || b > 400) continue;
      if (!gan(Math.abs(r), Math.sqrt(b), Math.max(eps, 1e-8))) continue;
      const can = rutGonCan(b);
      if (!can) continue; // b chính phương -> đã bắt ở nhánh số nguyên/phân số
      const am = r < 0;
      const tu = a === 0
        ? `${am ? "-" : ""}${can}`
        : `${a} ${am ? "-" : "+"} ${can}`;
      return c === 1 ? tu : `\\frac{${tu}}{${c}}`;
    }
  }

  return `\\approx ${thapPhan(x)}`;
}

/**
 * Rút gọn √b về dạng k√m (√12 -> 2√3), đúng cách viết của sách giáo khoa.
 * Trả về null nếu b là số chính phương (khi đó đã có dạng số nguyên rồi).
 */
function rutGonCan(b: number): string | null {
  let k = 1;
  let m = b;
  for (let d = 2; d * d <= m; d++) {
    while (m % (d * d) === 0) { m /= d * d; k *= d; }
  }
  if (m === 1) return null;
  return k === 1 ? `\\sqrt{${m}}` : `${k}\\sqrt{${m}}`;
}

/**
 * Làm tròn một kết quả tính bằng phương pháp số về giá trị "đẹp" gần nhất.
 *
 * Nghiệm tìm bằng chia đôi hay giới hạn tính bằng cách thế x = 10⁶ luôn lệch
 * một chút: tiệm cận đứng x = 2 ra 1,9999999998, giới hạn y = 1 ra 1,000002.
 * In nguyên như thế lên bảng biến thiên thì học sinh đọc thành số vô tỉ.
 */
function lamDep(x: number, eps: number): number {
  const n = Math.round(x);
  if (Math.abs(x - n) <= eps * Math.max(1, Math.abs(x))) return n;
  for (let q = 2; q <= 12; q++) {
    const p = Math.round(x * q);
    if (Math.abs(x - p / q) <= eps * Math.max(1, Math.abs(x))) return p / q;
  }
  return x;
}

/* ------------------------------------------------------------------ */
/* Giải                                                                */
/* ------------------------------------------------------------------ */

/** Cửa sổ khảo sát: đủ rộng để bắt hết nghiệm, đủ hẹp để không nhiễu. */
const CUA_SO = 40;
/** Số điểm quét khi dò đổi dấu của y′. */
const SO_DIEM = 4000;

function loi(message: string): SolvedTable {
  return { ok: false, error: message, x: [], derivative: [], values: [], discontinuities: [], notes: [] };
}

/** Tìm nghiệm của g trên [a;b] bằng chia đôi, biết g(a) và g(b) trái dấu. */
function chiaDoi(g: (x: number) => number, a: number, b: number): number | null {
  let lo = a, hi = b, flo = g(lo);
  if (!Number.isFinite(flo)) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const fm = g(mid);
    if (!Number.isFinite(fm)) return null;
    if (fm === 0) return mid;
    if ((flo < 0) !== (fm < 0)) hi = mid;
    else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

/**
 * Giới hạn của f khi x tiến tới `tai` từ một phía (hoặc tới ±∞ nếu tai = ±Infinity).
 * Trả về chuỗi LaTeX: "+\\infty", "-\\infty", hoặc giá trị hữu hạn.
 */
function gioiHan(f: (x: number) => number, tai: number, phia: 1 | -1): string | null {
  const mocs = Number.isFinite(tai)
    ? [1e-3, 1e-4, 1e-5, 1e-6].map((d) => tai + phia * d)
    : [1e3, 1e4, 1e5, 1e6].map((d) => (tai > 0 ? d : -d));
  const ys = mocs.map(f);
  if (ys.some((y) => !Number.isFinite(y))) return null;
  const cuoi = ys[ys.length - 1];
  const truoc = ys[ys.length - 2];
  const dau = ys[0];

  // HỘI TỤ: hai mốc cuối gần như trùng nhau -> giới hạn hữu hạn.
  if (Math.abs(cuoi - truoc) < 1e-3 * Math.max(1, Math.abs(cuoi))) return vietSo(lamDep(cuoi, 1e-4), 1e-6);

  /**
   * PHÂN KỲ: độ lớn tăng đều và cuối cùng lớn hơn hẳn lúc đầu.
   *
   * V11.7 đòi |cuoi| > 1e6, nên hàm có tiệm cận XIÊN như (x²-x+1)/(x+1) — tại
   * x = 10⁶ mới chỉ đạt 999998 — bị coi là "không xác định được giới hạn" và cả
   * bảng biến thiên bỏ cuộc. Nay xét theo XU HƯỚNG chứ không theo một mức cố định.
   */
  const tang = Math.abs(cuoi) > Math.abs(truoc) * 1.5 && Math.abs(cuoi) > Math.abs(dau) * 10;
  const cungDau = ys.slice(1).every((y) => (y < 0) === (cuoi < 0));
  if (tang && cungDau && Math.abs(cuoi) > 1e3) return cuoi > 0 ? INF_POS : INF_NEG;
  return null;
}

/**
 * Dựng bảng biến thiên đúng từ biểu thức.
 * Trả về ok = false kèm lý do khi không đủ chắc chắn.
 */
export function solveVariationTable(expression: string): SolvedTable {
  const c = compileExpression(expression);
  if (!c.ok) return loi(`không đọc được biểu thức: ${c.error}`);
  const f = (x: number) => c.eval(x);

  const poles = detectPoles(expression, -CUA_SO, CUA_SO, 3000)
    .filter((p) => Math.abs(p) < CUA_SO - 1)
    .map((p) => lamDep(p, 1e-6))
    .sort((a, b) => a - b);

  // --- nghiệm của y' = 0 -------------------------------------------
  const dao = (x: number) => numericDerivative(expression, x, 1e-6);
  const xaTiemCan = (x: number) => poles.every((p) => Math.abs(x - p) > 1e-3);

  const nghiem: number[] = [];
  let truocX: number | null = null;
  let truocY: number | null = null;
  for (let i = 0; i <= SO_DIEM; i++) {
    const x = -CUA_SO + (2 * CUA_SO * i) / SO_DIEM;
    if (!xaTiemCan(x)) { truocX = null; truocY = null; continue; }
    const y = dao(x);
    if (!Number.isFinite(y)) { truocX = null; truocY = null; continue; }
    if (truocX !== null && truocY !== null && (truocY < 0) !== (y < 0)) {
      const r = chiaDoi(dao, truocX, x);
      // Đổi dấu ngay sát tiệm cận là do sai số, không phải nghiệm.
      if (r !== null && xaTiemCan(r) && Number.isFinite(f(r))) nghiem.push(r);
    }
    truocX = x;
    truocY = y;
  }

  // gộp nghiệm trùng
  const mocNghiem: number[] = [];
  for (const r of nghiem.sort((a, b) => a - b)) {
    const dep = lamDep(r, 1e-7);
    if (!mocNghiem.length || Math.abs(dep - mocNghiem[mocNghiem.length - 1]) > 1e-4) mocNghiem.push(dep);
  }

  const trong = [...mocNghiem, ...poles].sort((a, b) => a - b);
  if (trong.length > 6) return loi(`hàm có ${trong.length} mốc trong khoảng khảo sát — quá nhiều để dựng bảng tự động`);

  // --- hàng x -------------------------------------------------------
  const n = trong.length + 2;
  // .map(vietSo) sẽ truyền CHỈ SỐ mảng vào tham số `eps` — với chỉ số 3 thì sai
  // số cho phép thành 3, và -1+√3 ≈ 0,73 bị làm tròn thành 1. Phải gói lại.
  const xs: string[] = [INF_NEG, ...trong.map((t) => vietSo(t)), INF_POS];
  const laPole = (k: number) => k >= 1 && k <= trong.length && poles.some((p) => Math.abs(p - trong[k - 1]) < 1e-9);

  // --- hàng y' (dạng đầy đủ: dấu xen kẽ nghiệm, 2n-3 ô) --------------
  const der: string[] = [];
  for (let k = 0; k < n - 1; k++) {
    const a = k === 0 ? trong[0] - 1 : trong[k - 1];
    const b = k === n - 2 ? trong[trong.length - 1] + 1 : trong[k];
    const lo = Number.isFinite(a) ? a : b - 2;
    const hi = Number.isFinite(b) ? b : lo + 2;
    const mid = trong.length ? (k === 0 ? trong[0] - 1 : k === n - 2 ? trong[trong.length - 1] + 1 : (lo + hi) / 2) : 0;
    const d = dao(mid);
    if (!Number.isFinite(d)) return loi(`không tính được dấu y′ quanh x = ${thapPhan(mid)}`);
    if (Math.abs(d) < 1e-9) return loi("y′ bằng 0 trên cả một khoảng — bảng biến thiên không xác định");
    if (k > 0) der.push(laPole(k) ? "||" : "0");
    der.push(d > 0 ? "+" : "-");
  }

  // --- hàng giá trị y và điểm gián đoạn ------------------------------
  const values: string[] = new Array(n).fill("");
  const discontinuities: { index: number; leftValue: string; rightValue: string }[] = [];

  const gtDau = gioiHan(f, -Infinity, -1);
  const gtCuoi = gioiHan(f, Infinity, 1);
  if (gtDau === null || gtCuoi === null) return loi("không xác định được giới hạn ở vô cực");
  values[0] = gtDau;
  values[n - 1] = gtCuoi;

  for (let k = 1; k <= trong.length; k++) {
    const x0 = trong[k - 1];
    if (laPole(k)) {
      const tr = gioiHan(f, x0, -1);
      const ph = gioiHan(f, x0, 1);
      if (tr === null || ph === null) return loi(`không xác định được giới hạn hai bên x = ${thapPhan(x0)}`);
      discontinuities.push({ index: k, leftValue: tr, rightValue: ph });
      values[k] = "";
    } else {
      const y = f(x0);
      if (!Number.isFinite(y)) return loi(`hàm không xác định tại mốc x = ${thapPhan(x0)}`);
      values[k] = vietSo(lamDep(y, 1e-7), 1e-7);
    }
  }

  const notes: string[] = [];
  if (mocNghiem.length) notes.push(`nghiệm y′ = 0 tại ${mocNghiem.map((r) => thapPhan(r)).join(", ")}`);
  if (poles.length) notes.push(`tiệm cận đứng tại ${poles.map((p) => thapPhan(p)).join(", ")}`);
  if (!mocNghiem.length && !poles.length) notes.push("hàm đơn điệu trên toàn tập xác định, không có cực trị");

  return { ok: true, x: xs, derivative: der, values, discontinuities, notes };
}

/** Bảng hiện có đã khớp với biểu thức chưa? Dùng để biết có cần thay hay không. */
export function tableMatches(
  cu: { x?: string[]; values?: string[]; derivative?: string[] },
  moi: SolvedTable,
): boolean {
  if (!moi.ok) return true; // không giải được thì coi như không có gì để so
  const chuan = (a: string[] | undefined) =>
    (a ?? []).map((t) => String(t).replace(/\s|\\left|\\right|\{|\}/g, "")).join("|");
  return (
    chuan(cu.x) === chuan(moi.x) &&
    chuan(cu.values) === chuan(moi.values) &&
    chuan(cu.derivative) === chuan(moi.derivative)
  );
}
