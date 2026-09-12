/**
 * lib/bbt.ts — Logic thuần của bảng biến thiên (V11)
 *
 * Tách khỏi component để KIỂM THỬ ĐƯỢC bằng unit test. V10 nhét toàn bộ phép
 * tính vị trí mũi tên vào giữa JSX nên không thể viết kiểm thử tự động, và đó là
 * lý do lỗi "mũi tên vẽ theo giá trị số thay vì theo dấu y'" tồn tại suốt.
 */

import type { VariationVisual } from "./types";
import { latexToUnicode } from "./latex";

/**
 * Chuyển một ô của bảng biến thiên sang chữ hiển thị.
 *
 * V11.6 tự viết lấy một bộ thay thế thô sơ ở đây, KHÔNG xử lý dấu mũ, nên nhãn
 * "x^2 - 4x + 3" in ra đúng y như thế trên slide — học sinh đọc thành "x mũ 2"
 * hay "x^2"? V11.7 dùng chung lib/latex.ts với phần còn lại của phần mềm, nên
 * "x^2" ra "x²", "\infty" ra "∞", và mọi chỗ trong bài giảng nhất quán.
 */
export function plainMath(s: string): string {
  // Ô của bảng biến thiên viết LaTeX TRẦN ("-\\infty", "x^2-4x+3"), không bọc
  // trong $...$, nên phải dịch cả chuỗi chứ không dùng mixedLatexToUnicode.
  return latexToUnicode(String(s ?? "")).text;
}

/**
 * Nhãn cột trái của bảng biến thiên: chỉ được là tên hàm ngắn (y, f, g...).
 *
 * Bộ sinh nội dung hay điền nhầm cả biểu thức vào đây ("x^2 - 4x + 3"), và ở cỡ
 * chữ 33 px thì nó tràn qua vạch dọc, đè lên cột giá trị — xem ảnh bài giảng
 * Bài 4. Hàm này cắt nhãn về dạng dùng được; biểu thức đầy đủ được bộ dựng đưa
 * lên dòng nhãn PHÍA TRÊN bảng, đúng cách trình bày của sách giáo khoa.
 */
export function shortLabel(raw: string | undefined, fallback: string): string {
  const t = plainMath(raw ?? "").trim();
  if (!t) return fallback;
  // Đã gọn (y, f, f(x), y₁...) thì giữ nguyên.
  if (t.length <= 4 && !/[+\-=]/.test(t)) return t;
  const m = t.match(/^([a-zA-Zα-ωΑ-Ω][₀-₉0-9]*)\s*(\([^()]*\))?\s*=/);
  if (m) return m[1] + (m[2] ?? "");
  return fallback;
}

/** Bảng này có dòng nhãn phía trên hay không — dùng để tính chiều cao khung vẽ. */
export function hasTableCaption(v: VariationVisual): boolean {
  return tableCaption(v) !== "";
}

/** Biểu thức đầy đủ để ghi thành dòng nhãn phía trên bảng (rỗng nếu không có). */
export function tableCaption(v: VariationVisual): string {
  const name = shortLabel(v.label, "y");
  // Bỏ dấu * : biểu thức được nhập theo lối máy tính ("(x^2+2*x-2)/(x-1)"), nhưng
  // trên slide thì Toán không viết dấu nhân giữa hệ số và biến.
  const expr = plainMath(String(v.expression ?? "").replace(/\*/g, "")).trim();
  if (expr) return `${name} = ${expr}`;
  // label dài chính là biểu thức mà bộ sinh nội dung đặt nhầm chỗ.
  const raw = plainMath(v.label ?? "").trim();
  if (raw && raw !== name) return raw.includes("=") ? raw : `${name} = ${raw}`;
  return "";
}

export function isPlusInf(s: string) {
  const t = plainMath(s).replace(/\s/g, "");
  return t === "∞" || t === "+∞";
}
export function isMinusInf(s: string) {
  return plainMath(s).replace(/\s/g, "") === "-∞";
}

