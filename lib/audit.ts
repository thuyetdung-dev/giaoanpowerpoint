/**
 * lib/audit.ts — Kiểm định & sửa chữa dữ liệu bài giảng (V11)
 *
 * Điểm yếu chí mạng của V10: hàm repairLesson() TỰ BỊA dữ liệu toán học.
 *   v.derivative = Array.from({length: expected}, (_, i) => v.derivative?.[i] ?? (i % 2 ? "0" : "+"))
 * Nghĩa là khi AI trả thiếu dấu, phần mềm điền "+ 0 + 0 +" rồi... báo "Đạt".
 * Giáo viên nhận được bảng biến thiên SAI nhưng mang nhãn xanh. Đây là rủi ro
 * chuyên môn lớn nhất của phần mềm.
 *
 * V11 đảo ngược nguyên tắc:
 *   - Không bao giờ bịa dấu đạo hàm hay giá trị. Thiếu thì đánh dấu "?" + báo lỗi.
 *   - Nếu có `expression`, TÍNH LẠI bảng biến thiên bằng đạo hàm số học và đối
 *     chiếu với dữ liệu AI (kiểm định chéo).
 *   - Phân biệt rõ: lỗi (chặn xuất) / cảnh báo (vẫn xuất được) / gợi ý sư phạm.
 */

import { laThuHepMien, solveVariationTable, tableMatches } from "./bbtsolve";
import type {
  Lesson, Visual, VariationVisual, GraphVisual, StatChartVisual,
  BoxPlotVisual, ProbTreeVisual, RegionVisual, Section,
} from "./types";
import { compileExpression, numericDerivative, evalAt, detectPoles } from "./mathexpr";
import { latexToUnicode, mixedLatexToUnicode } from "./latex";
import { formulaComplexity, isMeaningfulVisual } from "./slides";

export type AuditLevel = "error" | "warning" | "tip" | "ok";
export type AuditItem = {
  level: AuditLevel;
  code: string;
  message: string;
  /** Hướng dẫn sửa cụ thể, hiển thị trong bảng trợ giúp. */
  fix?: string;
  section?: number;
  visual?: number;
};

const MAX_CHARS_PER_SLIDE = 480;
const MAX_BULLETS = 6;

/* ------------------------------------------------------------------ */
/* Kiểm định                                                           */
/* ------------------------------------------------------------------ */

export function auditLesson(lesson: Lesson): AuditItem[] {
  const out: AuditItem[] = [];
  if (!lesson?.title?.trim()) {
    out.push({ level: "error", code: "TITLE", message: "Thiếu tên bài học.", fix: "Nhập tên bài ở ô trên cùng của trình biên tập." });
  }
  if (!lesson?.sections?.length) {
    out.push({ level: "error", code: "SECTIONS", message: "Bài giảng chưa có slide nội dung nào." });
    return out;
  }

  lesson.sections.forEach((s, si) => auditSection(s, si + 1, out));
  auditPedagogy(lesson, out);

  if (!out.some((x) => x.level === "error" || x.level === "warning")) {
    out.push({ level: "ok", code: "PASS", message: "Không phát hiện lỗi cấu trúc hoặc lỗi dữ liệu hình Toán." });
  }
  return out;
}

function auditSection(s: Section, index: number, out: AuditItem[]) {
  if (!s.heading?.trim()) {
    out.push({ level: "error", code: "HEADING", message: "Slide thiếu tiêu đề.", section: index });
  }
  const plain = mixedLatexToUnicode(s.content || "");
  const meaningfulVisuals = (s.visuals || []).filter(isMeaningfulVisual);
  const placeholderLines = (s.content || "").split(/\n+/).map((x) => x.trim()).filter((x) =>
    /^(?:CÔNG THỨC|BẢNG SỐ LIỆU|HỆ TRỤC Oxyz|HÌNH MINH HỌA|NỘI DUNG)$/i.test(x),
  );
  if (placeholderLines.length) {
    out.push({
      level: "warning", code: "CONTENT_PLACEHOLDER", section: index,
      message: `Còn nội dung giữ chỗ: ${placeholderLines.join(", ")}.`,
      fix: "Bổ sung dữ liệu thật hoặc xóa dòng giữ chỗ trước khi xuất PowerPoint.",
    });
  }
  if (!plain.text.trim() && !meaningfulVisuals.length) {
    out.push({
      level: "error", code: "SECTION_EMPTY", section: index,
      message: "Mục này không còn nội dung thật sau khi loại hình giữ chỗ; V12.9 sẽ không sinh slide trắng.",
      fix: "Nhập nội dung, thêm hình Toán đầy đủ hoặc xóa mục này.",
    });
  }
  if (/khởi động/i.test(s.heading || "") && /\?\s*$/.test(s.content || "") && !meaningfulVisuals.length && !s.notes?.trim()) {
    out.push({
      level: "warning", code: "QUESTION_NO_FOLLOWUP", section: index,
      message: "Câu hỏi khởi động chưa có hình, gợi ý hoặc ghi chú hướng xử lý.",
      fix: "Thêm lời giải ở mục kế tiếp hoặc ghi chú giáo viên để mạch bài không bị đứt.",
    });
  }
  if (plain.text.length < 20 && !(s.visuals?.length)) {
    out.push({ level: "warning", code: "CONTENT_SHORT", message: "Slide gần như trống: không có chữ lẫn hình.", section: index });
  }
  if (plain.text.length > MAX_CHARS_PER_SLIDE) {
    out.push({
      level: "warning", code: "CONTENT_LONG", section: index,
      message: `Slide dài ${plain.text.length} ký tự, vượt ngưỡng ${MAX_CHARS_PER_SLIDE} — chữ sẽ bị co nhỏ khi chiếu.`,
      fix: "Tách thành 2 slide hoặc chuyển bớt phần diễn giải xuống ghi chú giáo viên.",
    });
  }
  if (plain.unknownCommands.length) {
    out.push({
      level: "warning", code: "LATEX_UNKNOWN", section: index,
      message: `Lệnh LaTeX chưa hỗ trợ khi xuất PowerPoint: ${plain.unknownCommands.join(", ")}.`,
      fix: "Viết lại bằng ký hiệu thông dụng, hoặc chuyển công thức đó thành visual dạng formula để giữ nguyên nét chữ Toán.",
    });
  }
  // đếm số dấu $ để phát hiện công thức chưa đóng
  const dollars = (s.content || "").split("$").length - 1;
  if (dollars % 2 !== 0) {
    out.push({ level: "error", code: "MATH_UNCLOSED", section: index, message: "Có dấu $ chưa đóng cặp, công thức sẽ hiển thị sai." });
  }
  const bullets = (s.content || "").split(/\n|\s-\s/).filter((t) => t.trim()).length;
  if (bullets > MAX_BULLETS) {
    out.push({ level: "tip", code: "TOO_MANY_BULLETS", section: index, message: `Slide có ${bullets} ý; nên giữ tối đa ${MAX_BULLETS} ý để học sinh kịp theo dõi.` });
  }
  // Bảng kẻ bằng ký tự "|" — AI hay làm khi không nhớ ra là có sẵn loại hình bảng.
  // Trên slide, thứ này trông như một dòng chữ lộn xộn, không ra bảng.
  const pipeLines = (s.content || "").split(/\n/).filter((line) => (line.match(/\|/g) || []).length >= 2);
  if (pipeLines.length >= 2) {
    out.push({
      level: "warning", code: "ASCII_TABLE", section: index,
      message: `Slide đang kẻ bảng bằng ký tự "|" trong phần chữ (${pipeLines.length} dòng). Chiếu lên màn hình sẽ thành một dãy chữ lộn xộn, không ra bảng.`,
      fix: 'Xoá mấy dòng đó khỏi "content" và thêm một hình thật: variation_table (bảng biến thiên), sign_chart (bảng xét dấu) hoặc data_table (bảng số liệu).',
    });
  }

  // Đề bài nhắc "có bảng biến thiên như sau" nhưng slide không hề có bảng
  const mentionsTable = /b[aả]ng bi[eế]n thi[eê]n (nh[uư] sau|sau đây|b[eê]n)|c[oó] b[aả]ng bi[eế]n thi[eê]n/i.test(s.content || "");
  const hasTable = (s.visuals || []).some((v) => v.type === "variation_table");
  if (mentionsTable && !hasTable) {
    out.push({
      level: "warning", code: "BBT_MISSING_VISUAL", section: index,
      message: "Đề bài nói \u201ccó bảng biến thiên\u201d nhưng slide không có bảng nào để học sinh nhìn.",
      fix: 'Thêm một hình "variation_table" vào slide này; học sinh cần thấy bảng mới trả lời được.',
    });
  }

  if ((s.visuals?.length ?? 0) > 2) {
    out.push({
      level: "tip", code: "VISUAL_CROWDED", section: index,
      message: `Slide có ${s.visuals!.length} hình; bản xuất sẽ tự tách sang slide phụ để không bị nhỏ.`,
    });
  }
  (s.visuals || []).forEach((v, vi) => auditVisual(v, index, vi, out));
}

