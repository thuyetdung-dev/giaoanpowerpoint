/**
 * scripts/measure-visuals.mjs — Đo CỠ CHỮ THẬT của hình Toán khi in lên slide.
 *
 * Vì sao cần: chữ bên trong hình được ghi bằng px trong khung vẽ SVG, nhưng ảnh
 * sau đó bị thu cho vừa ô hình trên slide PowerPoint. Cỡ chữ thật mà học sinh
 * nhìn thấy = px trong khung × hệ số thu. Không đo thì không biết.
 *
 * Cách chạy:  node scripts/measure-visuals.mjs
 * Trước đó:   npx esbuild scripts/_entry.tsx --bundle --outfile=/tmp/vis-bundle.js \
 *               --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"'
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { katexCssWithFonts } from "./katex-css.mjs";
/* SAMPLES=hinh dùng bộ rà soát mở rộng (nhiều ca mỗi loại); để trống dùng bộ
   một-mẫu-mỗi-loại cho phép đo cỡ chữ. */
const { SAMPLES } = await import(process.env.SAMPLES === "hinh" ? "./samples-hinh.mjs" : "./samples.mjs");

/* Ô ảnh trên slide, quy ra point. Số lấy TỪ CHÍNH lib/slides.ts qua bundle, để
   khi bố cục đổi thì bộ đo đổi theo, không phải nhớ sửa hai chỗ. */
const TARGET_PT = 32;

const css = ["globals", "bbt", "features", "reference", "v9-layout", "v11", "slide"]
  .map((n) => readFileSync(new URL(`../app/${n}.css`, import.meta.url), "utf8"))
  .join("\n");
const katexCss = katexCssWithFonts();

/* Tự dựng lại bundle MỖI LẦN chạy.
   Trước đây phải gõ lệnh esbuild bằng tay trước khi đo. Có lần tôi quên, bộ đo
   đọc bundle cũ và tôi ngồi xem ẢNH CỦA BẢN TRƯỚC rồi tưởng là bản mới — sai
   nguy hiểm hơn cả không đo. Nay bundle được dựng ngay trong bộ đo nên không
   còn khe hở đó. (esbuild chỉ là công cụ đo, KHÔNG nằm trong package.json để
   Vercel không phải tải về.) */
const BUNDLE = "/tmp/vis-bundle.js";
execFileSync(new URL("../node_modules/.bin/esbuild", import.meta.url).pathname, [
  new URL("./_entry.tsx", import.meta.url).pathname,
  "--bundle", `--outfile=${BUNDLE}`, "--format=iife", "--jsx=automatic",
  '--define:process.env.NODE_ENV="production"',
], { cwd: new URL("../", import.meta.url).pathname, stdio: ["ignore", "ignore", "inherit"] });
const bundle = readFileSync(BUNDLE, "utf8");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.setContent(
  `<!doctype html><meta charset="utf-8"><style>${katexCss}</style><style>${css}</style>` +
    // Đưa vùng dựng ẩn ra chỗ nhìn thấy được để chụp ảnh kiểm tra bằng mắt.
    `<style>#stage{position:static!important;left:auto!important;z-index:auto!important;background:#fff}</style>` +
    `<div class="export-staging" id="stage"></div><script>${bundle}</script>`,
);

const THUMUC = process.env.SAMPLES === "hinh" ? "../.measure/hinh/" : "../.measure/";
mkdirSync(new URL(THUMUC, import.meta.url), { recursive: true });