/**
 * Tính độ cao của từng giá trị y trong bảng biến thiên.
 *
 * Nguyên tắc SGK: y′ > 0 thì mũi tên đi lên, y′ < 0 thì đi xuống. Độ cao suy ra
 * từ CHUỖI DẤU ĐẠO HÀM chứ không từ độ lớn của giá trị — vì giá trị có thể là
 * chữ ("m", "3a") hoặc ±∞, không so sánh số học được.
 *
 * ------------------------------------------------------------------------
 * V11.8 — MỖI NHÁNH MỘT THANG RIÊNG
 * ------------------------------------------------------------------------
 * V11.7 dùng MỘT thang độ cao chung cho cả bảng. Với hàm có tiệm cận đứng thì
 * đó là sai về bản chất: hai nhánh hai bên tiệm cận nằm ở hai vùng giá trị khác
 * hẳn nhau, ép chung một thang thì không còn nghĩa gì.
 *
 * Thấy rõ ở y = (x+1)/(x-1): nhánh trái đi từ 1 xuống -∞, nhánh phải đi từ +∞
 * xuống 1. Cả hai số 1 đó bằng nhau nhưng một cái là ĐỈNH của nhánh trái, một
 * cái là ĐÁY của nhánh phải. V11.7 đặt cả hai vào giữa ô, nên mũi tên gần như
 * nằm ngang — xem bài giảng Bài 4, slide 41.
 *
 * V11.8 cắt bảng tại các điểm gián đoạn thành từng NHÁNH, mỗi nhánh tính thang
 * riêng rồi trải hết chiều cao ô. Hàm liên tục chỉ có một nhánh nên không đổi gì.
 *
 * Trả về `level` trong khoảng 0..1 (0 = đáy ô, 1 = đỉnh ô) cho mép trái và mép
 * phải của mỗi mốc.
 */
export function computeLevels(v: VariationVisual): { left: number[]; right: number[] } {
  const n = Math.max(2, v.x.length);
  const der = v.derivative ?? [];
  const full = der.length >= 2 * n - 3;
  const intervalSign = (i: number) => (full ? der[i * 2] : der[i]) ?? "";
  const breaks = new Set((v.discontinuities ?? []).map((d) => d.index));

  // Bậc thô theo chuỗi dấu, RIÊNG cho từng nhánh (bắt đầu lại từ 0 sau mỗi
  // tiệm cận đứng).
  const step = new Array(n).fill(0);
  const rawL = new Array(n).fill(0);
  const rawR = new Array(n).fill(0);
  /** Chỉ số nhánh của mép trái và mép phải mỗi mốc. */
  const branchL = new Array(n).fill(0);
  const branchR = new Array(n).fill(0);

  let branch = 0;
  let cur = 0;
  rawL[0] = rawR[0] = 0;
  branchL[0] = branchR[0] = 0;
  for (let i = 0; i < n - 1; i++) {
    const sign = plainMath(intervalSign(i));
    step[i] = sign.includes("+") ? 1 : sign.includes("-") ? -1 : 0;
    cur = rawR[i] + step[i];
    rawL[i + 1] = cur;
    branchL[i + 1] = branch;
    if (breaks.has(i + 1)) {
      branch += 1;
      cur = 0; // nhánh mới bắt đầu lại
    }
    rawR[i + 1] = cur;
    branchR[i + 1] = branch;
  }

  /**
   * Chuẩn hoá từng nhánh về 0..1. Nhánh chỉ có một bậc (hàm đơn điệu trên cả
   * nhánh, không cực trị) vẫn phải trải từ đáy lên đỉnh, nên xét cả hai mép.
   */
  const out = { left: new Array(n).fill(0.5), right: new Array(n).fill(0.5) };
  const nBranch = branch + 1;
  for (let b = 0; b < nBranch; b++) {
    const vals: number[] = [];
    for (let i = 0; i < n; i++) {
      if (branchL[i] === b) vals.push(rawL[i]);
      if (branchR[i] === b) vals.push(rawR[i]);
    }
    if (!vals.length) continue;
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo;
    const norm = (x: number) => (span > 0 ? (x - lo) / span : 0.5);
    for (let i = 0; i < n; i++) {
      if (branchL[i] === b) out.left[i] = norm(rawL[i]);
      if (branchR[i] === b) out.right[i] = norm(rawR[i]);
    }
  }
  return out;
}

