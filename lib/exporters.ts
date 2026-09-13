/**
 * lib/exporters.ts — Xuất PowerPoint / HTML / PNG (V11)
 *
 * Những gì V10 làm chưa tốt và đã được sửa ở đây:
 *
 * 1. MẤT CÔNG THỨC KHI XUẤT. cleanText() của V10 xoá mọi lệnh LaTeX chưa liệt kê
 *    => "\sqrt{x+1}" thành "x+1". V11 dùng lib/latex.ts, giữ nguyên ký hiệu.
 * 2. HÌNH BỊ RỖ. V10 chụp màn hình bằng html2canvas (ảnh raster, phụ thuộc CSS
 *    ngoài, hay lỗi với màu hiện đại). V11 tuần tự hoá thẳng SVG, nội tuyến hoá
 *    style rồi vẽ lên canvas ở 3x — nét gọn, không phụ thuộc stylesheet.
 * 3. MẤT HÌNH. V10 chỉ lấy 2 hình đầu mỗi slide (`Math.min(2, visuals.length)`),
 *    hình thứ ba trở đi biến mất không cảnh báo. V11 tự tràn sang slide "(tiếp)".
 * 4. KHÔNG CÓ GHI CHÚ GIÁO VIÊN. V10 có checkbox "Tạo ghi chú" nhưng không dùng.
 *    V11 ghi vào phần Notes của PowerPoint.
 * 5. PHÔNG CHỮ. V10 dùng Aptos (chỉ có trên Microsoft 365 mới) => vỡ bố cục trên
 *    máy trường học. V11 lấy phông từ theme, mặc định Calibri/Times New Roman.
 * 6. THIẾU TRỢ NĂNG. V11 thêm altText cho mọi hình, đặt tiêu đề slide đúng chuẩn.
 *
 * ------------------------------------------------------------------------
 * V11.6 — CỠ CHỮ ĐỌC ĐƯỢC TỪ CUỐI LỚP
 * ------------------------------------------------------------------------
 * 7. CHỮ QUÁ NHỎ. V11.5 tự hạ cỡ chữ xuống tới 17 pt để nhét cho vừa slide, và
 *    còn bật `fit: "shrink"` để PowerPoint hạ tiếp. Nay mọi chữ nội dung nằm
 *    trong 32–36 pt (lib/slides.ts, hằng TYPO); thừa chữ thì SANG SLIDE MỚI chứ
 *    không thu nhỏ.
 * 8. HÌNH BỊ BÓP. V11.5 nhét hình vào ô rộng 7,3 in bên phải khối chữ, nên chữ
 *    bên trong bảng biến thiên chỉ còn 13–15 pt trên slide. Nay mỗi slide một
 *    hình, hình trải hết bề ngang, và cỡ chữ trong hình được tính ngược từ ô
 *    chứa (svgFontPx trong lib/slides.ts).
 * 9. XEM TRƯỚC MỘT ĐẰNG, FILE MỘT NẺO. V11.5 dựng lại vòng lặp slide riêng ở
 *    tệp này. Nay exportPptx đi theo đúng buildDeck() mà khung xem trước dùng.
 */

import type { Lesson, Visual } from "./types";
import { getTheme, PHASE_META, VISUAL_LABEL, type Theme } from "./themes";
import { latexToUnicode, mixedLatexToUnicode, needsRichMath, splitMathSegments } from "./latex";
import {
  LAYOUT, SLIDE_W_IN, TYPO, buildDeck, objectivesBox, textBandBox, toBullets as splitBullets,
  visualBox, visualImageBox, type Box,
} from "./slides";
import { APP_LABEL } from "./version";

const PPTX_VERSION = "4.0.1";

function safeName(s: string) {
  return String(s || "bai_giang")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 70) || "bai_giang";
}

/**
 * V10 nạp pptxgenjs từ CDN jsDelivr ngay lúc bấm "Xuất PowerPoint". Mạng nhà
 * trường thường chặn CDN, và khi đó giáo viên mất trắng công soạn ngay ở bước
 * cuối. V11 đóng gói thư viện vào ứng dụng (dynamic import) — vẫn tách chunk nên
 * không làm nặng lần tải đầu — và chỉ dùng CDN như phương án dự phòng.
 */
async function loadPptx(): Promise<any> {
  const w = window as unknown as { PptxGenJS?: any };
  if (w.PptxGenJS) return w.PptxGenJS;
  try {
    // Bản bundle dành cho trình duyệt: không kéo theo fs/https của Node.
    const mod: any = await import("pptxgenjs");
    const Ctor = mod?.default ?? mod?.PptxGenJS ?? w.PptxGenJS;
    if (Ctor) return Ctor;
  } catch {
    /* rơi xuống phương án CDN */
  }
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://cdn.jsdelivr.net/npm/pptxgenjs@${PPTX_VERSION}/dist/pptxgen.bundle.js`;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Không tải được bộ xuất PowerPoint. Kiểm tra kết nối mạng rồi thử lại."));
    document.head.appendChild(s);
  });
  if (!w.PptxGenJS) throw new Error("Bộ xuất PowerPoint chưa sẵn sàng");
  return w.PptxGenJS;
}

