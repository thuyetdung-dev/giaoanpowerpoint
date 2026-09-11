/**
 * lib/slides.ts — Dựng danh sách slide đúng như bản PowerPoint sẽ xuất ra (V11.1)
 *
 * Trước đây khung xem trước trong trình biên tập chỉ là một khối chữ, không giống
 * slide thật, nên giáo viên không biết chữ có tràn không, hình có bị nhỏ không,
 * trước khi bấm Xuất. Tệp này mô tả từng slide theo đúng thứ tự và đúng cách chia
 * mà lib/exporters.ts dùng, để khung xem trước và trình chiếu toàn màn hình vẽ
 * lại y hệt.
 */

import type { Lesson, Section, Visual } from "./types";

export type SlideSpec =
  | { kind: "cover" }
  | { kind: "objectives"; items: string[] }
  | { kind: "divider"; phase: string }
  | {
      kind: "content";
      section: Section;
      sectionIndex: number;
      /** 0 = slide chính, 1 trở đi = slide "(tiếp)" chứa hình tràn. */
      part: number;
      visuals: { visual: Visual; index: number }[];
    }
  | { kind: "end" };

export type DeckMeta = { teacher?: string; school?: string; includeObjectives?: boolean };

/** Số hình tối đa trên một slide trước khi tràn sang slide "(tiếp)". */
export const VISUALS_PER_SLIDE = 2;

export function buildDeck(lesson: Lesson, meta: DeckMeta = {}): SlideSpec[] {
  const deck: SlideSpec[] = [{ kind: "cover" }];

  if (meta.includeObjectives !== false && lesson.objectives?.length) {
    deck.push({ kind: "objectives", items: lesson.objectives });
  }

  let lastPhase: string | undefined;
  (lesson.sections || []).forEach((section, sectionIndex) => {
    if (section.phase && section.phase !== lastPhase) {
      deck.push({ kind: "divider", phase: section.phase });
      lastPhase = section.phase;
    }
    const visuals = (section.visuals || []).map((visual, index) => ({ visual, index }));
    if (!visuals.length) {
      deck.push({ kind: "content", section, sectionIndex, part: 0, visuals: [] });
      return;
    }
    for (let i = 0, part = 0; i < visuals.length; i += VISUALS_PER_SLIDE, part++) {
      deck.push({
        kind: "content",
        section,
        sectionIndex,
        part,
        visuals: visuals.slice(i, i + VISUALS_PER_SLIDE),
      });
    }
  });

  deck.push({ kind: "end" });
  return deck;
}

/** Slide đầu tiên tương ứng với một mục trong danh sách bên trái. */
export function findSlideForSection(deck: SlideSpec[], sectionIndex: number): number {
  const i = deck.findIndex((s) => s.kind === "content" && s.sectionIndex === sectionIndex && s.part === 0);
  return i < 0 ? 0 : i;
}

/* ------------------------------------------------------------------ */
/* Bố cục slide — NGUỒN DUY NHẤT                                       */
/*                                                                     */
/* Mọi toạ độ tính bằng inch trên khổ 16:9 (13,333 × 7,5 in) — đúng hệ  */
/* của PowerPoint. Khung xem trước trên web nhân với IN = 96 px/inch,   */
/* bộ xuất PPTX dùng thẳng số inch. Nhờ vậy những gì giáo viên thấy     */
/* trên màn hình đúng bằng những gì in ra file.                        */
/* ------------------------------------------------------------------ */

export const IN = 96;
export const SLIDE_W_IN = 13.333;
export const SLIDE_H_IN = 7.5;

