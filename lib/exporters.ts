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
 */

import type { Lesson, Section, Visual } from "./types";
import { getTheme, PHASE_META, VISUAL_LABEL, type Theme } from "./themes";
import { latexToUnicode, mixedLatexToUnicode } from "./latex";
import { LAYOUT, visualBoxes } from "./slides";

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
async function htmlToPng(node: HTMLElement, scale = 3): Promise<{ data: string; w: number; h: number }> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(node, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false });
  return { data: canvas.toDataURL("image/png"), w: canvas.width / scale, h: canvas.height / scale };
}

async function nodeToPng(node: HTMLElement): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const svg = node.tagName.toLowerCase() === "svg" ? (node as unknown as SVGSVGElement) : node.querySelector("svg");
    if (svg) return await svgToPng(svg);
    return await htmlToPng(node);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Chữ trên slide                                                      */
/* ------------------------------------------------------------------ */

export function toSlideText(raw: string): string {
  return mixedLatexToUnicode(raw).text;
}

/** Tách nội dung thành các gạch đầu dòng, giữ nguyên dấu âm trong công thức. */
function toBullets(raw: string): string[] {
  const text = toSlideText(raw);
  const byLine = text.split(/\n+/).map((t) => t.trim()).filter(Boolean);
  const source = byLine.length > 1 ? byLine : text.split(/(?:^|\s)[•·]\s|(?<=[.;])\s+(?=[A-ZĐÀ-Ỹ])/).map((t) => t.trim()).filter(Boolean);
  return source.map((t) => t.replace(/^[-–—•·]\s*/, "").replace(/^\d+[.)]\s*/, "")).filter(Boolean).slice(0, 7);
}

/** Cỡ chữ tự thích ứng theo lượng nội dung — chống tràn mà không cần "shrink". */
function bodyFontSize(chars: number, hasVisual: boolean): number {
  const base = hasVisual ? 20 : 24;
  if (chars < 120) return base + 2;
  if (chars < 240) return base;
  if (chars < 360) return base - 3;
  if (chars < 480) return base - 5;
  return base - 7;
}

/* ------------------------------------------------------------------ */
/* Khung slide                                                         */
/* ------------------------------------------------------------------ */

type Meta = { teacher?: string; school?: string; limitSlides?: number; includeNotes?: boolean };

function addChrome(slide: any, t: Theme, index: number, title: string, phase?: string) {
  slide.background = { color: t.bg };
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.14, fill: { color: t.primary }, line: { transparency: 100 } });
  const meta = phase ? PHASE_META[phase] : undefined;
  slide.addShape("rect", { x: 0.58, y: 0.52, w: 0.13, h: 0.62, fill: { color: meta?.color || t.accent }, line: { transparency: 100 } });
  slide.addText(title, {
    x: 0.86, y: 0.44, w: meta ? 9.4 : 11.0, h: 0.68,
    fontFace: t.headFont, fontSize: 26, bold: true, color: t.ink, margin: 0, valign: "mid", fit: "shrink",
  });
  if (meta) {
    slide.addShape("roundRect", { x: 10.45, y: 0.56, w: 1.5, h: 0.4, rectRadius: 0.2, fill: { color: meta.color }, line: { transparency: 100 } });
    slide.addText(meta.label.toUpperCase(), {
      x: 10.45, y: 0.56, w: 1.5, h: 0.4, fontFace: t.bodyFont, fontSize: 10, bold: true,
      color: "FFFFFF", align: "center", valign: "mid", margin: 0, charSpacing: 0.6,
    });
  }
  slide.addText(String(index).padStart(2, "0"), {
    x: 12.15, y: 0.6, w: 0.6, h: 0.3, fontFace: t.bodyFont, fontSize: 11, bold: true,
    color: t.muted, align: "right", margin: 0,
  });
  slide.addShape("line", { x: 0.58, y: 1.2, w: 12.17, h: 0, line: { color: t.line, width: 1 } });
}