/* ------------------------------------------------------------------ */
/* Ảnh hoá hình Toán                                                   */
/* ------------------------------------------------------------------ */

const STYLE_PROPS = [
  "font-family", "font-size", "font-weight", "font-style", "fill", "stroke",
  "stroke-width", "stroke-dasharray", "text-anchor", "opacity", "fill-opacity",
  "stroke-opacity", "dominant-baseline", "letter-spacing",
  // V11.6: thiếu paint-order thì nét viền trắng quanh chữ (lớp .svg-halo) sẽ
  // được vẽ ĐÈ lên phần tô, nhãn trên đồ thị hoá ra rỗng ruột khi xuất ảnh.
  "paint-order", "stroke-linejoin",
];

/** Sao chép style từ stylesheet vào thuộc tính inline để SVG tự đứng độc lập. */
function inlineStyles(source: Element, clone: Element) {
  const computed = window.getComputedStyle(source);
  const decl: string[] = [];
  for (const prop of STYLE_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== "none" && value !== "normal") decl.push(`${prop}:${value}`);
  }
  if (decl.length) clone.setAttribute("style", decl.join(";"));
  const srcChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);
  srcChildren.forEach((c, i) => cloneChildren[i] && inlineStyles(c, cloneChildren[i]));
}

/** Chuyển một thẻ <svg> trên trang thành ảnh PNG nét cao (thay cho html2canvas). */
export async function svgToPng(svg: SVGSVGElement, scale = 3): Promise<{ data: string; w: number; h: number }> {
  const vb = svg.viewBox.baseVal;
  const width = vb && vb.width ? vb.width : svg.clientWidth || 800;
  const height = vb && vb.height ? vb.height : svg.clientHeight || 450;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const xml = new XMLSerializer().serializeToString(clone);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = new Image();
  img.decoding = "sync";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Không dựng được hình Toán thành ảnh"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL("image/png"), w: width, h: height };
}

/** Với thẻ không phải SVG (công thức KaTeX, bảng số liệu) mới cần html2canvas. */
async function htmlToPng(node: HTMLElement, scale = 3, bg = "#ffffff"): Promise<{ data: string; w: number; h: number }> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(node, { scale, backgroundColor: bg, useCORS: true, logging: false });
  return { data: canvas.toDataURL("image/png"), w: canvas.width / scale, h: canvas.height / scale };
}

async function nodeToPng(node: HTMLElement): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const htmlMath = node.matches?.("[data-export-html]")
      ? node
      : node.querySelector<HTMLElement>("[data-export-html]");
    if (htmlMath) return await htmlToPng(htmlMath);
    const svg = node.tagName.toLowerCase() === "svg" ? (node as unknown as SVGSVGElement) : node.querySelector("svg");
    if (svg) return await svgToPng(svg);
    return await htmlToPng(node);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Dựng công thức Toán bằng KaTeX                                      */
/* ------------------------------------------------------------------ */

/**
 * Bề rộng (px) của khung dựng tạm. Ảnh chụp ra được đặt vừa bề ngang ô chữ trên
 * slide, nên cỡ chữ thật trên slide = px × (bề_ngang_ô_tính_bằng_pt / số này).
 * Chọn 1600 px: đủ nét khi chụp ở 2x mà vẫn nhẹ.
 */
const RICH_W_PX = 1600;

/**
 * Nhật ký của lần xuất gần nhất. Khối chữ dựng thành ảnh KHÔNG đo được cỡ chữ
 * bằng cách mở tệp .pptx ra đọc (nó là ảnh, không phải chữ), nên bộ xuất tự ghi
 * lại: mỗi khối đã in ra bao nhiêu point thật. scripts/build-sample-pptx.mjs
 * đọc mảng này để báo lỗi nếu có khối nào tụt dưới ngưỡng 32 pt.
 */
export type RichMathReport = { text: string; targetPt: number; actualPt: number };
export const lastRichMathReport: RichMathReport[] = [];

