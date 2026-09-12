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
  const expr = plainMath(v.expression ?? "").trim();
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
 * Nguyên tắc SGK: y' > 0 -> mũi tên đi lên (bậc +1), y' < 0 -> đi xuống (bậc -1).
 * Trả về mảng bậc cho mép trái/mép phải của mỗi mốc (mốc gián đoạn có 2 bậc).
 */
export function computeLevels(v: VariationVisual): { left: number[]; right: number[] } {
  const n = Math.max(2, v.x.length);
  const der = v.derivative ?? [];
  const full = der.length >= 2 * n - 3;
  const intervalSign = (i: number) => (full ? der[i * 2] : der[i]) ?? "";
  const breaks = new Set((v.discontinuities ?? []).map((d) => d.index));

  const left = new Array(n).fill(0);
  const right = new Array(n).fill(0);
  let cur = 0;
  right[0] = cur;
  left[0] = cur;

  for (let i = 0; i < n - 1; i++) {
    const s = plainMath(intervalSign(i));
    const step = s.includes("+") ? 1 : s.includes("-") ? -1 : 0;
    cur = right[i] + step;
    left[i + 1] = cur;
    if (breaks.has(i + 1)) {
      // qua tiệm cận đứng: nhánh phải bắt đầu lại ở phía đối diện
      const d = (v.discontinuities ?? []).find((x) => x.index === i + 1);
      const rightIsUp = d ? isPlusInf(d.rightValue) : false;
      const rightIsDown = d ? isMinusInf(d.rightValue) : false;
      right[i + 1] = rightIsUp ? cur + 2 : rightIsDown ? cur - 2 : cur;
      cur = right[i + 1];
    } else {
      right[i + 1] = cur;
    }
  }
  return { left, right };
}