function addFooter(slide: any, t: Theme, lesson: Lesson) {
  slide.addText(`${lesson.subject || "Toán"} · Lớp ${lesson.grade || "THPT"}${lesson.book ? " · " + lesson.book : ""}`, {
    x: 0.62, y: 7.12, w: 7, h: 0.24, fontFace: t.bodyFont, fontSize: 9, color: t.muted, margin: 0,
  });
  slide.addText("LessonStudio V11", {
    x: 10.4, y: 7.12, w: 2.3, h: 0.24, fontFace: t.bodyFont, fontSize: 9, color: t.muted, align: "right", margin: 0,
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
  pptx.author = meta?.teacher || "LessonStudio V11";
  pptx.company = meta?.school || "";
  pptx.subject = "Bài giảng PowerPoint môn Toán THPT";
  pptx.title = lesson.title;
  pptx.lang = "vi-VN";
  pptx.theme = { headFontFace: t.headFont, bodyFontFace: t.bodyFont, lang: "vi-VN" };

  /* --- Slide bìa --- */
  const cover = pptx.addSlide();
  cover.background = { color: t.coverBg };
  cover.addShape("rect", { x: 0.72, y: 0.72, w: 0.18, h: 5.9, fill: { color: t.accent }, line: { transparency: 100 } });
  cover.addText("BÀI GIẢNG MÔN TOÁN · THPT", {
    x: 1.25, y: 1.0, w: 8, h: 0.36, fontFace: t.bodyFont, fontSize: 13, bold: true,
    charSpacing: 2.4, color: t.accent, margin: 0,
  });
  cover.addText(toSlideText(lesson.title), {
    x: 1.25, y: 1.6, w: 10.5, h: 1.7, fontFace: t.headFont, fontSize: 36, bold: true,
    color: t.coverInk, margin: 0, valign: "mid", fit: "shrink",
  });
  cover.addShape("line", { x: 1.25, y: 3.6, w: 2.2, h: 0, line: { color: t.accent, width: 4 } });
  cover.addText(`${lesson.subject || "Toán"}  |  Lớp ${lesson.grade || "THPT"}${lesson.book ? "  |  " + lesson.book : ""}`, {
    x: 1.25, y: 3.95, w: 9, h: 0.42, fontFace: t.bodyFont, fontSize: 17, color: t.coverInk, margin: 0,
  });
  if (meta?.teacher)
    cover.addText(`Giáo viên: ${meta.teacher}`, { x: 1.25, y: 4.55, w: 8, h: 0.36, fontFace: t.bodyFont, fontSize: 15, color: t.coverInk, margin: 0 });
  if (meta?.school)
    cover.addText(meta.school, { x: 1.25, y: 5.0, w: 9, h: 0.32, fontFace: t.bodyFont, fontSize: 13, color: t.coverInk, margin: 0 });
  if (lesson.objectives?.length)
    cover.addNotes(`Yêu cầu cần đạt:\n- ${lesson.objectives.join("\n- ")}`);

  /* --- Slide mục tiêu (nếu có) --- */
  if (lesson.objectives?.length) {
    const s = pptx.addSlide();
    addChrome(s, t, 0, "Yêu cầu cần đạt");
    addFooter(s, t, lesson);
    s.addText(
      lesson.objectives.map((o, i) => ({
        text: toSlideText(o),
        options: { breakLine: true, bullet: { indent: 20 }, paraSpaceAfter: 10, bold: i === 0 },
      })),
      { x: 0.9, y: 1.6, w: 11.6, h: 5, fontFace: t.bodyFont, fontSize: 20, color: t.ink, valign: "top" },
    );
  }

  /* --- Slide nội dung --- */
  const stage = (root.querySelector(".export-staging") as HTMLElement) || root;
  const articles = Array.from(stage.querySelectorAll("article"));
  const limit = meta?.limitSlides || Number.POSITIVE_INFINITY;
  let slideNo = 1;
  let lastPhase: string | undefined;

  for (let si = 0; si < lesson.sections.length && slideNo <= limit; si++) {
    const section = lesson.sections[si];

    // slide chuyển pha hoạt động
    if (section.phase && section.phase !== lastPhase && PHASE_META[section.phase]) {
      const m = PHASE_META[section.phase];
      const d = pptx.addSlide();
      d.background = { color: t.coverBg };
      d.addShape("rect", { x: 0, y: 3.05, w: 13.333, h: 0.08, fill: { color: m.color }, line: { transparency: 100 } });
      d.addText(m.label.toUpperCase(), {
        x: 0, y: 3.2, w: 13.333, h: 0.9, fontFace: t.headFont, fontSize: 40, bold: true,
        color: t.coverInk, align: "center", margin: 0, charSpacing: 3,
      });
      lastPhase = section.phase;
      if (slideNo++ > limit) break;
    }

    const visuals = section.visuals || [];
    const nodes = collectVisualNodes(stage, articles, si);

    // hình quá 2 -> tràn sang slide "(tiếp)" thay vì bị bỏ như V10
    const chunks: number[][] = [];
    if (!visuals.length) chunks.push([]);
    else for (let i = 0; i < visuals.length; i += 2) chunks.push([i, i + 1].filter((k) => k < visuals.length));

    for (let ci = 0; ci < chunks.length && slideNo <= limit; ci++) {
      const slide = pptx.addSlide();
      const heading = toSlideText(section.heading) + (ci ? " (tiếp)" : "");
      addChrome(slide, t, slideNo++, heading, section.phase);
      addFooter(slide, t, lesson);

      const group = chunks[ci];
      if (!group.length) {
        // slide chỉ có chữ: căn giữa, chữ to
        const bullets = toBullets(section.content);
        const chars = toSlideText(section.content).length;
        slide.addShape("roundRect", { x: 0.62, y: 1.5, w: 12.1, h: 5.1, rectRadius: 0.06, fill: { color: t.surface }, line: { color: t.line, width: 1 } });
        slide.addText(String(si + 1).padStart(2, "0"), {
          x: 0.9, y: 1.75, w: 1.1, h: 0.7, fontFace: t.headFont, fontSize: 34, bold: true, color: t.accent, margin: 0,
        });
        slide.addText(
          bullets.length > 1
            ? bullets.map((b) => ({ text: b, options: { breakLine: true, bullet: { indent: 20 }, paraSpaceAfter: 12 } }))
            : bullets[0] || "",
          { x: 2.05, y: 1.72, w: 10.2, h: 4.6, fontFace: t.bodyFont, fontSize: bodyFontSize(chars, false), color: t.ink, valign: "top", margin: 0.08 },
        );
      } else {
        const chars = toSlideText(section.content).length;
        if (ci === 0) {
          slide.addShape("roundRect", { x: 0.62, y: 1.48, w: 4.15, h: 5.15, rectRadius: 0.06, fill: { color: t.surface }, line: { color: t.line, width: 1 } });
          slide.addText("NỘI DUNG TRỌNG TÂM", {
            x: 0.88, y: 1.76, w: 3.7, h: 0.26, fontFace: t.bodyFont, fontSize: 10.5, bold: true,
            color: t.primary, charSpacing: 1.1, margin: 0,
          });
          const bullets = toBullets(section.content);
          slide.addText(
            bullets.length > 1
              ? bullets.map((b) => ({ text: b, options: { breakLine: true, bullet: { indent: 18 }, paraSpaceAfter: 9 } }))
              : bullets[0] || "",
            { x: 0.88, y: 2.16, w: 3.65, h: 4.2, fontFace: t.bodyFont, fontSize: Math.min(18, bodyFontSize(chars, true)), color: t.ink, valign: "top", margin: 0.06 },
          );
        } else {
          // Dùng chung toạ độ với khung xem trước (lib/slides.ts) để file xuất ra
          // khớp từng milimét với những gì giáo viên nhìn thấy trên màn hình.
          slide.addText("Tiếp theo phần trước", {
            x: LAYOUT.contPanel.x, y: LAYOUT.contPanel.y, w: LAYOUT.contPanel.w, h: LAYOUT.contPanel.h,
            fontFace: t.bodyFont, fontSize: LAYOUT.contPanel.pt, italic: true, color: t.muted, margin: 0,
          });
        }

        const boxes = visualBoxes(ci, group.length);
        for (let k = 0; k < group.length; k++) {
          const vi = group[k];
          const node = nodes[vi];
          const { x: boxX, y: boxY, w: boxW, h: boxH } = boxes[k];
          slide.addText(VISUAL_LABEL[visuals[vi].type] || "HÌNH MINH HOẠ", {
            x: boxX + 0.12, y: boxY + 0.04, w: 4, h: 0.24,
            fontFace: t.bodyFont, fontSize: 9.5, bold: true, color: t.primary, charSpacing: 0.8, margin: 0,
          });
          const png = node ? await nodeToPng(node) : null;
          if (!png) {
            slide.addText("⚠ Không dựng được hình này. Hãy kiểm tra dữ liệu trong trình biên tập.", {
              x: boxX + 0.12, y: boxY + 0.4, w: boxW - 0.3, h: 0.6, fontFace: t.bodyFont, fontSize: 12, color: "B91C1C", margin: 0,
            });
            continue;
          }
          const ratio = png.w / png.h;
          let w = boxW - 0.3;
          let h = w / ratio;
          if (h > boxH - 0.42) { h = boxH - 0.42; w = h * ratio; }
          slide.addImage({
            data: png.data,
            x: boxX + (boxW - w) / 2,
            y: boxY + 0.34 + (boxH - 0.34 - h) / 2,
            w, h,
            altText: visualAlt(visuals[vi]),
          });
        }
      }

      // Ghi chú giáo viên -> Notes của PowerPoint
      if (meta?.includeNotes !== false) {
        const notes: string[] = [];
        if (section.notes) notes.push(toSlideText(section.notes));
        if (section.questions?.length) notes.push("Câu hỏi gợi mở:\n- " + section.questions.map(toSlideText).join("\n- "));
        if (section.minutes) notes.push(`Thời lượng dự kiến: ${section.minutes} phút.`);
        section.visuals?.filter((v) => v.type === "quiz").forEach((v: any) => {
          notes.push(`Đáp án: ${String.fromCharCode(65 + v.answerIndex)}. ${toSlideText(v.options[v.answerIndex])}${v.explanation ? "\nGiải thích: " + toSlideText(v.explanation) : ""}`);
        });
        if (notes.length) slide.addNotes(notes.join("\n\n"));
      }
    }
  }

  /* --- Slide kết --- */
  if (!Number.isFinite(limit)) {
    const end = pptx.addSlide();
    end.background = { color: t.coverBg };
    end.addText("CẢM ƠN CÁC EM ĐÃ THAM GIA TIẾT HỌC", {
      x: 0.8, y: 3.0, w: 11.7, h: 1.2, fontFace: t.headFont, fontSize: 30, bold: true,
      color: t.coverInk, align: "center", margin: 0,
    });
    if (lesson.keywords?.length)
      end.addText("Từ khoá: " + lesson.keywords.join(" · "), {
        x: 0.8, y: 4.2, w: 11.7, h: 0.5, fontFace: t.bodyFont, fontSize: 14, color: t.accent, align: "center", margin: 0,
      });
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
body{margin:0;background:#0f1720;color:var(--ink);font:18px/1.6 ${t.bodyFont},system-ui,sans-serif}
.deck{height:100vh;display:grid;place-items:center;padding:24px}
article{display:none;background:#fff;width:min(1280px,96vw);aspect-ratio:16/9;padding:44px 56px;border-radius:14px;overflow:auto;box-shadow:0 30px 80px #0008}
article.active{display:block}
h3{font:700 30px/1.2 ${t.headFont},Georgia,serif;margin:0 0 18px;color:var(--primary);border-bottom:3px solid var(--accent);padding-bottom:12px}
p{font-size:22px}
.visual-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;margin-top:20px}
.visual-card{border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--surface);overflow:auto}
svg{max-width:100%;height:auto}
.data-table{border-collapse:collapse;width:100%}.data-table th,.data-table td{border:1px solid var(--line);padding:8px 12px}
.quiz-option{display:flex;gap:10px;width:100%;text-align:left;margin:6px 0;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:#fff;font:inherit;cursor:pointer}
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