/**
 * Dựng một khối chữ có công thức thành ảnh.
 *
 * VÌ SAO PHẢI LÀM THẾ. PowerPoint chỉ nhận chữ thường trong một ô văn bản, mà
 * Unicode không có phân số hai tầng, cũng không có chỉ số bằng chữ cái, cũng
 * không đặt được cận xuống dưới chữ "lim". V11.6 vì thế in ra "(ax+b)/(cx+d)"
 * và "limₓ →-∞" — sai so với cách viết của sách giáo khoa.
 *
 * Ở đây khối chữ được dàn bằng KaTeX (chính bộ dựng đã cho ra công thức đẹp ở
 * slide "CÔNG THỨC") rồi chụp lại thành ảnh. Chỉ những khối CÓ công thức kiểu ấy
 * mới thành ảnh — xem needsRichMath() — nên phần lớn slide vẫn là chữ thật, sửa
 * được trong PowerPoint.
 */
async function richTextPng(
  stage: HTMLElement,
  items: string[],
  boxWIn: number,
  pt: number,
  t: Theme,
  asTitle = false,
  /** Màu nền của khung sẽ đặt ảnh. Để trắng thì ảnh hiện thành mảng trắng
      nổi rõ trên nền panel xanh nhạt — lỗi thấy ngay trên slide. */
  bg = "FFFFFF",
): Promise<{ data: string; w: number; h: number } | null> {
  if (!items.length) return null;
  const katex = (await import("katex")).default;

  const esc = (x: string) =>
    x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const render = (raw: string) =>
    splitMathSegments(raw)
      .map((seg) => {
        if (!seg.math) return esc(seg.value);
        try {
          /**
           * \displaystyle: KaTeX mặc định thu nhỏ phân số khi nằm giữa dòng chữ
           * (text style), và đẩy cận của "lim" ra sau thành chỉ số. Sách giáo
           * khoa Toán viết phân số cỡ đầy đủ và cận nằm NGAY DƯỚI chữ lim —
           * đúng như thầy giáo sửa tay trong bản góp ý. Cỡ đầy đủ cũng dễ nhìn
           * hơn hẳn khi chiếu lên màn.
           */
          const html = katex.renderToString(`\\displaystyle ${seg.value}`, {
            throwOnError: false, displayMode: false, strict: "ignore", trust: false, output: "html",
          });
          return `<span class="math-keep">${html}</span>`;
        } catch {
          return esc(mixedLatexToUnicode(seg.value).text);
        }
      })
      .join("");

  // Cỡ chữ nguồn tính ngược từ ô chứa: px × (boxW_pt / RICH_W_PX) = pt.
  const fontPx = (pt * RICH_W_PX) / (boxWIn * 72);
  const host = document.createElement("div");
  host.setAttribute("data-rich-math", "1");
  host.style.cssText = `position:absolute;left:0;top:0;width:${RICH_W_PX}px;background:#${bg};`;
  const body = asTitle
    ? `<p class="as-title">${render(items[0])}</p>`
    : items.length > 1
    ? `<ul>${items.map((b) => `<li>${render(b)}</li>`).join("")}</ul>`
    : `<p>${render(items[0])}</p>`;
  const face = asTitle ? t.headFont : t.bodyFont;
  host.innerHTML =
    `<div class="rich-math" style="width:${RICH_W_PX}px;font-size:${fontPx}px;color:#${t.ink};` +
    `background:#${bg};font-family:'${face}',Calibri,Arial,sans-serif">${body}</div>`;
  stage.appendChild(host);
  try {
    return await htmlToPng(host.firstElementChild as HTMLElement, 2, `#${bg}`);
  } finally {
    host.remove();
  }
}

/* ------------------------------------------------------------------ */
/* Chữ trên slide                                                      */
/* ------------------------------------------------------------------ */

export function toSlideText(raw: string): string {
  return mixedLatexToUnicode(raw).text;
}

/**
 * Tách nội dung thành các gạch đầu dòng, giữ nguyên dấu âm trong công thức.
 * Dùng chung quy tắc với lib/slides.ts để xem trước và file xuất ra khớp nhau.
 */
export function toBullets(raw: string): string[] {
  return splitBullets(toSlideText(raw));
}

/* ------------------------------------------------------------------ */
/* Khung slide                                                         */
/* ------------------------------------------------------------------ */

type Meta = { teacher?: string; school?: string; limitSlides?: number; includeNotes?: boolean };

/**
 * Tiêu đề slide cũng có thể chứa công thức ("Ví dụ 3: Khảo sát hàm số
 * $y=\\frac{x+1}{x-1}$"). Khi đó dựng KaTeX thành ảnh y như khối chữ.
 */