function auditVisual(v: Visual, section: number, visual: number, out: AuditItem[]) {
  const at = { section, visual };
  if (!isMeaningfulVisual(v)) {
    out.push({
      level: "warning", code: "VISUAL_PLACEHOLDER", ...at,
      message: "Hình công thức chỉ là mũi tên hoặc nội dung giữ chỗ; V12.8 sẽ không tạo slide riêng cho hình này.",
      fix: "Thay bằng công thức đầy đủ nếu đây là nội dung cần giảng.",
    });
  }
  // Phép kiểm riêng cho TỪNG loại hình, thêm ở V12.0. Chạy trước để lỗi dữ liệu
  // hiện ra kể cả khi nhánh switch bên dưới không có gì để nói.
  kiemHinhThem(v, at, out);
  switch (v.type) {
    case "formula": {
      if (!v.latex?.trim()) { out.push({ level: "error", code: "FORMULA_EMPTY", message: "Công thức trống.", ...at }); break; }
      const braces = (v.latex.match(/\{/g) || []).length - (v.latex.match(/\}/g) || []).length;
      if (braces !== 0) out.push({ level: "error", code: "FORMULA_BRACE", message: "Công thức lệch dấu ngoặc nhọn { }.", ...at });
      const conv = latexToUnicode(v.latex);
      if (String(v.latex).length > 150 || formulaComplexity(v.latex) >= 5)
        out.push({
          level: "warning", code: "FORMULA_DENSE", ...at,
          message: "Công thức dài hoặc nhiều tầng; V12.9 đã tăng khung và tự điều chỉnh cỡ nhưng vẫn nên xem trước.",
          fix: "Tách thành hai công thức theo từng bước nếu bản xem trước còn quá dày.",
        });
      if (conv.unknownCommands.length)
        out.push({ level: "tip", code: "FORMULA_EXOTIC", message: `Lệnh ít gặp: ${conv.unknownCommands.join(", ")} — vẫn hiển thị đẹp trên web nhưng sẽ là chữ thường khi xuất PPTX.`, ...at });
      break;
    }
    case "variation_table": auditVariation(v, section, visual, out); break;
    case "sign_chart": {
      const n = v.x?.length ?? 0;
      if (n < 2) { out.push({ level: "error", code: "SIGN_X", message: "Bảng xét dấu cần ít nhất 2 mốc.", ...at }); break; }
      const rows = v.rows?.length ? v.rows : [{ label: v.label ?? "", signs: v.signs ?? [] }];
      rows.forEach((r) => {
        if (r.signs.length !== 2 * n - 3 && r.signs.length !== n - 1)
          out.push({
            level: "error", code: "SIGN_LENGTH", ...at,
            message: `Dòng "${r.label || "f(x)"}" có ${r.signs.length} ô, cần ${2 * n - 3} ô (dấu xen kẽ nghiệm) hoặc ${n - 1} ô (chỉ dấu trên khoảng).`,
          });
      });
      break;
    }
    case "graph": auditGraph(v, section, visual, out); break;
    case "stat_chart": auditStat(v, section, visual, out); break;
    case "box_plot": auditBox(v, section, visual, out); break;
    case "prob_tree": auditTree(v, section, visual, out); break;
    case "inequality_region": auditRegion(v, section, visual, out); break;
    case "quiz": {
      if (!v.options?.length || v.options.length < 2)
        out.push({ level: "error", code: "QUIZ_OPTIONS", message: "Câu hỏi trắc nghiệm cần ít nhất 2 phương án.", ...at });
      else if (v.answerIndex < 0 || v.answerIndex >= v.options.length)
        out.push({ level: "error", code: "QUIZ_ANSWER", message: "Chỉ số đáp án đúng nằm ngoài danh sách phương án.", ...at });
      break;
    }
    case "oxyz": {
      const points = v.points?.length ?? 0;
      if (points > 5)
        out.push({
          level: "warning", code: "OXYZ_LABEL_DENSE", ...at,
          message: `Hình Oxyz có ${points} điểm; nhãn có thể quá dày dù đã tự tránh va chạm.`,
          fix: "Chia thành hai hình hoặc chỉ ghi tên điểm, chuyển tọa độ xuống phần chữ.",
        });
      break;
    }
    case "data_table": {
      const bad = v.rows.findIndex((r) => r.length !== v.headers.length);
      if (bad >= 0) out.push({ level: "error", code: "TABLE_SHAPE", message: `Dòng ${bad + 1} có số ô khác số cột tiêu đề.`, ...at });
      break;
    }
    default: break;
  }
}

/**
 * BỘ KIỂM ĐỊNH PHẢI NÓI CÙNG MỘT ĐIỀU VỚI BỘ DỰNG HÌNH (V12.1).
 *
 * Từ V12.1, bảng nào CÓ `expression` thì lúc vẽ phần mềm tự tính lại cả bảng
 * và vẽ theo bản tính được (components/MathVisuals.tsx). Vậy nếu vẫn báo "lỗi
 * chặn xuất" cho số liệu cũ thì phần mềm tự mâu thuẫn: nó chặn thầy xuất một
 * hình mà chính nó vẽ ĐÚNG.
 *
 * Cách xử lý: VẪN soi từng chỗ sai và nói rõ sai ở đâu — lời chẩn đoán chính
 * xác mới giúp được thầy — nhưng hạ mọi "lỗi chặn xuất" xuống mức cảnh báo, và
 * nói thêm một câu cho biết phần mềm đã tự tính lại.
 */
function auditVariation(v: VariationVisual, section: number, visual: number, out: AuditItem[]) {
  const giai = v.expression ? solveVariationTable(v.expression) : null;
  /* Bảng thu hẹp trên miền con: phần mềm KHÔNG kiểm chứng được, và cũng không
     được ghi đè. Nói thật điều đó thay vì báo nhầm là "đã tự tính lại". */
  if (giai?.ok && laThuHepMien(v, giai)) {
    out.push({
      level: "tip", code: "BBT_MIEN_CON", section, visual,
      message: `Bảng chỉ xét trên một phần tập xác định của y = ${v.expression} (từ ${v.x?.[0]} đến ${v.x?.[v.x.length - 1]}).`,
      fix: "Phần mềm giữ nguyên bảng này nhưng CHƯA tự kiểm chứng được bảng trên miền con — thầy cô soát lại dấu y′ giúp.",
    });
    /* Vẫn soi lỗi CÚ PHÁP (thiếu ô, độ dài mảng sai) — chỉ bỏ những phép kiểm
       đối chiếu với biểu thức, vì chúng tính trên cả ℝ nên báo sai ở miền con. */
    const rieng2: AuditItem[] = [];
    auditVariationChiTiet(v, section, visual, rieng2);
    rieng2
      .filter((i) => !["BBT_SIGN_MISMATCH", "BBT_VALUE_MISMATCH", "BBT_NODE_NOT_ROOT"].includes(i.code))
      .forEach((i) => out.push(i));
    return;
  }
  const tuTinhLai = !!giai?.ok && !tableMatches(v, giai);
  const rieng: AuditItem[] = [];
  auditVariationChiTiet(v, section, visual, rieng);
  if (!tuTinhLai) { rieng.forEach((it) => out.push(it)); return; }
  out.push({
    level: "warning", code: "BBT_DA_TU_TINH_LAI", section, visual,
    message: `Số liệu bảng không khớp với y = ${v.expression}; khi vẽ và khi xuất, phần mềm dùng bảng TỰ TÍNH LẠI từ biểu thức.`,
    fix: 'Bấm "Tự sửa" để ghi bảng đã tính vào dữ liệu bài, hoặc sửa lại biểu thức nếu biểu thức mới là chỗ sai.',
  });
  rieng.forEach((it) => out.push(it.level === "error" ? { ...it, level: "warning" } : it));
}

