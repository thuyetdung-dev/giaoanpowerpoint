/**
 * scripts/build-sample-pptx.mjs — Kiểm thử ĐẦU–CUỐI.
 *
 * Chạy đúng hàm exportPptx() của ứng dụng trong trình duyệt không giao diện,
 * rồi lưu lại tệp .pptx thật. Sau đó scripts/check-pptx.py mở tệp đó ra đo cỡ
 * chữ. Đây là bằng chứng duy nhất đáng tin: đọc mã nguồn không thay cho việc
 * mở tệp PowerPoint ra xem.
 *
 * Chạy:
 *   npx esbuild scripts/_export-entry.tsx --bundle --outfile=/tmp/export-bundle.js \
 *       --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"'
 *   node scripts/build-sample-pptx.mjs
 */

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { LESSON } from "./lesson-sample.mjs";

const css = ["globals", "bbt", "features", "reference", "v9-layout", "v11", "slide"]
  .map((n) => readFileSync(new URL(`../app/${n}.css`, import.meta.url), "utf8"))
  .join("\n");
const katexCss = readFileSync(new URL("../node_modules/katex/dist/katex.min.css", import.meta.url), "utf8");
const bundle = readFileSync("/tmp/export-bundle.js", "utf8");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.on("console", (m) => m.type() === "error" && console.log("  [trình duyệt]", m.text()));

await page.setContent(
  `<!doctype html><meta charset="utf-8"><style>${katexCss}</style><style>${css}</style>` +
    `<div id="root"></div><script>${bundle}</script>`,
);

// Dựng vùng ẩn y như app/page.tsx làm, để bộ xuất tìm được thẻ hình theo data-visual-key.
await page.evaluate((lesson) => {
  const html = lesson.sections
    .map(
      (s, i) =>
        `<article><h3>${s.heading}</h3><p>${s.content}</p><div class="visual-grid">` +
        (s.visuals || [])
          .map((v, j) => `<div class="visual-card ${v.type}" data-visual-key="${i}-${j}">${window.renderVisual(v)}</div>`)
          .join("") +
        `</div></article>`,
    )
    .join("");
  document.getElementById("root").innerHTML = `<div class="export-staging" aria-hidden="true">${html}</div>`;
}, LESSON);

const target = new URL("../.measure/bai_giang_V11_6.pptx", import.meta.url).pathname;
const waitDownload = page.waitForEvent("download", { timeout: 120000 });
await page.evaluate(
  ({ lesson }) =>
    window.exportPptx(document.getElementById("root"), lesson, {
      teacher: "Hồ Thuyết Dũng",
      school: "THPT PHAN ĐĂNG LƯU",
      includeNotes: true,
    }),
  { lesson: LESSON },
);
const download = await waitDownload;
await download.saveAs(target);

const count = await page.evaluate((lesson) => window.buildDeck(lesson, {}).length, LESSON);
await browser.close();
console.log(`Đã dựng ${count} slide -> ${target}`);