async function addTitle(slide: any, t: Theme, raw: string, hasBadge: boolean, stage: HTMLElement) {
  const L = LAYOUT.title;
  const box = { x: L.x, y: L.y, w: hasBadge ? L.wNarrow : L.wWide, h: L.h };
  if (needsRichMath(raw)) {
    const png = await richTextPng(stage, [raw], box.w, L.pt, t, true, t.bg).catch(() => null);
    if (png) {
      const ratio = png.w / png.h;
      let w = box.w;
      let h = w / ratio;
      if (h > box.h) { h = box.h; w = h * ratio; }
      slide.addImage({ data: png.data, x: box.x, y: box.y + (box.h - h) / 2, w, h, altText: mixedLatexToUnicode(raw).text });
      return;
    }
  }
  slide.addText(mixedLatexToUnicode(raw).text, {
    x: box.x, y: box.y, w: box.w, h: box.h,
    fontFace: t.headFont, fontSize: L.pt, bold: true, color: t.ink, margin: 0, valign: "mid", fit: "shrink",
  });
}

function addChrome(slide: any, t: Theme, index: number, phase?: string) {
  slide.background = { color: t.bg };
  const L = LAYOUT;
  slide.addShape("rect", { x: L.topBar.x, y: L.topBar.y, w: L.topBar.w, h: L.topBar.h, fill: { color: t.primary }, line: { transparency: 100 } });
  const meta = phase ? PHASE_META[phase] : undefined;
  slide.addShape("rect", {
    x: L.accentBar.x, y: L.accentBar.y, w: L.accentBar.w, h: L.accentBar.h,
    fill: { color: meta?.color || t.accent }, line: { transparency: 100 },
  });
  // Tiêu đề do addTitle() vẽ riêng, vì nó có thể phải dựng bằng KaTeX.
  slide.addText(String(index).padStart(2, "0"), {
    x: L.pageNo.x, y: L.pageNo.y, w: L.pageNo.w, h: L.pageNo.h, fontFace: t.bodyFont, fontSize: L.pageNo.pt, bold: true,
    color: t.muted, align: "right", margin: 0,
  });
  slide.addShape("line", { x: L.divider.x, y: L.divider.y, w: L.divider.w, h: 0, line: { color: t.line, width: 1 } });
}

function addFooter(slide: any, t: Theme, lesson: Lesson, sectionNo?: number) {
  slide.addText(`${lesson.subject || "Toán"} · Lớp ${lesson.grade || "THPT"}${lesson.book ? " · " + lesson.book : ""}${sectionNo !== undefined ? ` · Mục ${String(sectionNo + 1).padStart(2, "0")}` : ""}`, {
    x: 0.62, y: LAYOUT.footer.y, w: 7, h: LAYOUT.footer.h, fontFace: t.bodyFont, fontSize: LAYOUT.footer.pt, color: t.muted, margin: 0,
  });
  slide.addText(APP_LABEL, {
    x: 10.4, y: LAYOUT.footer.y, w: 2.3, h: LAYOUT.footer.h, fontFace: t.bodyFont, fontSize: LAYOUT.footer.pt,
    color: t.muted, align: "right", margin: 0,
  });
}

/**
 * Đặt một khối gạch đầu dòng lên slide ở ĐÚNG cỡ chữ đã chốt.
 *
 * Khác V11.5: không truyền `fit: "shrink"`. PowerPoint được phép thu nhỏ chữ là
 * PowerPoint sẽ thu — và đó chính là cách bài giảng tụt về 18 pt mà giáo viên
 * không hay biết. Ở đây lib/slides.ts đã tính trước số slide cần dùng, nên khối
 * chữ chắc chắn vừa mà không phải thu.
 */
/**
 * Đặt khối chữ lên slide, tự chọn giữa CHỮ THẬT và ẢNH KATEX.
 *
 * `rich = false` -> chữ thật, sửa được trong PowerPoint (đa số slide).
 * `rich = true`  -> cả khối dựng bằng KaTeX rồi chụp thành ảnh, vì có phân số
 *                   hai tầng / lim có cận / chỉ số bằng chữ cái.
 *
 * Ảnh luôn đặt VỪA BỀ NGANG ô, nên cỡ chữ trên slide đúng bằng `pt` đã chốt —
 * không có chuyện ảnh bị thu lại làm chữ nhỏ đi. Nếu ảnh cao hơn ô (công thức
 * nhiều tầng hơn dự tính) thì mới hạ theo chiều cao, và hàm báo lại để bộ kiểm
 * chứng bắt được.
 */