export const LAYOUT = {
  topBar: { x: 0, y: 0, w: SLIDE_W_IN, h: 0.14 },
  accentBar: { x: 0.58, y: 0.52, w: 0.13, h: 0.62 },
  title: { x: 0.86, y: 0.44, h: 0.68, wWide: 11.0, wNarrow: 9.4, pt: 26 },
  badge: { x: 10.45, y: 0.56, w: 1.5, h: 0.4, pt: 10 },
  pageNo: { x: 12.15, y: 0.6, w: 0.6, pt: 11 },
  divider: { x: 0.58, y: 1.2, w: 12.17 },
  footer: { y: 7.12, h: 0.24, pt: 9 },
  /** Khối nội dung khi slide KHÔNG có hình. */
  textOnly: {
    box: { x: 0.62, y: 1.5, w: 12.1, h: 5.1 },
    number: { x: 0.9, y: 1.75, w: 1.1, h: 0.7, pt: 34 },
    bullets: { x: 2.05, y: 1.72, w: 10.2, h: 4.6 },
  },
  /** Khối nội dung bên trái khi slide CÓ hình. */
  sidePanel: {
    box: { x: 0.62, y: 1.48, w: 4.15, h: 5.15 },
    label: { x: 0.88, y: 1.76, w: 3.7, h: 0.26, pt: 10.5 },
    bullets: { x: 0.88, y: 2.16, w: 3.65, h: 4.2 },
  },
  /** Dòng nhắc trên slide "(tiếp)". */
  contPanel: { x: 0.62, y: 1.3, w: 6, h: 0.32, pt: 13 },
};

export type Box = { x: number; y: number; w: number; h: number };

/**
 * Mỗi loại hình cần một lượng chiều cao khác nhau. Chia đều là sai: câu hỏi
 * trắc nghiệm 4 phương án cần gần gấp rưỡi một bảng xét dấu, nếu chia đều thì
 * phương án cuối bị cắt mất — học sinh không thấy đáp án D.
 */
const HEIGHT_WEIGHT: Record<string, number> = {
  quiz: 1.55,
  data_table: 1.25,
  prob_tree: 1.15,
  box_plot: 1.1,
  variation_table: 1.0,
  solid_3d: 1.0,
  graph: 1.0,
  stat_chart: 1.0,
  sign_chart: 0.75,
  number_line: 0.6,
  formula: 0.6,
};

/**
 * Vị trí từng ô hình (inch). Slide chính: hình nằm bên phải khối chữ.
 * Slide "(tiếp)": hình chiếm trọn chiều ngang vì không còn khối chữ.
 * `types` không bắt buộc; có thì chiều cao được chia theo nhu cầu từng loại.
 */
export function visualBoxes(part: number, count: number, types?: string[]): Box[] {
  const first = part === 0;
  const x = first ? 5.08 : 0.62;
  const w = first ? 7.62 : 12.1;
  const top = first ? 1.48 : 1.72;
  const total = first ? 5.15 : 4.9;
  const gap = 0.3;
  if (count <= 1) return [{ x, y: top, w, h: total }];

  const weights = Array.from({ length: count }, (_, k) => HEIGHT_WEIGHT[types?.[k] ?? ""] ?? 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const usable = total - gap * (count - 1);

  const boxes: Box[] = [];
  let y = top;
  for (let k = 0; k < count; k++) {
    const h = (usable * weights[k]) / sum;
    boxes.push({ x, y, w, h });
    y += h + gap;
  }
  return boxes;
}

/* ------------------------------------------------------------------ */
/* Chữ trên slide                                                      */
/* ------------------------------------------------------------------ */

/** Tách nội dung thành các gạch đầu dòng — cùng quy tắc với bộ xuất PPTX. */
export function toBullets(raw: string): string[] {
  const text = String(raw ?? "").trim();
  const byLine = text.split(/\n+/).map((t) => t.trim()).filter(Boolean);
  const source =
    byLine.length > 1
      ? byLine
      : text.split(/(?:^|\s)[•·]\s|(?<=[.;])\s+(?=[A-ZĐÀ-Ỹ])/).map((t) => t.trim()).filter(Boolean);
  return source
    .map((t) => t.replace(/^[-–—•·]\s*/, "").replace(/^\d+[.)]\s*/, ""))
    .filter(Boolean)
    .slice(0, 7);
}

/**
 * Cỡ chữ tự thích ứng — dùng chung công thức với bộ xuất PowerPoint để cái nhìn
 * trên màn hình khớp với file xuất ra.
 */
export function bodyFontPt(chars: number, hasVisual: boolean): number {
  const base = hasVisual ? 20 : 24;
  if (chars < 120) return base + 2;
  if (chars < 240) return base;
  if (chars < 360) return base - 3;
  if (chars < 480) return base - 5;
  return base - 7;
}
