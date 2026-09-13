/**
 * lib/slides.ts — Dựng danh sách slide đúng như bản PowerPoint sẽ xuất ra (V11.6)
 *
 * Trước đây khung xem trước trong trình biên tập chỉ là một khối chữ, không giống
 * slide thật, nên giáo viên không biết chữ có tràn không, hình có bị nhỏ không,
 * trước khi bấm Xuất. Tệp này mô tả từng slide theo đúng thứ tự và đúng cách chia
 * mà lib/exporters.ts dùng, để khung xem trước và trình chiếu toàn màn hình vẽ
 * lại y hệt.
 *
 * ------------------------------------------------------------------------
 * V11.6 — CỠ CHỮ ĐỌC ĐƯỢC TỪ CUỐI LỚP
 * ------------------------------------------------------------------------
 * V11.5 đặt chữ nội dung ở 17–24 pt, và khi slide có hình thì chữ bị nhét vào
 * cột trái rộng 3,65 in nên tụt xuống 18 pt. Chiếu lên màn 100 inch, học sinh
 * bàn cuối (cách 8–10 m) không đọc nổi. Bản thân hình còn tệ hơn: bảng biến
 * thiên bị bóp vào ô rộng 7,3 in nên chữ bên trong chỉ còn 13–15 pt.
 *
 * V11.6 lật ngược cách làm: CỠ CHỮ LÀ RÀNG BUỘC, BỐ CỤC PHẢI CHIỀU THEO.
 *
 *  1. Mọi chữ nội dung nằm trong khoảng TYPO.bodyMin..TYPO.bodyMax (32–36 pt).
 *     Không bao giờ thu nhỏ chữ để nhét cho vừa — thừa chữ thì SANG SLIDE MỚI.
 *  2. Bỏ bố cục "chữ trái – hình phải". Chữ trải hết bề ngang ở trên, hình nằm
 *     dưới và cũng trải hết bề ngang.
 *  3. Mỗi slide nhiều nhất MỘT hình.
 *  4. Hình chỉ được ở chung slide với chữ khi nó đủ "dẹt" để vẫn chiếm trọn bề
 *     ngang slide — xem canShareSlide(). Hình cao (đồ thị, quiz, bảng số liệu…)
 *     chiếm trọn một slide riêng, nhờ vậy chữ bên trong hình mới đủ to.
 *
 * Mọi con số ở đây tính bằng inch trên khổ 16:9 (13,333 × 7,5 in) — đúng hệ của
 * PowerPoint — nên khung xem trước và tệp xuất ra khớp nhau từng milimét.
 */

import type { Lesson, Section, Visual } from "./types";
import { mixedLatexToUnicode, needsRichMath } from "./latex";
import { hasTableCaption } from "./bbt";

/* ------------------------------------------------------------------ */
/* Thang cỡ chữ — NGUỒN DUY NHẤT                                       */
/* ------------------------------------------------------------------ */

/**
 * Cỡ chữ tính bằng point (pt) trên slide PowerPoint khổ 16:9.
 *
 * `bodyMin` là lời hứa với giáo viên: không một chữ nội dung nào nhỏ hơn con số
 * này. Các mục còn lại là chữ trang trí (chân slide, số trang, nhãn hình) —
 * học sinh không cần đọc, nên để nhỏ hơn để nhường chỗ cho bài giảng.
 */
export const TYPO = {
  /** Ngưỡng sàn cho MỌI chữ nội dung. Đừng hạ xuống dưới 32. */
  bodyMin: 32,
  /** Trần cho chữ nội dung — to hơn nữa thì mỗi slide chứa được quá ít. */
  bodyMax: 36,
  /** Các nấc thử, từ to xuống nhỏ. Luôn kết thúc ở bodyMin. */
  bodySteps: [36, 34, 32] as number[],

  /** Tiêu đề slide nội dung. */
  title: 32,
  /** Số thứ tự mục ("01") in to bên trái khối chữ. */
  sectionNo: 40,

  /** Slide bìa. */
  coverKicker: 16,
  coverTitle: 44,
  coverMeta: 22,
  coverTeacher: 20,
  coverSchool: 18,

  /** Slide phân cách hoạt động ("KHỞI ĐỘNG", "LUYỆN TẬP"…). */
  divider: 48,

  /** Slide kết. */
  endTitle: 40,
  endKeywords: 22,

  /** Chữ trang trí — không phải nội dung bài học. */
  badge: 14,
  pageNo: 14,
  footer: 12,
  visualLabel: 14,
  contPanel: 18,
  /** Dòng báo lỗi khi không dựng được hình. */
  warn: 20,
} as const;