async function addTextBlock(
  slide: any, t: Theme, bullets: string[], box: Box, pt: number,
  rich: boolean, stage: HTMLElement, bg: string,
): Promise<void> {
  if (!bullets.length) return;
  if (rich) {
    const png = await richTextPng(stage, bullets, box.w, pt, t, false, bg).catch(() => null);
    if (png) {
      const ratio = png.w / png.h;
      let w = box.w;
      let h = w / ratio;
      // Ảnh cao hơn ô thì buộc phải thu theo chiều dọc, và chữ nhỏ đi theo. Ghi
      // lại để bộ kiểm chứng bắt được, đừng để nó lặng lẽ tụt dưới 32 pt.
      if (h > box.h) { h = box.h; w = h * ratio; }
      lastRichMathReport.push({
        text: bullets.map((b) => mixedLatexToUnicode(b).text).join(" ").slice(0, 60),
        targetPt: pt,
        actualPt: Math.round((pt * (w / box.w)) * 10) / 10,
      });
      slide.addImage({
        data: png.data, x: box.x, y: box.y, w, h,
        altText: bullets.map((b) => mixedLatexToUnicode(b).text).join(" "),
      });
      return;
    }
    // Dựng ảnh hỏng thì vẫn phải có chữ, thà xấu còn hơn slide trống.
  }
  addBullets(slide, t, bullets.map((b) => mixedLatexToUnicode(b).text), box, pt);
}

function addBullets(slide: any, t: Theme, bullets: string[], box: Box, pt: number) {
  if (!bullets.length) return;
  const body =
    bullets.length > 1
      ? bullets.map((b) => ({ text: b, options: { breakLine: true, bullet: { indent: 22 }, paraSpaceAfter: 10 } }))
      : bullets[0];
  slide.addText(body, {
    x: box.x, y: box.y, w: box.w, h: box.h,
    fontFace: t.bodyFont, fontSize: pt, color: t.ink, valign: "top", margin: 0.06, lineSpacingMultiple: 1.05,
  });
}

function visualAlt(v: Visual): string {
  const label = VISUAL_LABEL[v.type] || "Hình minh hoạ";
  if (v.type === "graph") return `${label}: y = ${latexToUnicode(v.expression).text}`;
  if (v.type === "formula") return `${label}: ${latexToUnicode(v.latex).text}`;
  if (v.type === "variation_table") return `${label} với các mốc ${v.x.map((x) => latexToUnicode(x).text).join(", ")}`;
  return label;
}

/* ------------------------------------------------------------------ */
/* Xuất PowerPoint                                                     */
/* ------------------------------------------------------------------ */