const rows = [];
for (const [name, visual] of Object.entries(SAMPLES)) {
  const result = await page.evaluate(
    ({ visual }) => {
      const { IMG_W_PT, IMG_H_PT } = window.IMG_BOX;
      const stage = document.getElementById("stage");
      stage.innerHTML = `<article><div class="visual-grid"><div class="visual-card ${visual.type}" data-visual-key="0-0">${window.renderVisual(visual)}</div></div></article>`;
      const card = stage.querySelector(".visual-card");
      const svg = card.querySelector("svg");

      // Kích thước ảnh sẽ chụp: SVG lấy theo viewBox, HTML lấy theo bố cục thật.
      let w, h;
      if (svg) {
        const vb = svg.viewBox.baseVal;
        w = vb.width;
        h = vb.height;
      } else {
        const r = card.getBoundingClientRect();
        w = r.width;
        h = r.height;
      }
      const scale = Math.min(IMG_W_PT / w, IMG_H_PT / h);

      /**
       * Đo CỠ CHỮ NỀN — cỡ mà học sinh đọc dòng chữ.
       *
       * Không đo từng mảnh bên trong công thức: số mũ, tử và mẫu của phân số
       * vốn nhỏ hơn chữ nền (khoảng 0,7 lần) theo đúng quy ước sắp chữ Toán,
       * sách in cũng vậy. Đòi chúng đạt 32 pt thì phải phóng cả công thức lên
       * gần gấp rưỡi, slide sẽ không chứa nổi. Vì thế với hình dựng bằng HTML
       * chỉ lấy cỡ chữ của các Ô CHỨA DÒNG (p, li, ô bảng, phương án trắc
       * nghiệm), còn phần bên trong .katex thì bỏ qua.
       */
      const seen = new Map();
      const nodes = svg
        ? svg.querySelectorAll("text")
        : card.querySelectorAll("p, li, td, th, .quiz-option > span, .quiz-option > b, .visual-caption, .formula-block > .math");
      nodes.forEach((el) => {
        const text = (el.textContent || "").replace(/[\u200b\u00a0\s]+/g, " ").trim();
        if (!text) return;
        const px = parseFloat(getComputedStyle(el).fontSize);
        if (!px) return;
        const key = Math.round(px);
        if (!seen.has(key)) seen.set(key, text.slice(0, 22));
      });
      return {
        w, h, scale,
        sizes: [...seen.entries()].map(([px, sample]) => ({ px, sample })).sort((a, b) => a.px - b.px),
      };
    },
    { visual },
  );

  const sizes = result.sizes.map((s) => ({ ...s, pt: +(s.px * result.scale).toFixed(1) }));
  const minPt = sizes.length ? Math.min(...sizes.map((s) => s.pt)) : 0;
  rows.push({ name, type: visual.type, canvas: `${Math.round(result.w)}×${Math.round(result.h)}`,
              scale: +result.scale.toFixed(3), minPt, sizes });

  const card = await page.locator(".visual-card").first();
  await card.screenshot({ path: new URL(`${THUMUC}${name}.png`, import.meta.url).pathname }).catch(() => {});
}

await browser.close();

let bad = 0;
console.log("\nCỠ CHỮ TRONG HÌNH KHI IN LÊN SLIDE (ngưỡng " + TARGET_PT + " pt)\n");
console.log("hình".padEnd(22), "khung".padEnd(11), "hệ số".padEnd(7), "nhỏ nhất", " kết quả");
console.log("-".repeat(72));
for (const r of rows) {
  const ok = r.minPt >= TARGET_PT - 0.6;
  if (!ok) bad++;
  console.log(
    r.name.padEnd(22),
    r.canvas.padEnd(11),
    String(r.scale).padEnd(7),
    (r.minPt + " pt").padEnd(9),
    ok ? "ĐẠT" : "CHƯA ĐẠT  " + r.sizes.filter((s) => s.pt < TARGET_PT - 0.6).map((s) => `${s.pt}pt "${s.sample}"`).join(", "),
  );
}
writeFileSync(new URL(`${THUMUC}report.json`, import.meta.url), JSON.stringify(rows, null, 2));
console.log(`\n${rows.length - bad}/${rows.length} hình đạt. Ảnh dựng thử nằm trong ${THUMUC.replace("../", "")}`);
process.exit(bad ? 1 : 0);
