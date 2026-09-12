/**
 * scripts/katex-css.mjs — Nạp CSS của KaTeX kèm PHÔNG dưới dạng data URI.
 *
 * Vì sao cần: katex.min.css trỏ tới phông bằng đường dẫn tương đối
 * (url(fonts/KaTeX_Main-Regular.woff2)). Trong ứng dụng Next.js, webpack tự viết
 * lại đường dẫn nên phông nạp được. Nhưng trong bộ kiểm chứng, trang được nạp
 * bằng setContent() không có địa chỉ gốc, phông hỏng và trình duyệt rơi về phông
 * hệ thống — khi đó "ℝ" thành "R", "≠" có thể mất nét gạch.
 *
 * Nếu không xử lý, bộ kiểm chứng sẽ báo lỗi ở chỗ không có lỗi, và tệ hơn là bỏ
 * sót lỗi thật. Ở đây phông được nhúng thẳng vào CSS để bản kiểm chứng giống hệt
 * bản chạy thật.
 */
import { readFileSync, readdirSync } from "node:fs";

export function katexCssWithFonts() {
  const dir = new URL("../node_modules/katex/dist/fonts/", import.meta.url);
  const embedded = new Map();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".woff2")) continue;
    const b64 = readFileSync(new URL(f, dir)).toString("base64");
    embedded.set(f, `data:font/woff2;base64,${b64}`);
  }
  let css = readFileSync(new URL("../node_modules/katex/dist/katex.min.css", import.meta.url), "utf8");
  // Chỉ giữ nguồn woff2 (đã nhúng), bỏ woff/ttf để CSS không phình vô ích.
  css = css.replace(/url\(fonts\/([^)]+)\)\s*format\("(woff2|woff|truetype)"\)/g, (m, file, fmt) => {
    if (fmt !== "woff2") return 'url(about:blank) format("woff")';
    const data = embedded.get(file);
    return data ? `url(${data}) format("woff2")` : m;
  });
  return css;
}