function auditVariationChiTiet(v: VariationVisual, section: number, visual: number, out: AuditItem[]) {
  const at = { section, visual };
  const n = v.x?.length ?? 0;
  if (n < 2) { out.push({ level: "error", code: "BBT_X", message: "Bảng biến thiên cần ít nhất 2 mốc x.", ...at }); return; }
  if ((v.values?.length ?? 0) !== n)
    out.push({ level: "error", code: "BBT_VALUE_LENGTH", ...at, message: `Hàng y có ${v.values?.length ?? 0} giá trị nhưng có ${n} mốc x.`, fix: "Mỗi mốc x phải có đúng một giá trị hoặc giới hạn của y." });

  const expected = 2 * n - 3;
  const soDau = v.derivative?.length ?? 0;
  if (soDau !== expected) {
    /* Cho đủ dấu trên KHOẢNG mà thiếu ô tại MỐC (n−1 ô thay vì 2n−3) là ca
       riêng: bảng vẫn vẽ được, chỉ trống ô mốc. Bảng có tham số m thì không
       tính lại được nên đây là lựa chọn hợp lệ của thầy — cảnh báo, đừng chặn
       xuất. Thiếu kiểu khác thì vẫn là lỗi. */
    const chiDauKhoang = soDau === n - 1 && n > 2;
    out.push({
      level: chiDauKhoang ? "warning" : "error", code: "BBT_DERIVATIVE_LENGTH", ...at,
      message: chiDauKhoang
        ? `Hàng y′ chỉ có dấu trên ${n - 1} khoảng, chưa có ô tại ${n - 2} mốc. Ô mốc sẽ để TRỐNG.`
        : `Hàng y′ cần ${expected} ô (xen kẽ dấu và nghiệm) nhưng đang có ${soDau}.`,
      fix: chiDauKhoang
        ? 'Điền "0" tại mốc là nghiệm của y′, "||" tại mốc không xác định — xen kẽ dấu và mốc.'
        : undefined,
    });
  }

  if ((v.derivative ?? []).some((d) => d === "?" || d === ""))
    out.push({ level: "error", code: "BBT_UNKNOWN_SIGN", ...at, message: "Còn ô dấu y′ chưa xác định (?). Không được xuất khi chưa điền đủ." });

  // dấu phải đổi chiều quanh nghiệm bội lẻ: hai khoảng liên tiếp cùng dấu mà ở giữa là "0" -> nghi ngờ
  const der = v.derivative ?? [];
  for (let i = 0; i + 2 < der.length; i += 2) {
    if (der[i] && der[i] === der[i + 2] && der[i + 1] === "0") {
      out.push({
        level: "warning", code: "BBT_NO_EXTREMUM", ...at,
        message: `Tại mốc ${v.x[i / 2 + 1]}: y′ đổi từ "${der[i]}" sang "${der[i + 2]}" (không đổi dấu) nên đây KHÔNG phải cực trị.`,
        fix: "Kiểm tra lại: nếu là nghiệm bội chẵn thì bỏ ghi cực trị; nếu nhầm dấu thì sửa hàng y′.",
      });
    }
  }

  v.discontinuities?.forEach((d) => {
    if (d.index <= 0 || d.index >= n - 1)
      out.push({ level: "warning", code: "BBT_BREAK", message: "Điểm gián đoạn phải nằm giữa hai đầu mút của bảng.", ...at });
  });

  // KIỂM ĐỊNH CHÉO bằng đạo hàm số học — điểm mới của V11
  if (v.expression) {
    const c = compileExpression(v.expression);
    if (!c.ok) {
      out.push({ level: "warning", code: "BBT_EXPR", message: `Không đọc được biểu thức kiểm chứng: ${c.error}`, ...at });
      return;
    }
    const nodes = v.x.map(parseBound);
    for (let i = 0; i < n - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      if (!Number.isFinite(a) && !Number.isFinite(b)) continue;
      const lo = Number.isFinite(a) ? a : b - 4;
      const hi = Number.isFinite(b) ? b : a + 4;
      if (!(hi > lo)) continue;
      const samples = [0.25, 0.5, 0.75].map((t) => lo + (hi - lo) * t);
      const ds = samples.map((x) => numericDerivative(v.expression!, x)).filter(Number.isFinite);
      if (!ds.length) continue;
      const positive = ds.every((d) => d > 1e-6);
      const negative = ds.every((d) => d < -1e-6);
      const declared = (der[i * 2] ?? "").trim();
      if (positive && declared === "-")
        out.push({ level: "error", code: "BBT_SIGN_MISMATCH", ...at, message: `Trên khoảng (${v.x[i]}; ${v.x[i + 1]}) đạo hàm tính được MANG DẤU DƯƠNG nhưng bảng ghi "−".` });
      if (negative && declared === "+")
        out.push({ level: "error", code: "BBT_SIGN_MISMATCH", ...at, message: `Trên khoảng (${v.x[i]}; ${v.x[i + 1]}) đạo hàm tính được MANG DẤU ÂM nhưng bảng ghi "+".` });
    }
    /**
     * MỐC TRONG BẢNG PHẢI LÀ NGHIỆM CỦA y′ (V11.8).
     *
     * Vì sao thêm: cho tới V11.7 bộ kiểm định chỉ so DẤU của y′ trên từng
     * khoảng. Với y = (x²-x+1)/(x+1) thì AI ghi mốc x = 0 và x = 1 — dấu trên
     * các khoảng vẫn ra đúng nên không có lỗi nào bị báo, trong khi nghiệm
     * thật là x = -1 ± √3. Đúng cái lỗ này đã để bảng sai đi tới slide.
     *
     * Mốc giữa bảng chỉ được là một trong hai thứ: nghiệm của y′ (cực trị),
     * hoặc điểm gián đoạn (đã khai báo trong discontinuities).
     */
    const breaks = new Set((v.discontinuities ?? []).map((d) => d.index));
    for (let i = 1; i < n - 1; i++) {
      if (breaks.has(i)) continue;
      const x = parseBound(v.x[i]);
      if (!Number.isFinite(x)) continue;
      const y = evalAt(v.expression!, x);
      if (!Number.isFinite(y)) {
        out.push({
          level: "error", code: "BBT_NODE_UNDEFINED", ...at,
          message: `Tại x = ${v.x[i]}: hàm số không xác định nhưng mốc này chưa được ghi là điểm gián đoạn.`,
          fix: "Thêm mốc vào discontinuities, hoặc bỏ mốc nếu ghi nhầm.",
        });
        continue;
      }
      const d = numericDerivative(v.expression!, x);
      // Ngưỡng theo độ lớn của hàm: y′ của (x²-x+1)/(x+1) tại x = 0 bằng -1,
      // còn của x³-3x tại nghiệm thật chỉ lệch cỡ 1e-9 do sai số vi phân số.
      const nguong = Math.max(1e-3, Math.abs(y) * 1e-3);
      if (Number.isFinite(d) && Math.abs(d) > nguong)
        out.push({
          level: "error", code: "BBT_NODE_NOT_ROOT", ...at,
          message: `Tại x = ${v.x[i]}: y′ tính được ≈ ${d.toFixed(3)} ≠ 0, nên đây KHÔNG phải điểm cực trị.`,
          fix: "Giải y′ = 0 để lấy đúng mốc. Bấm “Tự sửa” để phần mềm dựng lại bảng từ biểu thức.",
        });
    }

    // đối chiếu giá trị tại các mốc hữu hạn
    v.x.forEach((raw, i) => {
      const x = parseBound(raw);
      // Giá trị trong bảng là LaTeX, có thể là "-3 - 2\sqrt{3}" hoặc "\approx 1,73".
      // Cắt theo [^0-9.-] như trước sẽ biến chuỗi đó thành "-3-23" → NaN, tức là
      // bỏ qua im lặng đúng những ô đáng kiểm nhất.
      const declared = parseBound(v.values?.[i] ?? "");
      if (!Number.isFinite(x) || !Number.isFinite(declared)) return;
      const actual = evalAt(v.expression!, x);
      if (Number.isFinite(actual) && Math.abs(actual - declared) > Math.max(0.02, Math.abs(actual) * 0.01))
        out.push({ level: "warning", code: "BBT_VALUE_MISMATCH", ...at, message: `Tại x = ${raw}: bảng ghi y = ${v.values?.[i]} nhưng hàm số cho y ≈ ${actual.toFixed(3)}.` });
    });
  }
}

