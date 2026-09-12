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
import { SAMPLES } from "./samples.mjs";

/* Ô ảnh trên slide, quy ra point — khớp với lib/slides.ts */
const IMG_W_PT = (12.1 - 0.3) * 72; // 849,6
const IMG_H_PT = (5.64 - 0.3 - 0.08) * 72; // 378,7
const TARGET_PT = 32;

const css = ["globals", "bbt", "features", "reference", "v9-layout", "v11", "slide"]
  .map((n) => readFileSync(new URL(`../app/${n}.css`, import.meta.url), "utf8"))
  .join("\n");
const katexCss = readFileSync(new URL("../node_modules/katex/dist/katex.min.css", import.meta.url), "utf8");
const bundle = readFileSync("/tmp/vis-bundle.js", "utf8");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.setContent(
  `<!doctype html><meta charset="utf-8"><style>${katexCss}</style><style>${css}</style>` +
    // Đưa vùng dựng ẩn ra chỗ nhìn thấy được để chụp ảnh kiểm tra bằng mắt.
    `<style>#stage{position:static!important;left:auto!important;z-index:auto!important;background:#fff}</style>` +
    `<div class="export-staging" id="stage"></div><script>${bundle}</script>`,
);

mkdirSync(new URL("../.measure/", import.meta.url), { recursive: true });

const rows = [];
for (const [name, visual] of Object.entries(SAMPLES)) {
  const result = await page.evaluate(
    ({ visual, IMG_W_PT, IMG_H_PT }) => {
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

      // Mọi cỡ chữ xuất hiện trong hình, kèm mẫu chữ để biết đó là gì.
      const seen = new Map();
      const nodes = svg ? svg.querySelectorAll("text") : card.querySelectorAll("*");
      nodes.forEach((el) => {
        const text = (el.textContent || "").replace(/[\u200b\u00a0\s]+/g, " ").trim();
        if (!text) return;
        if (!svg && el.children.length) return; // chỉ lấy nút lá với HTML
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
    { visual, IMG_W_PT, IMG_H_PT },
  );

  const sizes = result.sizes.map((s) => ({ ...s, pt: +(s.px * result.scale).toFixed(1) }));
  const minPt = sizes.length ? Math.min(...sizes.map((s) => s.pt)) : 0;
  rows.push({ name, type: visual.type, canvas: `${Math.round(result.w)}×${Math.round(result.h)}`,
              scale: +result.scale.toFixed(3), minPt, sizes });

  const card = await page.locator(".visual-card").first();
  await card.screenshot({ path: new URL(`../.measure/${name}.png`, import.meta.url).pathname }).catch(() => {});
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
writeFileSync(new URL("../.measure/report.json", import.meta.url), JSON.stringify(rows, null, 2));
console.log(`\n${rows.length - bad}/${rows.length} loại hình đạt. Ảnh dựng thử nằm trong .measure/`);
process.exit(bad ? 1 : 0);
