"use client";
/**
 * components/MathText.tsx — Dựng công thức Toán trong CHỮ (V11.7)
 *
 * Tách khỏi MathVisuals.tsx vì cả MathVisuals.tsx lẫn MathVisualsExtra.tsx đều
 * cần dùng. Để nguyên ở MathVisuals.tsx thì MathVisualsExtra phải import ngược
 * lại, tạo vòng lặp import — thứ chạy được lúc này nhưng vỡ khi bộ đóng gói đổi
 * thứ tự nạp mô-đun.
 *
 * VÌ SAO PHẢI CÓ. V11.6 chỉ dựng công thức ở phần gạch đầu dòng của slide. Câu
 * hỏi trắc nghiệm và bảng số liệu in thẳng chuỗi thô, nên học sinh nhìn thấy
 * đúng nguyên văn "$y = \\frac{a}{c}$" trên màn chiếu.
 */

import katex from "katex";

/**
 * `\displaystyle`: phân số giữ cỡ đầy đủ và cận của "lim" nằm ngay dưới, đúng
 * cách viết của sách giáo khoa. Phải khớp với richTextPng() trong
 * lib/exporters.ts, nếu không khung xem trước một đằng, file xuất một nẻo.
 */
export const MathText = ({
  value, display = false, compact = false,
}: { value: string; display?: boolean; compact?: boolean }) => (
  <span
    className={display ? "math display" : "math"}
    dangerouslySetInnerHTML={{
      __html: katex.renderToString(`${compact ? "" : "\\displaystyle "}${String(value ?? "")}`, {
        throwOnError: false,
        displayMode: display,
        strict: "ignore",
        trust: false,
        output: "html",
      }),
    }}
  />
);

/**
 * Đoạn văn có công thức xen kẽ `$...$` hoặc `\( ... \)`.
 *
 * `compact` = dùng cỡ chữ giữa dòng (text style) thay cho cỡ đầy đủ. Dành cho ô
 * chật: phương án trắc nghiệm, ô bảng số liệu. Một phân số cỡ đầy đủ cao 2,4
 * dòng; bốn phương án đều có phân số thì cả thẻ cao gấp rưỡi ô chứa, ảnh bị thu
 * lại và chữ tụt xuống 24 pt — thà để phân số nhỏ gọn mà chữ đủ to.
 */
export function MixedMath({ value, compact = false }: { value: string; compact?: boolean }) {
  const clean = String(value ?? "").normalize("NFC").replace(/`\s+/g, " ");
  const parts = clean.split(/(\$[^$]+\$|\\\([\s\S]*?\\\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const math =
          part.startsWith("$") && part.endsWith("$")
            ? part.slice(1, -1)
            : part.startsWith("\\(") && part.endsWith("\\)")
            ? part.slice(2, -2)
            : null;
        return math !== null ? <MathText key={i} value={math} compact={compact} /> : <span key={i}>{part}</span>;
      })}
    </>
  );
}