function parseBound(raw: string): number {
  const t = String(raw ?? "")
    .replace(/\\approx|≈|\\pm|±/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")   // 1,73 (cách viết Việt Nam) → 1.73
    .replace(/\\infty|∞/g, "Inf")
    .replace(/\s/g, "");
  if (!t || /^[|‖·.\-+]+$/.test(t)) return NaN;   // ô trống hoặc ô "‖" tại điểm gián đoạn
  if (/^[+]?Inf$/.test(t)) return Number.POSITIVE_INFINITY;
  if (/^-Inf$/.test(t)) return Number.NEGATIVE_INFINITY;
  const c = compileExpression(t);
  return c.ok ? c.eval(0) : NaN;
}

function auditGraph(v: GraphVisual, section: number, visual: number, out: AuditItem[]) {
  const at = { section, visual };
  if (!(v.xMin < v.xMax) || !(v.yMin < v.yMax)) {
    out.push({ level: "error", code: "GRAPH_RANGE", message: "Miền vẽ không hợp lệ (xMin ≥ xMax hoặc yMin ≥ yMax).", ...at });
    return;
  }
  /**
   * ĐƯỜNG CHÍNH BỊ BỎ QUÊN (V11.8).
   *
   * Khi AI khai cả `expression` lẫn `expressions`, bản cũ chỉ vẽ `expressions`
   * — nên đồ thị hàm số được nêu trong đề bài biến mất khỏi hình mà không có
   * cảnh báo nào. V11.8 đã sửa phần vẽ để gộp cả hai; cảnh báo dưới đây để
   * thầy biết hình sẽ có thêm một đường so với JSON mà AI mô tả.
   */
  const norm = (s: unknown) => String(s ?? "").replace(/\s/g, "");
  if (v.expression && (v.expressions?.length ?? 0) > 0 && !v.expressions!.some((e) => norm(e?.expression) === norm(v.expression)))
    out.push({
      level: "tip", code: "GRAPH_MAIN_CURVE", ...at,
      message: `Danh sách nhiều đường không chứa hàm chính y = ${v.expression} — phần mềm tự vẽ thêm đường này.`,
      fix: "Nếu không muốn vẽ hàm chính, bỏ trống expression và chỉ dùng expressions.",
    });

  // Kiểm đúng những đường SẼ được vẽ: hàm chính cộng danh sách, bỏ bản trùng.
  const list: string[] = [];
  [...(v.expression ? [v.expression] : []), ...(v.expressions ?? []).map((e) => e?.expression)].forEach((e) => {
    if (e && !list.some((k) => norm(k) === norm(e))) list.push(e);
  });
  if (!list.length) list.push(v.expression);
  let visible = 0, total = 0;
  list.forEach((expr) => {
    const c = compileExpression(expr);
    if (!c.ok) {
      out.push({ level: "error", code: "GRAPH_EXPR", message: `Biểu thức "${expr}" không hợp lệ: ${c.error}`, ...at });
      return;
    }
    for (let i = 0; i <= 200; i++) {
      const x = v.xMin + ((v.xMax - v.xMin) * i) / 200;
      const y = c.eval(x);
      if (!Number.isFinite(y)) continue;
      total++;
      if (y >= v.yMin && y <= v.yMax) visible++;
    }
  });
  if (total > 0 && visible / total < 0.15)
    out.push({
      level: "warning", code: "GRAPH_OUT_OF_VIEW", ...at,
      message: `Chỉ ${Math.round((visible / total) * 100)}% đồ thị nằm trong khung nhìn — học sinh sẽ thấy hình gần như trống.`,
      fix: "Nới rộng yMin/yMax cho khớp với giá trị thực của hàm số.",
    });

  /* Tiệm cận đứng có thật nhưng chưa khai báo.
     Từ V12.1 phần mềm TỰ VẼ đường tiệm cận ấy, nên lời nhắc phải nói rõ là
     hình đã có đủ — nói "chưa vẽ" thì thầy đi tìm một lỗi không tồn tại. */
  const poles = detectPoles(v.expression, v.xMin, v.xMax);
  const declared = new Set((v.asymptotes ?? []).filter((a) => a.kind === "vertical").map((a) => Math.round((a.value ?? 0) * 100)));
  poles.forEach((p) => {
    if (!declared.has(Math.round(p * 100)))
      out.push({ level: "tip", code: "GRAPH_ASYMPTOTE", ...at,
                message: `Hàm số có tiệm cận đứng x ≈ ${p.toFixed(2)}; phần mềm đã tự vẽ đường này trên hình.`,
                fix: "Khai vào asymptotes nếu muốn ghi rõ phương trình tiệm cận trong dữ liệu bài." });
  });

  v.points?.forEach((q) => {
    const y = evalAt(v.expression, q.x);
    if (Number.isFinite(y) && Math.abs(y - q.y) > Math.max(0.05, Math.abs(y) * 0.02))
      out.push({ level: "warning", code: "GRAPH_POINT", ...at, message: `Điểm ${q.label || `(${q.x}; ${q.y})`} không nằm trên đồ thị (giá trị đúng ≈ ${y.toFixed(3)}).` });
  });
}

function auditStat(v: StatChartVisual, section: number, visual: number, out: AuditItem[]) {
  const at = { section, visual };
  if (!v.series?.length) { out.push({ level: "error", code: "STAT_EMPTY", message: "Biểu đồ chưa có dãy số liệu.", ...at }); return; }
  v.series.forEach((s, i) => {
    const need = v.chart === "histogram" ? (v.bins?.length ?? 1) - 1 : v.labels.length;
    if (s.values.length !== need)
      out.push({ level: "error", code: "STAT_LENGTH", ...at, message: `Dãy ${i + 1} có ${s.values.length} số nhưng cần ${need} theo nhãn/mốc lớp.` });
    if (s.values.some((x) => !Number.isFinite(x)))
      out.push({ level: "error", code: "STAT_NAN", ...at, message: `Dãy ${i + 1} chứa giá trị không phải số.` });
  });
  if (v.chart === "pie") {
    const sum = v.series[0].values.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 0.5 && Math.abs(sum - 1) > 0.01)
      out.push({ level: "tip", code: "PIE_SUM", ...at, message: `Tổng các phần là ${sum}; biểu đồ hình quạt sẽ tự quy về 100%.` });
  }
}

function auditBox(v: BoxPlotVisual, section: number, visual: number, out: AuditItem[]) {
  v.groups.forEach((g, i) => {
    if (!(g.min <= g.q1 && g.q1 <= g.median && g.median <= g.q3 && g.q3 <= g.max))
      out.push({
        level: "error", code: "BOX_ORDER", section, visual,
        message: `Nhóm "${g.name || i + 1}": phải có min ≤ Q₁ ≤ Q₂ ≤ Q₃ ≤ max (đang là ${g.min}, ${g.q1}, ${g.median}, ${g.q3}, ${g.max}).`,
      });
  });
}

function auditTree(v: ProbTreeVisual, section: number, visual: number, out: AuditItem[]) {
  /**
   * DẤU PHẨY VIỆT NAM (V12.1).
   *
   * Bản cũ gọi Number("0,6") — ra NaN, rồi `|| 0` biến thành 0. Thành ra sơ đồ
   * cây ghi ĐÚNG kiểu Việt Nam ("0,6" và "0,4") bị báo "tổng xác suất nhánh
   * cấp 1 bằng 0,000". Chính ô hướng dẫn của phần mềm dạy thầy viết dấu phẩy,
   * rồi bộ kiểm định lại bắt lỗi cách viết ấy — đó là lỗi của phần mềm, không
   * phải của thầy. Dùng chung docXacSuat() với các phép kiểm V12.0.
   */
  const num = (s: string) => {
    const t = String(s).replace(/\s/g, "");
    if (t.includes("%")) {
      const p = docXacSuat(t.replace("%", ""));
      return Number.isFinite(p) ? p / 100 : NaN;
    }
    return docXacSuat(t);
  };
  const sum = v.branches.reduce((a, b) => a + (num(b.p) || 0), 0);
  if (Math.abs(sum - 1) > 0.02)
    out.push({ level: "warning", code: "TREE_SUM", section, visual, message: `Tổng xác suất nhánh cấp 1 bằng ${sum.toFixed(3)}, lẽ ra bằng 1.` });
  v.branches.forEach((b) => {
    if (!b.children?.length) return;
    const s = b.children.reduce((a, c) => a + (num(c.p) || 0), 0);
    if (Math.abs(s - 1) > 0.02)
      out.push({ level: "warning", code: "TREE_SUM_CHILD", section, visual, message: `Nhánh "${b.label}": tổng xác suất con bằng ${s.toFixed(3)}, lẽ ra bằng 1.` });
  });
}