/* ------------------------------------------------------------------ */
/* Đo chữ                                                              */
/* ------------------------------------------------------------------ */

/**
 * Bề rộng trung bình một ký tự, tính theo em.
 *
 * Đo bằng scripts/measure-typography.mjs trên chính hai phông mà bộ xuất dùng
 * (Calibri / Times New Roman) với văn bản Toán tiếng Việt có dấu. Để hơi rộng
 * hơn số đo thật một chút cho an toàn: thà chia sớm một slide còn hơn để chữ
 * tràn ra ngoài khung.
 */
const CHAR_EM = 0.52;
/** Chiều cao một dòng, tính theo em. */
const LINE_EM = 1.38;
/** Khoảng cách giữa hai gạch đầu dòng, tính bằng pt. */
const PARA_GAP_PT = 10;
/** Phần lùi đầu dòng của dấu chấm tròn, tính bằng inch trên mỗi 10 pt cỡ chữ. */
const BULLET_INDENT_IN = 0.32;

/**
 * Độ dài thật của một đoạn chữ khi đã hiện lên slide.
 *
 * Phải đổi LaTeX sang Unicode TRƯỚC KHI đếm: chuỗi "\\sqrt{x+1}" dài 11 ký tự
 * trong dữ liệu nhưng chỉ chiếm 6 ký tự "√(x+1)" trên slide. Đếm nhầm thì slide
 * bị chia sớm một cách vô cớ.
 */
function displayLength(text: string): number {
  const raw = String(text ?? "");
  if (!raw) return 0;
  if (raw.indexOf("\\") < 0 && raw.indexOf("$") < 0) return raw.length;
  try {
    return mixedLatexToUnicode(raw).text.length;
  } catch {
    return raw.length;
  }
}

/**
 * Chiều cao PHỤ TRỘI của các công thức dựng bằng KaTeX, tính theo số dòng.
 *
 * Một phân số hai tầng cao gần gấp 2,2 lần dòng chữ thường; "lim" có cận bên
 * dưới cao gấp rưỡi. Không cộng thêm thì khối chữ tính ra vừa ô nhưng dựng thật
 * lại tràn xuống dưới đáy slide.
 */
