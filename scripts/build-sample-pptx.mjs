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
import { execFileSync } from "node:child_process";
import { katexCssWithFonts } from "./katex-css.mjs";
/* Chọn bài giảng qua biến môi trường LESSON:
     (mặc định) lesson-sample.mjs — Bài 1, dùng kiểm tra cỡ chữ
     bai4                        — Bài 4, dùng kiểm tra công thức Toán */
const mod =
  process.env.LESSON === "bai4" ? "./lesson-bai4.mjs"
  : process.env.LESSON === "khaosat" ? "./lesson-khaosat.mjs"
  : "./lesson-sample.mjs";
const { LESSON } = await import(mod);

const css = ["globals", "bbt", "features", "reference", "v9-layout", "v11", "slide"]
  .map((n) => readFileSync(new URL(`../app/${n}.css`, import.meta.url), "utf8"))
  .join("\n");
const katexCss = katexCssWithFonts();
/* Tự dựng lại bundle mỗi lần chạy — xem lời giải thích trong
   scripts/measure-visuals.mjs. Tôi đã một lần đo tệp PowerPoint dựng từ bundle
   cũ và tưởng bản mới còn lỗi dấu thập phân; đo vào bản cũ thì kết luận nào
   cũng vô nghĩa. */
const BUNDLE = "/tmp/export-bundle.js";
execFileSync(new URL("../node_modules/.bin/esbuild", import.meta.url).pathname, [
  new URL("./_export-entry.tsx", import.meta.url).pathname,
  "--bundle", `--outfile=${BUNDLE}`, "--format=iife", "--jsx=automatic",
  '--define:process.env.NODE_ENV="production"',
], { cwd: new URL("../", import.meta.url).pathname, stdio: ["ignore", "ignore", "inherit"] });
const bundle = readFileSync(BUNDLE, "utf8");

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

const target = new URL(`../.measure/${process.env.OUT || "bai_giang_V11_6"}.pptx`, import.meta.url).pathname;
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
const rich = await page.evaluate(() => window.richMathReport());
await browser.close();

console.log(`Đã dựng ${count} slide -> ${target}`);
if (rich.length) {
  const nho = rich.filter((r) => r.actualPt < 31.9);
  console.log(`\n${rich.length} khối chữ được dựng bằng KaTeX (phân số, lim, chỉ số chữ).`);
  if (nho.length) {
    console.log(`✗ ${nho.length} khối bị thu nhỏ dưới 32 pt:`);
    nho.forEach((r) => console.log(`   ${r.actualPt} pt (đặt ${r.targetPt})  “${r.text}”`));
    process.exitCode = 1;
  } else {
    console.log("✓ Mọi khối công thức giữ đúng cỡ chữ đã chốt.");
  }
}