function auditRegion(v: RegionVisual, section: number, visual: number, out: AuditItem[]) {
  if (!v.constraints?.length)
    out.push({ level: "error", code: "REGION_EMPTY", message: "Chưa có bất phương trình nào để xác định miền nghiệm.", section, visual });
  v.vertices?.forEach((q) => {
    const bad = v.constraints.find((c) => {
      const s = c.a * q.x + c.b * q.y;
      const eps = 1e-6;
      return c.op === "<=" || c.op === "<" ? s > c.c + eps : s < c.c - eps;
    });
    if (bad)
      /* Nâng từ CẢNH BÁO lên LỖI ở V12.0: bài quy hoạch tuyến tính lấy giá trị
         lớn nhất TẠI ĐỈNH, nên một đỉnh không thoả ràng buộc làm sai cả bài
         giải — không phải chuyện trình bày mà là chuyện đúng sai. */
      out.push({
        level: "error", code: "REGION_VERTEX", section, visual,
        message: `Đỉnh ${q.label || `(${q.x}; ${q.y})`} KHÔNG thoả ràng buộc ${bad.label || `${bad.a}x + ${bad.b}y ${bad.op} ${bad.c}`}.`,
        fix: "Giải hệ hai phương trình để lấy đúng giao điểm, hoặc bỏ đỉnh này khỏi danh sách.",
      });
  });
}

/* ------------------------------------------------------------------ */
/* Chuẩn hoá mốc x                                                     */
/*                                                                     */
/* Lỗi phổ biến nhất của AI: viết x = [-1, 1] rồi cho 3 ô dấu. AI đang  */
/* nghĩ theo kiểu "hai nghiệm chia trục số thành ba khoảng" — đúng về   */
/* toán, nhưng lược đồ đòi hỏi liệt kê ĐỦ CẢ HAI ĐẦU MÚT ±∞ trong x.    */
/* Khi số ô dấu cho biết chắc chắn còn thiếu đúng hai đầu mút, phần mềm */
/* tự thêm vào — đây là suy luận xác định, không phải đoán mò.          */
/* ------------------------------------------------------------------ */

/** Đưa mốc về chuỗi LaTeX chuẩn: số -> chuỗi, "inf"/"-inf" -> \infty. */
function normalizeBound(raw: unknown): string {
  if (typeof raw === "number") return String(raw);
  const t = String(raw ?? "").trim();
  if (/^[+]?(inf|infty|infinity|∞)$/i.test(t)) return "+\\infty";
  if (/^-(inf|infty|infinity|∞)$/i.test(t)) return "-\\infty";
  return t;
}

function hasMinusInfinity(t: string) { return /-\s*(\\infty|∞)/.test(t); }
function hasPlusInfinity(t: string) { return /(^|[^-])\s*(\\infty|∞)/.test(t); }

/**
 * Thêm hai đầu mút ±∞ khi số ô dấu chứng tỏ chúng bị thiếu.
 * Trả về null nếu không suy ra được chắc chắn (khi đó KHÔNG đụng vào dữ liệu).
 */
function completeBounds(x: string[], signCount: number): string[] | null {
  if (!x.length || signCount <= 0) return null;
  const already = hasMinusInfinity(x[0]) || hasPlusInfinity(x[x.length - 1]);
  if (already) return null;
  const n = x.length + 2;
  // Hợp lệ nếu sau khi thêm, số ô khớp một trong hai dạng được phép
  if (signCount === n - 1 || signCount === 2 * n - 3) return ["-\\infty", ...x, "+\\infty"];
  return null;
}

/* ------------------------------------------------------------------ */
/* Kiểm định sư phạm (CT GDPT 2018)                                    */
/* ------------------------------------------------------------------ */

function auditPedagogy(lesson: Lesson, out: AuditItem[]) {
  const phases = new Set(lesson.sections.map((s) => s.phase).filter(Boolean));
  const required: [string, string][] = [
    ["khoi_dong", "Khởi động"],
    ["luyen_tap", "Luyện tập"],
    ["van_dung", "Vận dụng"],
  ];
  required.forEach(([key, name]) => {
    if (!phases.has(key as never))
      out.push({ level: "tip", code: `PHASE_${key.toUpperCase()}`, message: `Bài giảng chưa có hoạt động "${name}" — theo CT GDPT 2018 nên có đủ chuỗi Khởi động → Hình thành kiến thức → Luyện tập → Vận dụng.` });
  });

  const visualCount = lesson.sections.reduce((n, s) => n + (s.visuals?.length ?? 0), 0);
  if (visualCount / Math.max(1, lesson.sections.length) < 0.35)
    out.push({ level: "tip", code: "LOW_VISUAL", message: `Chỉ ${visualCount} hình trên ${lesson.sections.length} slide. Bài Toán chiếu chữ nhiều sẽ khó giữ chú ý; hãy thêm đồ thị, bảng biến thiên hoặc biểu đồ.` });

  const quizzes = lesson.sections.filter((s) => s.visuals?.some((v) => v.type === "quiz")).length;
  if (quizzes === 0)
    out.push({ level: "tip", code: "NO_INTERACTION", message: "Chưa có slide tương tác (câu hỏi bấm chọn). Thêm 2–3 câu ở phần Luyện tập để kiểm tra nhanh cả lớp." });

  const withNotes = lesson.sections.filter((s) => s.notes?.trim()).length;
  if (withNotes < lesson.sections.length * 0.5)
    out.push({ level: "tip", code: "FEW_NOTES", message: `Chỉ ${withNotes}/${lesson.sections.length} slide có ghi chú cho giáo viên. Ghi chú sẽ được đưa vào phần Notes của PowerPoint.` });

  const totalMinutes = lesson.sections.reduce((n, s) => n + (s.minutes ?? 0), 0);
  if (totalMinutes > 0 && (totalMinutes < 30 || totalMinutes > 100))
    out.push({ level: "tip", code: "TIMING", message: `Tổng thời lượng dự kiến ${totalMinutes} phút — hãy đối chiếu với số tiết đã chọn (1 tiết = 45 phút).` });
}

/* ------------------------------------------------------------------ */
/* Sửa chữa (chỉ sửa cái CHẮC CHẮN đúng)                               */
/* ------------------------------------------------------------------ */

