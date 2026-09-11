/**
 * lib/bbt.ts — Logic thuần của bảng biến thiên (V11)
 *
 * Tách khỏi component để KIỂM THỬ ĐƯỢC bằng unit test. V10 nhét toàn bộ phép
 * tính vị trí mũi tên vào giữa JSX nên không thể viết kiểm thử tự động, và đó là
 * lý do lỗi "mũi tên vẽ theo giá trị số thay vì theo dấu y'" tồn tại suốt.
 */

import type { VariationVisual } from "./types";

export function plainMath(s: string): string {
  return String(s ?? "")
    .replace(/\\infty/g, "∞")
    .replace(/\\pm/g, "±")
    .replace(/\\mp/g, "∓")
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
    .replace(/\\[a-zA-Z]+/g, (m) => m.slice(1))
    .replace(/[{}]/g, "")
    .trim();
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