function extraLines(text: string): number {
  const raw = String(text ?? "");
  const count = (re: RegExp) => (raw.match(re) || []).length;
  // Số đo lấy từ bản dựng thật: một phân số cỡ đầy đủ (\displaystyle) chiếm
  // khoảng 2,4 dòng chữ, tức cao THÊM 1,4 dòng. "lim" có cận nằm dưới thêm 0,9.
  return count(/\\[dt]?frac\b/g) * 1.4 + count(/\\(?:lim|int|sum|prod|oint)_/g) * 0.9 + count(/\\sqrt\[/g) * 0.3;
}

/** Số dòng mà một đoạn chữ chiếm khi đặt vào ô rộng `wIn` inch ở cỡ `pt`. */
export function lineCount(text: string, wIn: number, pt: number): number {
  const usable = Math.max(0.5, wIn - BULLET_INDENT_IN);
  const perLine = Math.max(6, Math.floor((usable * 72) / (pt * CHAR_EM)));
  return Math.max(1, Math.ceil(displayLength(text) / perLine)) + extraLines(text);
}

/** Chiều cao (inch) của cả khối gạch đầu dòng. */
export function blockHeight(items: string[], wIn: number, pt: number): number {
  if (!items.length) return 0;
  const lines = items.reduce((sum, it) => sum + lineCount(it, wIn, pt), 0);
  const gaps = (items.length - 1) * PARA_GAP_PT;
  return (lines * pt * LINE_EM + gaps) / 72;
}

/**
 * Chọn cỡ chữ to nhất trong TYPO.bodySteps mà cả khối vẫn nằm gọn trong ô.
 * Không vừa ở cỡ nào thì trả về TYPO.bodyMin — phần thừa sẽ sang slide khác,
 * TUYỆT ĐỐI không thu chữ xuống dưới 32 pt.
 */
export function fitBodyPt(items: string[], wIn: number, hIn: number): number {
  for (const pt of TYPO.bodySteps) {
    if (blockHeight(items, wIn, pt) <= hIn) return pt;
  }
  return TYPO.bodyMin;
}

/**
 * Cắt danh sách gạch đầu dòng thành từng trang vừa chiều cao ô.
 *
 * Chia THAM LAM (nhồi đầy trang trước rồi mới sang trang sau) hay đẻ ra một
 * slide cuối chỉ có đúng một ý — nhìn rất hụt hẫng khi trình chiếu. Nên sau khi
 * biết cần bao nhiêu trang, hàm này chia lại cho đều: bốn ý thành 2 + 2 chứ
 * không phải 3 + 1.
 */
export function paginate(items: string[], wIn: number, hIn: number, pt: number): string[][] {
  if (!items.length) return [[]];

  const greedy = (list: string[]): string[][] => {
    const pages: string[][] = [];
    let cur: string[] = [];
    for (const it of list) {
      const next = cur.concat([it]);
      if (cur.length && blockHeight(next, wIn, pt) > hIn) {
        pages.push(cur);
        cur = [it];
      } else {
        cur = next;
      }
    }
    if (cur.length) pages.push(cur);
    return pages;
  };

  const need = greedy(items).length;
  if (need <= 1) return [items];

  // Chia đều theo số ý, rồi nới dần nếu có trang vẫn quá cao.
  for (let perPage = Math.ceil(items.length / need); perPage <= items.length; perPage++) {
    const pages: string[][] = [];
    for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
    if (pages.length === need && pages.every((pg) => blockHeight(pg, wIn, pt) <= hIn)) return pages;
  }
  return greedy(items);
}

/* ------------------------------------------------------------------ */
/* Bố cục slide — NGUỒN DUY NHẤT                                       */
/* ------------------------------------------------------------------ */

export const IN = 96;
export const SLIDE_W_IN = 13.333;
export const SLIDE_H_IN = 7.5;

/**
 * Vùng nội dung: từ dưới đường kẻ tiêu đề xuống tới trên chân slide.
 *
 * V11.6 để đường kẻ ở 1,22 in và ô tiêu đề chỉ cao 0,76 in — vừa đúng MỘT dòng
 * ở cỡ 32 pt. Tiêu đề dài hai dòng (rất hay gặp: "Ví dụ 2: Khảo sát hàm số
 * y = x³ + 3x + 1 (tiếp)") liền tràn qua đường kẻ và đè lên thanh màu bên trái.
 * V11.7 dành sẵn chỗ cho HAI dòng tiêu đề: chắc chắn không tràn, đổi lại vùng
 * nội dung ngắn đi 0,26 in — hình vẫn đạt ngưỡng 32 pt vì svgFontPx() tính lại.
 */
export const BAND = { x: 0.62, y: 1.64, w: 12.1, bottom: 7.02 };
export const BAND_H = BAND.bottom - BAND.y; // 5,38 in

/** Lề trong của mỗi khung, và chiều cao dành cho nhãn phía trên hình. */
const PAD = 0.26;
const VISUAL_LABEL_H = 0.3;
/** Khoảng hở giữa khối chữ và hình. */
const GAP = 0.16;

export const LAYOUT = {
  topBar: { x: 0, y: 0, w: SLIDE_W_IN, h: 0.14 },
  accentBar: { x: 0.58, y: 0.3, w: 0.14, h: 1.14 },
  /** Cao 1,24 in = đủ HAI dòng ở cỡ 32 pt. Căn giữa theo chiều dọc. */
  title: { x: 0.88, y: 0.26, h: 1.22, wWide: 10.9, wNarrow: 8.6, pt: TYPO.title },
  badge: { x: 9.62, y: 0.34, w: 2.3, h: 0.5, pt: TYPO.badge },
  pageNo: { x: 12.05, y: 0.4, w: 0.7, h: 0.38, pt: TYPO.pageNo },
  divider: { x: 0.58, y: 1.5, w: 12.17 },
  footer: { y: 7.16, h: 0.24, pt: TYPO.footer },

  /** Khối nội dung khi slide KHÔNG có hình. */
  textOnly: {
    box: { x: BAND.x, y: BAND.y, w: BAND.w, h: BAND_H },
    number: { x: 0.92, y: BAND.y + 0.2, w: 1.3, h: 0.9, pt: TYPO.sectionNo },
    bullets: { x: 2.3, y: BAND.y + PAD, w: 10.1, h: BAND_H - 2 * PAD },
  },

  /** Dòng nhắc trên slide "(tiếp)". */
  contPanel: { x: BAND.x, y: 1.54, w: 6, h: 0.34, pt: TYPO.contPanel },
} as const;

/**
 * Ô chữ của slide "Yêu cầu cần đạt" — rộng hơn slide nội dung vì không có số
 * thứ tự mục in to bên trái. Khai báo một chỗ để bộ dựng danh sách slide, bộ
 * xuất và khung xem trước dùng đúng cùng con số.
 */
export function objectivesBox(): Box {
  const b = LAYOUT.textOnly.bullets;
  return { x: b.x - 1.4, y: b.y, w: b.w + 1.4, h: b.h };
}

/** Khối chữ trải hết bề ngang, nằm TRÊN hình. Chiều cao tuỳ số dòng. */
export function textBandBox(bandH: number) {
  return {
    panel: { x: BAND.x, y: BAND.y, w: BAND.w, h: bandH },
    bullets: { x: BAND.x + 0.33, y: BAND.y + PAD * 0.7, w: BAND.w - 0.66, h: bandH - PAD * 1.4 },
  };
}

export type Box = { x: number; y: number; w: number; h: number };

/**
 * Ô dành cho hình.
 * `bandH` = 0 nghĩa là hình chiếm trọn vùng nội dung (không có chữ trên slide).
 */
export function visualBox(bandH: number): Box {
  const y = bandH > 0 ? BAND.y + bandH + GAP : BAND.y;
  return { x: BAND.x, y, w: BAND.w, h: BAND.bottom - y };
}

/** Ô ẢNH thật sự bên trong ô hình (đã trừ nhãn và lề). */
export function visualImageBox(box: Box): Box {
  return {
    x: box.x + 0.15,
    y: box.y + VISUAL_LABEL_H,
    w: box.w - 0.3,
    h: box.h - VISUAL_LABEL_H - 0.08,
  };
}

/* ------------------------------------------------------------------ */
/* Hình nào được ở chung slide với chữ                                 */
/* ------------------------------------------------------------------ */

/**
 * Tỉ lệ ngang/dọc DỰ ĐOÁN của từng loại hình, khớp với khung vẽ trong
 * components/MathVisuals.tsx và MathVisualsExtra.tsx.
 *
 * Vì sao phải biết trước: chữ bên trong hình chỉ đủ to khi hình được vẽ hết bề
 * ngang slide (11,8 in ≈ 850 pt). Muốn vậy thì ô chứa phải cao ít nhất
 * 850/tỉ-lệ. Hình càng "dẹt" càng cần ít chiều cao, nên càng dư chỗ cho chữ
 * phía trên. Hình càng "cao" thì càng phải chiếm trọn slide.
 */
export function visualCanvas(v: Visual): { w: number; h: number } {
  const anyV = v as any;
  switch (v.type) {
    case "variation_table":
      // Có dòng nhãn "y = x² - 4x + 3" phía trên thì khung vẽ cao thêm một dòng.
      return { w: VT_W, h: VT_H + (hasTableCaption(v) ? VT_CAPTION_H : 0) };
    case "sign_chart": {
      const rows = Math.max(1, (anyV.rows?.length || 1) as number);
      return { w: SC_W, h: SC_HEAD + rows * SC_ROW_H };
    }
    case "number_line": {
      const n = Math.max(1, (anyV.intervals?.length || 1) as number) + (anyV.points?.length ? 1 : 0);
      return { w: NL_W, h: NL_HEAD + n * NL_ROW_H };
    }
    case "formula":
      // Khối công thức dựng bằng HTML: một dòng công thức + chú thích.
      return { w: 900, h: anyV.caption ? 200 : 150 };
    case "graph":
      return { w: GRAPH_W, h: GRAPH_H };
    case "data_table": {
      const rows = Math.max(1, (anyV.rows?.length || 1) as number);
      return { w: 1000, h: 70 + (rows + 1) * 64 };
    }
    case "quiz": {
      const opts = Math.max(2, (anyV.options?.length || 4) as number);
      return { w: 1180, h: 140 + opts * 86 };
    }
    case "prob_tree": {
      const leaves = Math.max(2, (anyV.branches?.length || 2) as number);
      return { w: 860, h: Math.max(300, 80 + leaves * 78) };
    }
    case "box_plot": {
      const g = Math.max(1, (anyV.groups?.length || 1) as number);
      return { w: 860, h: 140 + g * 94 };
    }
    case "venn":
      return { w: 700, h: 420 };
    case "unit_circle":
      return { w: 900, h: 560 };
    case "stat_chart":
      return { w: 880, h: 470 };
    default:
      // solid_3d, oxyz, vector_2d, inequality_region… đều gần vuông.
      return { w: 780, h: 500 };
  }
}

export function visualAspect(v: Visual): number {
  const c = visualCanvas(v);
  return c.w / c.h;
}

/* --- Khung vẽ chuẩn của các hình dựng bằng SVG --- */
export const VT_W = 880;
export const VT_H = 300;
/** Chiều cao dòng nhãn đặt phía trên bảng biến thiên. */
export const VT_CAPTION_H = 54;
export const SC_W = 880;
export const SC_HEAD = 66;
export const SC_ROW_H = 58;
export const NL_W = 880;
export const NL_HEAD = 70;
export const NL_ROW_H = 54;
export const GRAPH_W = 900;
export const GRAPH_H = 405;

/** Bề rộng tối đa của ô hình, quy ra point. */
const FULL_IMAGE_W_PT = (BAND.w - 0.3) * 72;
/** Chiều cao tối đa của ô ảnh khi hình chiếm trọn slide, quy ra point. */
const FULL_IMAGE_H_PT = (BAND_H - VISUAL_LABEL_H - 0.08) * 72;

/**
 * Cỡ chữ (px) phải dùng BÊN TRONG khung vẽ W×H để khi hình được in lên slide
 * PowerPoint, chữ đó đạt `targetPt` point.
 *
 * Đây là mấu chốt mà V11.5 bỏ sót. Hình được thu phóng cho vừa ô chứa, nên chữ
 * bên trong bị thu theo. Bảng biến thiên khung 860 px đặt vào ô rộng 7,3 in chỉ
 * còn hệ số 0,61 — nhãn 22 px hoá ra 13 pt trên slide. Công thức dưới đây tính
 * ngược: biết ô chứa, biết khung vẽ, suy ra cỡ chữ nguồn.
 */
export function svgScale(w: number, h: number): number {
  return Math.min(FULL_IMAGE_W_PT / w, FULL_IMAGE_H_PT / h);
}

export function svgFontPx(w: number, h: number, targetPt: number = TYPO.bodyMin): number {
  // Làm tròn LÊN: làm tròn xuống thì 32,4 pt thành 31,8 pt, hụt ngưỡng.
  return Math.ceil(targetPt / svgScale(w, h));
}

/**
 * Chiều cao (inch) mà hình cần để được vẽ HẾT bề ngang slide — tức là để chữ
 * bên trong hình đạt cỡ tối đa.
 */
export function visualNeededHeight(v: Visual): number {
  return FULL_IMAGE_W_PT / visualAspect(v) / 72 + VISUAL_LABEL_H + 0.08;
}

/**
 * Chiều cao còn lại cho khối chữ nếu đặt hình này chung slide.
 * Số âm hoặc quá nhỏ nghĩa là không thể ở chung — hình phải chiếm trọn slide.
 */
export function bandRoomFor(v: Visual): number {
  return BAND_H - GAP - visualNeededHeight(v);
}

/** Chiều cao tối thiểu để khối chữ còn đáng đặt (một dòng ở cỡ sàn). */
const MIN_BAND_H = (TYPO.bodyMin * LINE_EM) / 72 + PAD * 1.4;

/* ------------------------------------------------------------------ */
/* Danh sách slide                                                     */
/* ------------------------------------------------------------------ */

export type SlideSpec =
  | { kind: "cover" }
  | { kind: "objectives"; items: string[]; bodyPt: number; richMath: boolean; part: number }
  | { kind: "divider"; phase: string }
  | {
      kind: "content";
      section: Section;
      sectionIndex: number;
      /** 0 = slide đầu của mục, 1 trở đi = slide "(tiếp)". */
      part: number;
      /** Các gạch đầu dòng hiện trên CHÍNH slide này (có thể rỗng). */
      bullets: string[];
      /** Cỡ chữ đã chốt cho khối chữ này — luôn ≥ TYPO.bodyMin. */
      bodyPt: number;
      /**
       * true = khối chữ này chứa công thức mà chữ Unicode một dòng không diễn
       * đạt nổi (phân số, lim có cận...). Bộ xuất sẽ dựng cả khối bằng KaTeX
       * thành ảnh thay vì in chữ thường. Xem needsRichMath() trong lib/latex.ts.
       */
      richMath: boolean;
      /** Chiều cao khối chữ (inch). 0 khi slide không có chữ. */
      bandH: number;
      /** Tối đa MỘT hình mỗi slide. */
      visual?: { visual: Visual; index: number };
      /** Slide này có in số thứ tự mục to bên trái không. */
      showNumber: boolean;
    }
  | { kind: "end" };

export type DeckMeta = { teacher?: string; school?: string; includeObjectives?: boolean };

/** Giữ lại cho mã cũ: mỗi slide giờ chỉ còn tối đa MỘT hình. */
export const VISUALS_PER_SLIDE = 1;

/**
 * Sắp xếp một mục thành các slide.
 *
 * Quy tắc, theo đúng thứ tự ưu tiên:
 *  1. Chữ luôn ở cỡ 32–36 pt.
 *  2. Nếu hình đầu tiên đủ dẹt và TOÀN BỘ chữ của mục vừa khoảng trống còn lại
 *     thì gộp: chữ trên, hình dưới, cùng một slide.
 *  3. Ngược lại: chữ đi trước trên các slide riêng (chia trang nếu dài), rồi
 *     mỗi hình một slide chiếm trọn bề ngang lẫn chiều cao.
 */
export function planSection(section: Section, sectionIndex: number): SlideSpec[] {
  const bullets = toBullets(section.content);
  const visuals = (section.visuals || []).map((visual, index) => ({ visual, index }));

  const textBox = LAYOUT.textOnly.bullets;
  const customBodyPt = section.fontSize?.body;
  const bodyPt = (automatic: number) => customBodyPt
    ? Math.max(20, Math.min(48, customBodyPt))
    : automatic;

  // --- Trường hợp không có hình -------------------------------------
  if (!visuals.length) {
    const pt = bodyPt(fitBodyPt(bullets, textBox.w, textBox.h));
    const pages = paginate(bullets, textBox.w, textBox.h, pt);
    return pages.map((page, i) => ({
      kind: "content" as const,
      section,
      sectionIndex,
      part: i,
      bullets: page,
      bodyPt: pt,
      richMath: page.some(needsRichMath),
      bandH: 0,
      showNumber: i === 0,
    }));
  }

  // --- Gộp chữ với hình đầu tiên nếu còn chỗ -------------------------
  const first = visuals[0];
  const room = bandRoomFor(first.visual);
  const bandW = BAND.w - 0.66;
  const bandTextH = room - PAD * 1.4;

  /** Slide chỉ có hình, không có chữ. */
  const visualOnly = (v: { visual: Visual; index: number }, part: number): SlideSpec => ({
    kind: "content",
    section,
    sectionIndex,
    part,
    bullets: [],
    bodyPt: TYPO.bodyMin,
    richMath: false,
    bandH: 0,
    visual: v,
    showNumber: false,
  });

  if (bullets.length && room >= MIN_BAND_H) {
    const pt = bodyPt(fitBodyPt(bullets, bandW, bandTextH));

    // (a) Cả mục vừa gọn trong dải chữ: một slide duy nhất, chữ trên hình dưới.
    const whole = blockHeight(bullets, bandW, pt) + PAD * 1.4;
    if (whole <= room) {
      const out: SlideSpec[] = [
        {
          kind: "content", section, sectionIndex, part: 0,
          bullets, bodyPt: pt, richMath: bullets.some(needsRichMath),
          bandH: Math.max(MIN_BAND_H, whole), visual: first, showNumber: false,
        },
      ];
      visuals.slice(1).forEach((v, i) => out.push(visualOnly(v, i + 1)));
      return out;
    }

    /**
     * (b) Chữ dài hơn dải: chia trang theo khổ chữ TOÀN SLIDE, rồi thử đưa
     * TRANG CUỐI xuống ở chung với hình. Nhờ vậy hình vẫn có chữ dẫn ngay bên
     * trên, và không sinh ra một slide trống trơn chỉ để đặt mỗi cái hình.
     */
    const ptFull = bodyPt(fitBodyPt(bullets, textBox.w, textBox.h));
    const pages = paginate(bullets, textBox.w, textBox.h, ptFull);
    const tail = pages[pages.length - 1];
    const tailPt = bodyPt(fitBodyPt(tail, bandW, bandTextH));
    const tailH = blockHeight(tail, bandW, tailPt) + PAD * 1.4;
    if (tailH <= room) {
      const out: SlideSpec[] = [];
      let part = 0;
      pages.slice(0, -1).forEach((page, i) => {
        out.push({
          kind: "content", section, sectionIndex, part: part++,
          bullets: page, bodyPt: ptFull, richMath: page.some(needsRichMath), bandH: 0, showNumber: i === 0,
        });
      });
      out.push({
        kind: "content", section, sectionIndex, part: part++,
        bullets: tail, bodyPt: tailPt, richMath: tail.some(needsRichMath),
        bandH: Math.max(MIN_BAND_H, tailH), visual: first,
        showNumber: pages.length === 1,
      });
      visuals.slice(1).forEach((v) => out.push(visualOnly(v, part++)));
      return out;
    }
  }

  // --- Không gộp được: chữ trước, mỗi hình một slide -----------------
  const out: SlideSpec[] = [];
  let part = 0;
  if (bullets.length) {
    const pt = bodyPt(fitBodyPt(bullets, textBox.w, textBox.h));
    paginate(bullets, textBox.w, textBox.h, pt).forEach((page, i) => {
      out.push({
        kind: "content", section, sectionIndex, part: part++,
        bullets: page, bodyPt: pt, richMath: page.some(needsRichMath), bandH: 0, showNumber: i === 0,
      });
    });
  }
  visuals.forEach((v) => out.push(visualOnly(v, part++)));
  return out;
}

export function buildDeck(lesson: Lesson, meta: DeckMeta = {}): SlideSpec[] {
  const deck: SlideSpec[] = [{ kind: "cover" }];

  if (meta.includeObjectives !== false && lesson.objectives?.length) {
    /**
     * Slide "Yêu cầu cần đạt" cũng phải CHIA TRANG như slide nội dung. V11.6 đổ
     * hết yêu cầu vào một slide; với bài có nhiều công thức (Bài 4 có ba phân
     * số) khối chữ cao gấp rưỡi ô chứa, và khi dựng thành ảnh nó bị thu lại còn
     * 24 pt — đúng cái mà cả bản nâng cấp này đang chống.
     */
    const box = objectivesBox();
    const pt = fitBodyPt(lesson.objectives, box.w, box.h);
    paginate(lesson.objectives, box.w, box.h, pt).forEach((page, i) => {
      deck.push({ kind: "objectives", items: page, bodyPt: pt, richMath: page.some(needsRichMath), part: i });
    });
  }

  let lastPhase: string | undefined;
  (lesson.sections || []).forEach((section, sectionIndex) => {
    if (section.phase && section.phase !== lastPhase) {
      deck.push({ kind: "divider", phase: section.phase });
      lastPhase = section.phase;
    }
    planSection(section, sectionIndex).forEach((s) => deck.push(s));
  });

  deck.push({ kind: "end" });
  return deck;
}

/** Slide đầu tiên tương ứng với một mục trong danh sách bên trái. */
export function findSlideForSection(deck: SlideSpec[], sectionIndex: number): number {
  const i = deck.findIndex((s) => s.kind === "content" && s.sectionIndex === sectionIndex && s.part === 0);
  return i < 0 ? 0 : i;
}

/** Một dòng trong danh sách slide của trình biên tập. */
export type SlideOutline = {
  /** Vị trí trong bản xuất, đếm từ 0. */
  index: number;
  kind: SlideSpec["kind"];
  /** Chữ hiện trong danh sách. */
  label: string;
  /** Mục tương ứng — chỉ slide nội dung mới có. */
  sectionIndex?: number;
  /** 0 = slide đầu của mục, 1 trở đi = slide "(tiếp)". */
  part?: number;
  /** Tổng số slide mà mục này chiếm. */
  parts?: number;
  /** Pha hoạt động, để danh sách tô đúng màu. */
  phase?: string;
  /** true = slide do phần mềm tự dựng, không có nội dung để sửa. */
  auto: boolean;
};

/**
 * Liệt kê TỪNG slide của bản xuất.
 *
 * Danh sách bên trái của V11.8 chỉ có một dòng cho mỗi mục, nên bài 18 mục mà
 * xuất ra 74 slide thì 56 slide kia không có cách nào mở ra xem. Giáo viên phải
 * xuất cả tệp PowerPoint mới biết slide "(tiếp)" trông thế nào — quá muộn.
 */
export function outlineDeck(deck: SlideSpec[]): SlideOutline[] {
  // Đếm trước số slide của mỗi mục để ghi được "tiếp 2/3".
  const dem = new Map<number, number>();
  deck.forEach((s) => {
    if (s.kind === "content") dem.set(s.sectionIndex, (dem.get(s.sectionIndex) ?? 0) + 1);
  });
  const demYeuCau = deck.filter((s) => s.kind === "objectives").length;

  return deck.map((s, index) => {
    if (s.kind === "cover") return { index, kind: s.kind, label: "Trang bìa", auto: true };
    if (s.kind === "end") return { index, kind: s.kind, label: "Trang kết", auto: true };
    if (s.kind === "objectives")
      return {
        index, kind: s.kind, auto: true,
        label: demYeuCau > 1 ? `Yêu cầu cần đạt (${s.part + 1}/${demYeuCau})` : "Yêu cầu cần đạt",
      };
    if (s.kind === "divider")
      return { index, kind: s.kind, label: "Trang phân cách", phase: s.phase, auto: true };

    const parts = dem.get(s.sectionIndex) ?? 1;
    const ten = s.section.heading?.trim() || "Chưa có tiêu đề";
    return {
      index, kind: s.kind, auto: false,
      label: parts > 1 && s.part > 0 ? `${ten} (tiếp ${s.part + 1}/${parts})` : ten,
      sectionIndex: s.sectionIndex, part: s.part, parts,
      phase: s.section.phase,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Chữ trên slide                                                      */
/* ------------------------------------------------------------------ */

/**
 * Tách nội dung thành các gạch đầu dòng — cùng quy tắc với bộ xuất PPTX.
 *
 * V11.5 cắt tối đa 7 ý rồi VỨT phần còn lại. Ở cỡ chữ 32 pt mỗi slide chỉ chứa
 * khoảng 4–5 ý, nên giới hạn cứng đó vừa làm mất bài vừa vô nghĩa: V11.6 giữ
 * đủ ý và cho chúng tràn sang slide sau.
 */
export function toBullets(raw: string): string[] {
  const text = String(raw ?? "").trim();
  const byLine = text.split(/\n+/).map((t) => t.trim()).filter(Boolean);
  const source =
    byLine.length > 1
      ? byLine
      : text.split(/(?:^|\s)[•·]\s|(?<=[.;])\s+(?=[A-ZĐÀ-Ỹ])/).map((t) => t.trim()).filter(Boolean);
  return source
    .map((t) => t.replace(/^[-–—•·]\s*/, "").replace(/^\d+[.)]\s*/, ""))
    .filter(Boolean);
}