function clean(s: string) {
  return String(s ?? "").normalize("NFC").replace(/`\s+/g, " ").replace(/\s{2,}/g, " ").trim();
}

export type RepairReport = { lesson: Lesson; changes: string[]; unresolved: string[] };

export function repairLesson(input: Lesson): RepairReport {
  const lesson = structuredClone(input);
  const changes: string[] = [];
  const unresolved: string[] = [];

  lesson.title = clean(lesson.title);
  lesson.sections = (lesson.sections || []).map((s, si) => {
    const heading = clean(s.heading) || `Nội dung ${si + 1}`;
    if (heading !== s.heading) changes.push(`Slide ${si + 1}: chuẩn hoá tiêu đề.`);
    const content = clean(s.content);

    const visuals = (s.visuals || []).map((v, vi) => {
      const where = `Slide ${si + 1} · hình ${vi + 1}`;
      if (v.type === "variation_table") {
        /**
         * V11.8 — DỰNG LẠI TOÀN BỘ BẢNG TỪ BIỂU THỨC.
         *
         * Bộ sinh nội dung làm toán không đáng tin. Với y = (x²-x+1)/(x+1) nó đưa
         * ra mốc x = -3 và x = 1, trong khi nghiệm thật của y′ = 0 là x = -1 ± √3.
         * Dấu của y′ trên từng khoảng lại đúng, nên phép kiểm định cũ (chỉ đối
         * chiếu dấu) không hề bắt được — bảng sai vẫn báo "Đạt" và lên slide.
         *
         * Nay hễ có trường `expression` thì phần mềm TỰ GIẢI và thay thẳng. Đây
         * không phải bịa dữ liệu: biểu thức là nguồn sự thật, còn bảng chỉ là
         * cách trình bày của nó. Bảng KHÔNG có `expression` (ví dụ đề cho sẵn
         * bảng để hỏi học sinh) thì không đụng tới.
         */
        if (v.expression) {
          const solved = solveVariationTable(v.expression);
          if (solved.ok && !tableMatches(v, solved)) {
            v.x = solved.x;
            v.derivative = solved.derivative;
            v.values = solved.values;
            v.discontinuities = solved.discontinuities;
            changes.push(
              `${where}: dựng lại bảng biến thiên từ y = ${v.expression} — ${solved.notes.join("; ")}.`,
            );
          } else if (!solved.ok) {
            unresolved.push(`${where}: không tự kiểm được bảng (${solved.error}). Hãy đối chiếu lại bằng tay.`);
          }
        }
        // Chuẩn hoá mốc trước, rồi bù đầu mút ±∞ nếu chắc chắn thiếu
        v.x = (v.x ?? []).map(normalizeBound);
        const completed = completeBounds(v.x, v.derivative?.length ?? 0)
          ?? (v.expression ? completeBounds(v.x, (v.x.length + 2) - 1) : null);
        if (completed) {
          v.x = completed;
          changes.push(`${where}: bổ sung hai đầu mút −∞ và +∞ còn thiếu ở hàng x.`);
        }
        const n = Math.max(2, v.x?.length || 0);
        v.x = Array.from({ length: n }, (_, i) => v.x?.[i] ?? (i === 0 ? "-\\infty" : i === n - 1 ? "+\\infty" : "?"));
        // KHÔNG bịa giá trị: thiếu thì để "?" và báo ra ngoài
        if ((v.values?.length ?? 0) !== n) {
          const computed = v.expression ? computeValues(v.expression, v.x) : null;
          if (computed) {
            v.values = computed;
            changes.push(`${where}: tính lại hàng giá trị y từ biểu thức ${v.expression}.`);
          } else {
            v.values = Array.from({ length: n }, (_, i) => v.values?.[i] ?? "?");
            unresolved.push(`${where}: thiếu giá trị y ở một số mốc — cần nhập tay hoặc bổ sung trường "expression".`);
          }
        }
        const expected = 2 * n - 3;
        if ((v.derivative?.length ?? 0) !== expected) {
          // nếu có biểu thức, TÍNH LẠI thay vì bịa
          const derived = v.expression ? deriveSigns(v.expression, v.x) : null;
          if (derived) {
            v.derivative = derived;
            changes.push(`${where}: tính lại hàng y′ từ biểu thức ${v.expression}.`);
          } else {
            v.derivative = Array.from({ length: expected }, (_, i) => v.derivative?.[i] ?? (i % 2 ? "0" : "?"));
            unresolved.push(`${where}: thiếu dấu đạo hàm. Phần mềm KHÔNG tự điền để tránh sai kiến thức — hãy bổ sung dấu hoặc điền trường "expression".`);
          }
        }
        v.discontinuities = (v.discontinuities || []).filter((d) => d.index > 0 && d.index < n - 1);
      }
      if (v.type === "sign_chart") {
        v.x = (v.x ?? []).map(normalizeBound);
        const completed = completeBounds(v.x, v.signs?.length ?? 0);
        if (completed) {
          v.x = completed;
          changes.push(`${where}: bổ sung hai đầu mút −∞ và +∞ còn thiếu ở hàng x.`);
        }
        const n = Math.max(2, v.x?.length || 0);
        const expected = 2 * n - 3;
        if ((v.signs?.length ?? 0) !== expected && (v.signs?.length ?? 0) !== n - 1) {
          unresolved.push(`${where}: bảng xét dấu có ${v.signs?.length ?? 0} ô, cần ${expected} ô (dấu xen kẽ nghiệm) hoặc ${n - 1} ô (chỉ dấu trên khoảng).`);
        }
      }
      if (v.type === "graph") {
        if (!(v.xMin < v.xMax)) { v.xMin = -5; v.xMax = 5; changes.push(`${where}: đặt lại miền x về [-5; 5].`); }
        if (!(v.yMin < v.yMax)) { v.yMin = -5; v.yMax = 5; changes.push(`${where}: đặt lại miền y về [-5; 5].`); }
        // tự nới khung nhìn cho khớp hàm số — an toàn vì không đổi bản chất toán học
        const fit = fitRange(v.expression, v.xMin, v.xMax);
        if (fit && (fit.yMin < v.yMin || fit.yMax > v.yMax)) {
          v.yMin = fit.yMin; v.yMax = fit.yMax;
          changes.push(`${where}: nới khung nhìn y về [${fit.yMin}; ${fit.yMax}] để thấy trọn đồ thị.`);
        }
      }
      return v;
    });

    return { ...s, heading, content, visuals };
  });

  return { lesson, changes, unresolved };
}

/**
 * Tính hàng giá trị y từ biểu thức. Mốc hữu hạn thì thay số trực tiếp; mốc ±∞
 * thì xét giá trị ở rất xa để biết hàm tiến tới +∞ hay −∞.
 */
function computeValues(expression: string, xs: string[]): string[] | null {
  const c = compileExpression(expression);
  if (!c.ok) return null;
  const out: string[] = [];
  for (const raw of xs) {
    const x = parseBound(raw);
    if (x === Number.POSITIVE_INFINITY || x === Number.NEGATIVE_INFINITY) {
      const far = x > 0 ? 1e6 : -1e6;
      const y = c.eval(far);
      if (!Number.isFinite(y)) return null;
      out.push(y > 0 ? "+\\infty" : "-\\infty");
      continue;
    }
    if (!Number.isFinite(x)) return null;
    const y = c.eval(x);
    if (!Number.isFinite(y)) return null;
    out.push(String(Math.round(y * 1000) / 1000));
  }
  return out;
}

/** Suy ra hàng dấu y′ từ biểu thức bằng đạo hàm số học (chỉ dùng khi có expression). */
function deriveSigns(expression: string, xs: string[]): string[] | null {
  const c = compileExpression(expression);
  if (!c.ok) return null;
  const nodes = xs.map(parseBound);
  const n = xs.length;
  const out: string[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = nodes[i], b = nodes[i + 1];
    const lo = Number.isFinite(a) ? a : (Number.isFinite(b) ? b - 4 : -4);
    const hi = Number.isFinite(b) ? b : (Number.isFinite(a) ? a + 4 : 4);
    if (!(hi > lo)) return null;
    const ds = [0.2, 0.5, 0.8].map((t) => numericDerivative(expression, lo + (hi - lo) * t)).filter(Number.isFinite);
    if (!ds.length) return null;
    if (ds.every((d) => d > 0)) out.push("+");
    else if (ds.every((d) => d < 0)) out.push("-");
    else return null;
    if (i < n - 2) out.push("0");
  }
  return out;
}

/** Gợi ý khung nhìn y hợp lý cho đồ thị. */
function fitRange(expression: string, xMin: number, xMax: number): { yMin: number; yMax: number } | null {
  const c = compileExpression(expression);
  if (!c.ok) return null;
  const ys: number[] = [];
  for (let i = 0; i <= 400; i++) {
    const y = c.eval(xMin + ((xMax - xMin) * i) / 400);
    if (Number.isFinite(y) && Math.abs(y) < 1e6) ys.push(y);
  }
  if (ys.length < 20) return null;
  ys.sort((a, b) => a - b);
  // bỏ 3% đuôi để không bị tiệm cận kéo giãn
  const lo = ys[Math.floor(ys.length * 0.03)];
  const hi = ys[Math.floor(ys.length * 0.97)];
  const pad = Math.max(1, (hi - lo) * 0.18);
  return { yMin: Math.floor(lo - pad), yMax: Math.ceil(hi + pad) };
}

/* ================================================================== */
/* V12.0 — Kiểm định cho TỪNG loại hình                                */
/*                                                                     */
/* Tới V11.8 chỉ bảng biến thiên và đồ thị được kiểm bằng toán học;    */
/* mười bốn loại còn lại muốn ghi gì cũng được. Xác suất các nhánh cộng */
/* lại thành 1,1; tứ phân vị Q₃ nhỏ hơn Q₁; đỉnh miền nghiệm không     */
/* thoả ràng buộc nào — tất cả đều lên slide mà phần mềm báo "Đạt".    */
/*                                                                     */
/* Nguyên tắc giữ nguyên như V11: CHỈ BÁO, KHÔNG BỊA. Chỗ nào tính     */
/* được thì đối chiếu; chỗ nào không thì nói rõ là không kiểm được.    */
/* ================================================================== */

/** Đọc một xác suất viết dạng chuỗi: "0,6" hoặc "0.6" hoặc "3/5". */
function docXacSuat(raw: unknown): number {
  const t = String(raw ?? "").replace(/\s/g, "").replace(",", ".");
  if (!t) return NaN;
  const phan = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(t);
  if (phan) return Number(phan[1]) / Number(phan[2]);
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** Gần bằng nhau, với sai số tương đối — số liệu thống kê hay làm tròn. */
function xapXi(a: number, b: number, eps = 5e-3): boolean {
  return Math.abs(a - b) <= Math.max(eps, Math.abs(b) * eps);
}

function kiemHinhThem(v: Visual, at: { section: number; visual: number }, out: AuditItem[]) {
  const loi = (code: string, message: string, fix?: string) =>
    out.push({ level: "error", code, message, ...(fix ? { fix } : {}), ...at });
  const canh = (code: string, message: string, fix?: string) =>
    out.push({ level: "warning", code, message, ...(fix ? { fix } : {}), ...at });

  switch (v.type) {
    case "sign_chart": {
      const n = v.x?.length ?? 0;
      if (n < 2) break;   // đã có SIGN_X báo ở nhánh switch chính
      const dong = v.rows?.length ? v.rows : [{ label: v.label || "f(x)", signs: v.signs ?? [] }];
      dong.forEach((r, i) => {
        if ((r.signs ?? []).some((c) => c === "?" || c === ""))
          loi("SC_UNKNOWN", `Dòng "${r.label || i + 1}" của bảng xét dấu còn ô chưa điền.`);
        /* Ô "0" của một dòng phải là NGHIỆM của chính biểu thức dòng đó.
           Bảng xét dấu tích (x-1)(x+2) hay bị ghi số 0 ở CẢ HAI mốc cho CẢ HAI
           dòng, trong khi mỗi dòng chỉ triệt tiêu tại nghiệm của riêng nó; mốc
           kia phải ghi "|". Sai chỗ này là dạy sai cách lập bảng. */
        const bt = compileExpression(String(r.label ?? ""));
        if (!bt.ok) return;
        for (let k = 1; k < n - 1; k++) {
          const x = parseBound(v.x[k]);
          const oDau = (r.signs ?? [])[2 * k - 1];
          if (!Number.isFinite(x) || oDau === undefined) continue;
          const y = bt.eval(x);
          if (!Number.isFinite(y)) continue;
          const laNghiem = Math.abs(y) < 1e-9;
          if (oDau === "0" && !laNghiem)
            canh("SC_ZERO", `Dòng "${r.label}" ghi số 0 tại x = ${v.x[k]}, nhưng ${r.label} = ${y.toFixed(3)} ≠ 0 ở đó.`,
                 'Mốc không phải nghiệm của dòng này thì ghi dấu "|" theo lối SGK.');
          if (oDau !== "0" && oDau !== "||" && laNghiem)
            canh("SC_ZERO", `Dòng "${r.label}" triệt tiêu tại x = ${v.x[k]} nhưng bảng không ghi số 0 ở đó.`);
        }
      });
      break;
    }

    case "stat_chart": {
      if (!v.labels?.length) { loi("CHART_LABELS", "Biểu đồ chưa có tên cho các cột / phần."); break; }
      if (v.chart === "pie") {
        const gt = v.series?.[0]?.values ?? [];
        if (gt.some((x) => x < 0)) loi("PIE_NEG", "Biểu đồ hình quạt không nhận số âm.");
        if (!gt.some((x) => x > 0)) loi("PIE_ZERO", "Mọi số liệu đều bằng 0, không vẽ được hình quạt.");
        if ((v.series?.length ?? 0) > 1)
          canh("PIE_MULTI", "Hình quạt chỉ vẽ được một dãy số liệu; các dãy sau sẽ bị bỏ qua.");
      }
      if (v.chart === "histogram") {
        const b2 = v.bins ?? [];
        if (b2.length < 2)
          canh("HIST_BINS", "Tần số ghép nhóm cần khai mốc lớp ở trường bins, ví dụ [150, 155, 160, 165].");
        for (let i = 1; i < b2.length; i++)
          if (!(b2[i] > b2[i - 1])) { loi("HIST_ORDER", `Mốc lớp phải tăng dần, đang có ${b2[i - 1]} rồi ${b2[i]}.`); break; }
      }
      break;
    }

    case "box_plot": {
      (v.groups ?? []).forEach((g, i) => {
        const ten = g.name || `Nhóm ${i + 1}`;
        if ([g.min, g.q1, g.median, g.q3, g.max].some((x) => !Number.isFinite(x)))
          loi("BOX_NAN", `Nhóm "${ten}" thiếu một trong năm số min, q1, median, q3, max.`);
        (g.outliers ?? []).forEach((o) => {
          if (o >= g.min && o <= g.max)
            canh("BOX_OUTLIER", `Nhóm "${ten}": giá trị ngoại lệ ${o} lại nằm trong đoạn [${g.min}; ${g.max}] của chính nhóm đó.`,
                 "Giá trị ngoại lệ phải nằm ngoài hai đầu râu; nằm trong thì nó không phải ngoại lệ.");
        });
      });
      break;
    }

    case "prob_tree": {
      (v.branches ?? []).forEach((b2) => {
        const pb = docXacSuat(b2.p);
        if (!Number.isFinite(pb))
          canh("TREE_P", `Nhánh "${b2.label}" có xác suất không đọc được: "${b2.p}".`);
        else if (pb < 0 || pb > 1)
          loi("TREE_RANGE", `Nhánh "${b2.label}" có xác suất ${b2.p} — xác suất phải nằm trong [0; 1].`);
        /* Xác suất cả đường đi = TÍCH hai xác suất trên đường. Sai chỗ này là
           sai đúng cái mà bài xác suất có điều kiện muốn dạy. */
        (b2.children ?? []).forEach((c) => {
          const pc = docXacSuat(c.p), kq = docXacSuat(c.result);
          if (!Number.isFinite(kq) || !Number.isFinite(pb) || !Number.isFinite(pc)) return;
          if (pc < 0 || pc > 1)
            loi("TREE_RANGE", `Nhánh "${b2.label}" → "${c.label}" có xác suất ${c.p} ngoài [0; 1].`);
          if (!xapXi(kq, pb * pc, 1e-2))
            loi("TREE_PRODUCT", `Nhánh "${b2.label}" → "${c.label}": ghi kết quả ${c.result} nhưng ${b2.p} × ${c.p} = ${(pb * pc).toFixed(3)}.`);
        });
      });
      break;
    }

    case "number_line": {
      if (!(v.max > v.min)) { loi("NL_RANGE", `Trục số có min = ${v.min} không nhỏ hơn max = ${v.max}.`); break; }
      (v.intervals ?? []).forEach((iv, i) => {
        const a2 = iv.from === "-inf" ? -Infinity : Number(iv.from);
        const b2 = iv.to === "+inf" ? Infinity : Number(iv.to);
        if (!(b2 > a2)) loi("NL_INTERVAL", `Khoảng ${iv.label || i + 1} có đầu trái ${iv.from} không nhỏ hơn đầu phải ${iv.to}.`);
        [[a2, iv.from], [b2, iv.to]].forEach(([val, raw]) => {
          if (Number.isFinite(val as number) && ((val as number) < v.min || (val as number) > v.max))
            canh("NL_OUT", `Khoảng ${iv.label || i + 1} có mút ${raw} nằm ngoài trục [${v.min}; ${v.max}] nên sẽ bị cắt.`,
                 `Nới trường min / max của trục số cho chứa hết các khoảng.`);
        });
      });
      break;
    }

    case "inequality_region": {
      (v.constraints ?? []).forEach((c, i) => {
        if (Math.abs(c.a) < 1e-12 && Math.abs(c.b) < 1e-12)
          loi("REG_DEGEN", `Ràng buộc ${c.label || i + 1} có cả a và b bằng 0 — không phải một đường thẳng.`);
      });
      (v.vertices ?? []).forEach((q) => {
        if (q.x < v.xMin || q.x > v.xMax || q.y < v.yMin || q.y > v.yMax)
          canh("REG_VIEW", `Đỉnh ${q.label || `(${q.x}; ${q.y})`} nằm ngoài khung nhìn nên không hiện trên hình.`);
      });
      break;
    }

    case "solid_3d": {
      const n = v.baseSides ?? (v.shape === "tetrahedron" ? 3 : 4);
      const laChop = v.shape === "pyramid" || v.shape === "tetrahedron" || v.shape === "cone";
      const laLangTru = v.shape === "prism" || v.shape === "cube" || v.shape === "cylinder";
      const ds = v.labels ?? [];
      if (ds.length) {
        const trung = ds.filter((x, i) => ds.indexOf(x) !== i);
        if (trung.length) loi("SOLID_DUP", `Tên đỉnh bị trùng: ${[...new Set(trung)].join(", ")}.`);
        /* Hình nón chỉ có MỘT đỉnh, không có đa giác đáy, nên không thể đòi
           n+1 tên: mẫu "hình nón đỉnh S" đang bị báo "cần 5 tên nhưng có 1".
           Chỉ đếm tên với khối có đỉnh đa giác. */
        const demTen = v.shape === "pyramid" || v.shape === "tetrahedron";
        if (demTen && ds.length !== n && ds.length !== n + 1)
          canh("SOLID_LABELS", `Hình chóp ${n} cạnh đáy cần ${n + 1} tên nhưng đang có ${ds.length}.`,
               "Tên ĐẦU TIÊN là đỉnh chóp, đúng lối gọi S.ABCD — ví dụ S, A, B, C, D.");
        if (laLangTru && ds.length !== n && ds.length !== 2 * n)
          canh("SOLID_LABELS", `Lăng trụ ${n} cạnh đáy cần ${2 * n} tên (đáy rồi mặt trên) nhưng đang có ${ds.length}.`);
      }
      const coTenDinh = laChop && ds.length > n;
      const tenCo = new Set<string>(([
        ...(laChop ? [coTenDinh ? ds[0] : "S"] : []),
        ...Array.from({ length: n }, (_, i) => (coTenDinh ? ds[i + 1] : ds[i]) ?? "ABCDEFGH"[i]),
        ...(laLangTru ? Array.from({ length: n }, (_, i) => ds[n + i] ?? `${ds[i] ?? "ABCDEFGH"[i]}'`) : []),
      ] as (string | undefined)[]).filter((x): x is string => !!x));
      (v.highlights ?? []).forEach((h) => {
        [h.from, h.to].forEach((t) => {
          if (t && !tenCo.has(t))
            canh("SOLID_EDGE", `Đoạn nhấn mạnh nhắc tới đỉnh "${t}" mà hình không có đỉnh nào tên vậy — đoạn đó sẽ không được vẽ.`,
                 `Các đỉnh hiện có: ${[...tenCo].join(", ")}.`);
        });
      });
      break;
    }

    case "oxyz": {
      const R = v.range ?? 4;
      (v.points ?? []).forEach((q) => {
        const xa = Math.max(Math.abs(q.x), Math.abs(q.y), Math.abs(q.z));
        if (xa > R)
          canh("OXYZ_RANGE", `Điểm ${q.label || `(${q.x}; ${q.y}; ${q.z})`} có toạ độ vượt range = ${R}.`,
               `Đặt range ít nhất ${Math.ceil(xa)} để điểm nằm trong hình.`);
      });
      (v.planes ?? []).forEach((pl, i) => {
        if (Math.abs(pl.a) < 1e-12 && Math.abs(pl.b) < 1e-12 && Math.abs(pl.c) < 1e-12)
          loi("OXYZ_PLANE", `Mặt phẳng ${pl.label || i + 1} có a = b = c = 0 — không phải một mặt phẳng.`);
      });
      if (v.sphere && !(v.sphere.r > 0)) loi("OXYZ_SPHERE", "Mặt cầu có bán kính không dương.");
      /**
       * Khai cả `sphere.label` lẫn một điểm cùng tên ở ĐÚNG tâm mặt cầu thì
       * phần mềm viết hai lần một chữ vào cùng một chỗ: "I(1; 1; 1)" và "I"
       * chồng lên nhau thành một khối chữ không đọc được. Đây là lỗi tôi nhìn
       * thấy trong ảnh dựng thử của chính mình, nên chắc chắn giáo viên cũng sẽ
       * viết như vậy.
       */
      if (v.sphere?.label) {
        const sp = v.sphere;
        const trung = (v.points ?? []).find(
          (q) => q.label === sp.label &&
                 Math.abs(q.x - sp.x) < 1e-9 && Math.abs(q.y - sp.y) < 1e-9 && Math.abs(q.z - sp.z) < 1e-9,
        );
        if (trung)
          canh("OXYZ_TRUNG_NHAN",
               `Tâm mặt cầu và điểm "${sp.label}" cùng toạ độ, cùng tên nên hai nhãn viết đè lên nhau.`,
               `Bỏ một trong hai: giữ điểm "${sp.label}" trong points, hoặc bỏ label của sphere.`);
      }
      (v.vectors ?? []).forEach((vec, i) => {
        if (Math.abs(vec.x) < 1e-12 && Math.abs(vec.y) < 1e-12 && Math.abs(vec.z) < 1e-12)
          canh("OXYZ_VEC0", `Vectơ ${vec.label || i + 1} là vectơ không nên không vẽ được.`);
      });
      break;
    }

    case "vector_2d": {
      if (!(v.xMin < v.xMax) || !(v.yMin < v.yMax)) { loi("VEC_RANGE", "Khung nhìn của hình vectơ không hợp lệ."); break; }
      (v.vectors ?? []).forEach((vec, i) => {
        if (Math.abs(vec.x2 - vec.x1) < 1e-12 && Math.abs(vec.y2 - vec.y1) < 1e-12)
          canh("VEC_ZERO", `Vectơ ${vec.label || i + 1} có điểm đầu trùng điểm cuối.`);
        ([[vec.x1, vec.y1], [vec.x2, vec.y2]] as [number, number][]).forEach(([x, y]) => {
          if (x < v.xMin || x > v.xMax || y < v.yMin || y > v.yMax)
            canh("VEC_VIEW", `Vectơ ${vec.label || i + 1} có đầu (${x}; ${y}) nằm ngoài khung nhìn.`);
        });
      });
      if (v.showParallelogram && (v.vectors?.length ?? 0) >= 2) {
        const [a2, b2] = v.vectors;
        if (Math.abs(a2.x1 - b2.x1) > 1e-9 || Math.abs(a2.y1 - b2.y1) > 1e-9)
          canh("VEC_PARA", "Quy tắc hình bình hành cần hai vectơ CHUNG GỐC; hai vectơ đầu đang khác điểm đầu nên hình bình hành sẽ không được vẽ.");
      }
      break;
    }

    case "venn": {
      const so = v.sets?.length ?? 0;
      if (so < 2 || so > 3) loi("VENN_SETS", `Biểu đồ Ven vẽ được 2 hoặc 3 tập hợp, đang khai ${so}.`);
      const ten = new Set((v.sets ?? []).map((x) => x.name));
      (v.shade ?? []).forEach((sh) => {
        const la = String(sh).replace(/[^A-Za-z]/g, "").split("").filter((c) => !ten.has(c));
        if (la.length) canh("VENN_SHADE", `Vùng tô "${sh}" nhắc tới tập ${[...new Set(la)].join(", ")} không có trong hình.`);
      });
      break;
    }

    case "quiz": {
      const ds = v.options ?? [];
      const chuan = ds.map((x) => String(x).replace(/\s/g, ""));
      const trung = chuan.filter((x, i) => chuan.indexOf(x) !== i);
      if (trung.length) loi("QUIZ_DUP", "Có hai phương án giống nhau — học sinh không chọn được đáp án nào.");
      if (!v.question?.trim()) loi("QUIZ_Q", "Câu hỏi trắc nghiệm để trống.");
      break;
    }

    case "unit_circle": {
      (v.angles ?? []).forEach((a2) => {
        const t = String(a2.value ?? "").replace(/\\pi|π/g, String(Math.PI));
        if (!compileExpression(t).ok && !Number.isFinite(Number(t)))
          canh("UC_ANGLE", `Không đọc được góc "${a2.value}".`, 'Viết dạng "\\pi/3", "2\\pi/3" hoặc một số radian.');
      });
      if (!(v.angles ?? []).length && !(v.arcs ?? []).length)
        canh("UC_EMPTY", "Đường tròn lượng giác chưa đánh dấu góc hay cung nào.");
      break;
    }

    default: break;
  }
}