export async function exportPptx(root: HTMLElement, lesson: Lesson, meta?: Meta) {
  const PptxGenJS = await loadPptx();
  const t = getTheme(lesson.theme);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = meta?.teacher || APP_LABEL;
  pptx.company = meta?.school || "";
  pptx.subject = "Bài giảng PowerPoint môn Toán THPT";
  pptx.title = lesson.title;
  pptx.lang = "vi-VN";
  pptx.theme = { headFontFace: t.headFont, bodyFontFace: t.bodyFont, lang: "vi-VN" };

  /**
   * Dùng CHUNG danh sách slide với khung xem trước. V11.5 dựng lại vòng lặp
   * riêng ở đây, nên xem trước một đằng, file xuất ra một nẻo. V11.6 chỉ có một
   * nguồn duy nhất là buildDeck().
   */
  lastRichMathReport.length = 0;
  const deck = buildDeck(lesson, { teacher: meta?.teacher, school: meta?.school });
  const limit = meta?.limitSlides || Number.POSITIVE_INFINITY;

  const stage = (root.querySelector(".export-staging") as HTMLElement) || root;
  const articles = Array.from(stage.querySelectorAll("article"));

  let slideNo = 1;
  let made = 0;

  for (const spec of deck) {
    if (made >= limit) break;

    /* --- Slide bìa --- */
    if (spec.kind === "cover") {
      const cover = pptx.addSlide();
      cover.background = { color: t.coverBg };
      cover.addShape("rect", { x: 0.72, y: 0.72, w: 0.18, h: 5.9, fill: { color: t.accent }, line: { transparency: 100 } });
      cover.addText("BÀI GIẢNG MÔN TOÁN · THPT", {
        x: 1.25, y: 0.95, w: 9, h: 0.42, fontFace: t.bodyFont, fontSize: TYPO.coverKicker, bold: true,
        charSpacing: 2.4, color: t.accent, margin: 0,
      });
      cover.addText(toSlideText(lesson.title), {
        x: 1.25, y: 1.55, w: 10.8, h: 1.9, fontFace: t.headFont, fontSize: TYPO.coverTitle, bold: true,
        color: t.coverInk, margin: 0, valign: "mid", fit: "shrink",
      });
      cover.addShape("line", { x: 1.25, y: 3.7, w: 2.2, h: 0, line: { color: t.accent, width: 4 } });
      cover.addText(`${lesson.subject || "Toán"}  |  Lớp ${lesson.grade || "THPT"}${lesson.book ? "  |  " + lesson.book : ""}`, {
        x: 1.25, y: 4.05, w: 10, h: 0.5, fontFace: t.bodyFont, fontSize: TYPO.coverMeta, color: t.coverInk, margin: 0,
      });
      if (meta?.teacher)
        cover.addText(`Giáo viên: ${meta.teacher}`, {
          x: 1.25, y: 4.7, w: 9, h: 0.46, fontFace: t.bodyFont, fontSize: TYPO.coverTeacher, color: t.coverInk, margin: 0,
        });
      if (meta?.school)
        cover.addText(meta.school, {
          x: 1.25, y: 5.25, w: 10, h: 0.42, fontFace: t.bodyFont, fontSize: TYPO.coverSchool, color: t.coverInk, margin: 0,
        });
      if (lesson.objectives?.length) cover.addNotes(`Yêu cầu cần đạt:\n- ${lesson.objectives.join("\n- ")}`);
      made++;
      continue;
    }

    /* --- Slide yêu cầu cần đạt --- */
    if (spec.kind === "objectives") {
      const s = pptx.addSlide();
      addChrome(s, t, 0);
      await addTitle(s, t, `Yêu cầu cần đạt${spec.part ? " (tiếp)" : ""}`, false, stage);
      addFooter(s, t, lesson);
      await addTextBlock(s, t, spec.items, objectivesBox(), spec.bodyPt, spec.richMath, stage, t.bg);
      made++;
      continue;
    }

    /* --- Slide chuyển pha hoạt động --- */
    if (spec.kind === "divider") {
      const m = PHASE_META[spec.phase];
      const d = pptx.addSlide();
      d.background = { color: t.coverBg };
      d.addShape("rect", { x: 0, y: 3.0, w: SLIDE_W_IN, h: 0.1, fill: { color: m?.color || t.accent }, line: { transparency: 100 } });
      d.addText((m?.label || "Hoạt động").toUpperCase(), {
        x: 0, y: 3.25, w: SLIDE_W_IN, h: 1.0, fontFace: t.headFont, fontSize: TYPO.divider, bold: true,
        color: t.coverInk, align: "center", margin: 0, charSpacing: 3,
      });
      made++;
      continue;
    }

    /* --- Slide kết --- */
    if (spec.kind === "end") {
      if (Number.isFinite(limit)) break; // bản xem thử không cần slide kết
      const end = pptx.addSlide();
      end.background = { color: t.coverBg };
      end.addText("CẢM ƠN CÁC EM ĐÃ THAM GIA TIẾT HỌC", {
        x: 0.8, y: 2.9, w: 11.7, h: 1.4, fontFace: t.headFont, fontSize: TYPO.endTitle, bold: true,
        color: t.coverInk, align: "center", margin: 0,
      });
      if (lesson.keywords?.length)
        end.addText("Từ khoá: " + lesson.keywords.join(" · "), {
          x: 0.8, y: 4.45, w: 11.7, h: 0.6, fontFace: t.bodyFont, fontSize: TYPO.endKeywords, color: t.accent, align: "center", margin: 0,
        });
      made++;
      continue;
    }

    /* --- Slide nội dung --- */
    const section = spec.section;
    const slide = pptx.addSlide();
    const heading = section.heading + (spec.part ? " (tiếp)" : "");
    addChrome(slide, t, slideNo++, section.phase);
    await addTitle(slide, t, heading, false, stage);
    addFooter(slide, t, lesson, spec.sectionIndex);

    const bullets = spec.bullets.map(toSlideText);

    if (!spec.visual) {
      // Slide chỉ có chữ: khung nền trải hết bề ngang, chữ 32–36 pt.
      slide.addShape("roundRect", {
        x: LAYOUT.textOnly.box.x, y: LAYOUT.textOnly.box.y, w: LAYOUT.textOnly.box.w, h: LAYOUT.textOnly.box.h,
        rectRadius: 0.06, fill: { color: t.surface }, line: { color: t.line, width: 1 },
      });
      const box = { x: LAYOUT.textOnly.box.x + 0.33, y: LAYOUT.textOnly.bullets.y, w: LAYOUT.textOnly.box.w - 0.66, h: LAYOUT.textOnly.bullets.h };
      await addTextBlock(slide, t, spec.bullets, box, spec.bodyPt, spec.richMath, stage, t.surface);
    } else {
      // Slide có hình: chữ ở trên (nếu có), hình trải hết bề ngang ở dưới.
      if (spec.bandH > 0 && bullets.length) {
        const band = textBandBox(spec.bandH);
        slide.addShape("roundRect", {
          x: band.panel.x, y: band.panel.y, w: band.panel.w, h: band.panel.h,
          rectRadius: 0.06, fill: { color: t.surface }, line: { color: t.line, width: 1 },
        });
        await addTextBlock(slide, t, spec.bullets, band.bullets, spec.bodyPt, spec.richMath, stage, t.surface);
      }
      // V11.5 in thêm dòng "Tiếp theo phần trước" ở đây. Bỏ đi: trên slide chỉ có
      // hình nó nằm chồng lên nhãn loại hình, mà tiêu đề đã có chữ "(tiếp)".

      const v = spec.visual.visual;
      const box = visualBox(spec.bandH);
      const img = visualImageBox(box);
      slide.addText(VISUAL_LABEL[v.type] || "HÌNH MINH HOẠ", {
        x: box.x + 0.15, y: box.y, w: 6, h: 0.26,
        fontFace: t.bodyFont, fontSize: TYPO.visualLabel, bold: true, color: t.primary, charSpacing: 0.8, margin: 0,
      });

      const nodes = collectVisualNodes(stage, articles, spec.sectionIndex);
      const node = nodes[spec.visual.index];
      const png = node ? await nodeToPng(node) : null;
      if (!png) {
        slide.addText("⚠ Không dựng được hình này. Hãy kiểm tra dữ liệu trong trình biên tập.", {
          x: img.x, y: img.y + 0.3, w: img.w, h: 0.8, fontFace: t.bodyFont, fontSize: TYPO.warn, color: "B91C1C", margin: 0,
        });
      } else {
        const ratio = png.w / png.h;
        let w = img.w;
        let h = w / ratio;
        if (h > img.h) { h = img.h; w = h * ratio; }
        slide.addImage({
          data: png.data,
          x: img.x + (img.w - w) / 2,
          y: img.y + (img.h - h) / 2,
          w, h,
          altText: visualAlt(v),
        });
      }
    }

    // Ghi chú giáo viên -> Notes của PowerPoint (chỉ trên slide đầu của mục)
    if (meta?.includeNotes !== false && spec.part === 0) {
      const notes: string[] = [];
      if (section.notes) notes.push(toSlideText(section.notes));
      if (section.questions?.length) notes.push("Câu hỏi gợi mở:\n- " + section.questions.map(toSlideText).join("\n- "));
      if (section.minutes) notes.push(`Thời lượng dự kiến: ${section.minutes} phút.`);
      section.visuals?.filter((v) => v.type === "quiz").forEach((v: any) => {
        notes.push(
          `Đáp án: ${String.fromCharCode(65 + v.answerIndex)}. ${toSlideText(v.options[v.answerIndex])}` +
            (v.explanation ? "\nGiải thích: " + toSlideText(v.explanation) : ""),
        );
      });
      if (notes.length) slide.addNotes(notes.join("\n\n"));
    }
    made++;
  }

  const suffix = Number.isFinite(limit) ? "XEM_THU" : "BAI_GIANG";
  await pptx.writeFile({ fileName: `${safeName(lesson.title)}_${suffix}.pptx` });
}

/** Tìm các thẻ hình của slide si trong vùng dựng ẩn. */
function collectVisualNodes(stage: HTMLElement, articles: Element[], si: number): (HTMLElement | undefined)[] {
  const keyed = Array.from(stage.querySelectorAll<HTMLElement>(`[data-visual-key^="${si}-"]`));
  if (keyed.length) {
    const out: HTMLElement[] = [];
    keyed.forEach((el) => {
      const idx = Number(el.dataset.visualKey?.split("-")[1] ?? -1);
      if (idx >= 0) out[idx] = el;
    });
    return out;
  }
  return Array.from(articles[si]?.querySelectorAll<HTMLElement>(".visual-card") || []);
}

/* ------------------------------------------------------------------ */
/* Xuất phiếu học tập (Word) — dùng gói `docx` đã có trong package.json */
/* ------------------------------------------------------------------ */

export async function exportWorksheet(lesson: Lesson, meta?: Meta) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");
  const children: any[] = [
    new Paragraph({ text: meta?.school || "", alignment: AlignmentType.CENTER }),
    new Paragraph({ text: toSlideText(lesson.title).toUpperCase(), heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `Môn Toán · Lớp ${lesson.grade || "THPT"}${meta?.teacher ? " · GV: " + meta.teacher : ""}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: "Họ và tên học sinh: ......................................................  Lớp: ................" }),
    new Paragraph({ text: "" }),
  ];

  lesson.sections.forEach((s, i) => {
    children.push(new Paragraph({ text: `${i + 1}. ${toSlideText(s.heading)}`, heading: HeadingLevel.HEADING_2 }));
    if (s.content) children.push(new Paragraph({ text: toSlideText(s.content) }));
    s.questions?.forEach((q) => children.push(new Paragraph({ text: "• " + toSlideText(q) })));
    s.visuals?.forEach((v) => {
      if (v.type === "quiz") {
        children.push(new Paragraph({ children: [new TextRun({ text: toSlideText(v.question), bold: true })] }));
        v.options.forEach((o, k) => children.push(new Paragraph({ text: `   ${String.fromCharCode(65 + k)}. ${toSlideText(o)}` })));
        children.push(new Paragraph({ text: "" }));
      }
      if (v.type === "formula") children.push(new Paragraph({ text: latexToUnicode(v.latex).text, alignment: AlignmentType.CENTER }));
      if (v.type === "data_table") {
        children.push(new Paragraph({ text: v.headers.join(" | "), }));
        v.rows.forEach((r) => children.push(new Paragraph({ text: r.join(" | ") })));
      }
    });
    children.push(new Paragraph({ text: "Bài làm: ..............................................................................................................." }));
    children.push(new Paragraph({ text: "" }));
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safeName(lesson.title)}_PHIEU_HOC_TAP.docx`);
}

/* ------------------------------------------------------------------ */
/* Xuất HTML trình chiếu & ảnh                                         */
/* ------------------------------------------------------------------ */

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.download = filename;
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

export async function exportPreviewImage(root: HTMLElement, title: string) {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(root, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const a = document.createElement("a");
  a.download = `${safeName(title)}_preview.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

/**
 * Xuất bản trình chiếu HTML: bấm mũi tên để chuyển slide, chiếu thẳng trên máy
 * chiếu mà không cần PowerPoint (hữu ích khi máy trường không có Office bản quyền).
 */
export function exportHtml(root: HTMLElement, lesson: Lesson) {
  const t = getTheme(lesson.theme);
  const body = (root.querySelector(".export-staging") || root.querySelector(".deck-preview") || root).innerHTML;
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${toSlideText(lesson.title).replace(/[<>&]/g, "")}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>
:root{--ink:#${t.ink};--muted:#${t.muted};--line:#${t.line};--primary:#${t.primary};--accent:#${t.accent};--surface:#${t.surface}}
*{box-sizing:border-box}
body{margin:0;background:#0f1720;color:var(--ink);font:26px/1.55 ${t.bodyFont},system-ui,sans-serif}
.deck{height:100vh;display:grid;place-items:center;padding:24px}
article{display:none;background:#fff;width:min(1280px,96vw);aspect-ratio:16/9;padding:44px 56px;border-radius:14px;overflow:auto;box-shadow:0 30px 80px #0008}
article.active{display:block}
h3{font:700 40px/1.2 ${t.headFont},Georgia,serif;margin:0 0 18px;color:var(--primary);border-bottom:3px solid var(--accent);padding-bottom:12px}
p,li{font-size:30px}
.visual-card>label{font-size:16px}
.visual-grid{display:block;margin-top:20px}
.visual-card{border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--surface);overflow:auto}
svg{max-width:100%;height:auto}
.data-table{border-collapse:collapse;width:100%;font-size:28px}.data-table th,.data-table td{border:1px solid var(--line);padding:10px 14px}
.quiz-question{font-size:32px;font-weight:600}
.quiz-option{display:flex;gap:12px;width:100%;text-align:left;margin:8px 0;padding:14px 18px;border:1px solid var(--line);border-radius:10px;background:#fff;font:inherit;font-size:28px;cursor:pointer}
.quiz-option.correct{background:#e7f7ef;border-color:#0e8a72}.quiz-option.wrong{background:#fdecec;border-color:#b91c1c}
nav{position:fixed;inset:auto 0 18px 0;display:flex;gap:12px;justify-content:center}
nav button{border:0;border-radius:999px;padding:10px 20px;background:#ffffff22;color:#fff;font:inherit;cursor:pointer}
#counter{color:#fff;align-self:center;font-size:15px}
@media print{body{background:#fff}article{display:block;page-break-after:always;box-shadow:none;aspect-ratio:auto}nav{display:none}}
</style></head><body>
<div class="deck">${body}</div>
<nav><button id="prev">◀ Trước</button><span id="counter"></span><button id="next">Sau ▶</button></nav>
<script>
var slides=[].slice.call(document.querySelectorAll('article')),i=0;
function show(n){i=Math.max(0,Math.min(slides.length-1,n));slides.forEach(function(s,k){s.classList.toggle('active',k===i)});document.getElementById('counter').textContent=(i+1)+' / '+slides.length}
document.getElementById('prev').onclick=function(){show(i-1)};
document.getElementById('next').onclick=function(){show(i+1)};
document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key===' ')show(i+1);if(e.key==='ArrowLeft')show(i-1)});
document.querySelectorAll('.export-staging').forEach(function(el){el.classList.remove('export-staging');el.removeAttribute('aria-hidden');el.style.cssText=''});
show(0);
<\/script></body></html>`;
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${safeName(lesson.title)}_TRINH_CHIEU.html`);
}

/** Xuất JSON để lưu trữ / chia sẻ / mở lại sau. */
export function exportJson(lesson: Lesson) {
  downloadBlob(new Blob([JSON.stringify(lesson, null, 2)], { type: "application/json" }), `${safeName(lesson.title)}.json`);
}
