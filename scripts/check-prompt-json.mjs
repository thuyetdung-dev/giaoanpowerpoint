/**
 * scripts/check-prompt-json.mjs — Kiểm chứng ĐƯỜNG ĐI "AI ngoài → tệp JSON →
 * phần mềm dựng PowerPoint" (V12.4).
 *
 * Vì sao cần: prompt gửi cho Claude/Gemini/ChatGPT/NotebookLM mô tả lược đồ dữ
 * liệu của chính phần mềm. Viết prompt xong mà không thử nạp lại thì không ai
 * biết nó có đúng hay không — và cái sai chỉ lộ ra khi giáo viên đã ngồi với AI
 * xong xuôi, dán tệp vào và bị báo lỗi. Ở đây tệp mẫu `mau-json-tu-ai.json`
 * (soạn ĐÚNG theo prompt) được cho chạy qua đúng những bước mà phần mềm chạy
 * khi thầy bấm "Mở tệp JSON".
 *
 * Chạy:  node scripts/check-prompt-json.mjs
 */
import { readFileSync } from "node:fs";
import { auditLesson } from "../_build/lib/audit.js";
import { buildDeck, outlineDeck } from "../_build/lib/slides.js";
import { promptChoAiNgoai } from "../_build/lib/prompt.js";

let dat = 0, hong = 0;
const kiem = (ten, dieu, them = "") => {
  if (dieu) dat++;
  else { hong++; console.log("  ✗", ten, them); }
};

/* ---------- 1. Prompt phải mô tả ĐỦ những gì phần mềm hiểu ---------- */
const prompt = promptChoAiNgoai();
const LOAI = ["formula", "variation_table", "sign_chart", "graph", "stat_chart", "box_plot",
  "prob_tree", "unit_circle", "number_line", "inequality_region", "solid_3d", "oxyz",
  "vector_2d", "venn", "data_table", "quiz"];
for (const t of LOAI) kiem(`prompt có mô tả loại hình "${t}"`, prompt.includes(`"${t}"`));
for (const [ten, chuoi] of [
  ["khung JSON có trường sections", '"sections"'],
  ["nhắc không dùng markdown fence", "```"],
  ["nêu quy tắc 2n-3 ô dấu", "2n-3"],
  ["nêu quy tắc phân số \\frac", "\\frac{tử}{mẫu}"],
  ["nêu quy tắc không kẻ bảng bằng ký tự", "TUYỆT ĐỐI KHÔNG kẻ bảng"],
  ["nêu quy tắc không chấm điểm lên đồ thị", "ĐỪNG đánh dấu điểm cực đại"],
  ["chỉ chỗ nạp tệp trong phần mềm", "Mở tệp JSON"],
]) kiem(ten, prompt.includes(chuoi));

/* ---------- 2. Tệp mẫu phải đi trọn đường của phần mềm ---------- */
const raw = readFileSync(new URL("./mau-json-tu-ai.json", import.meta.url), "utf8");
let lesson = null;
try { lesson = JSON.parse(raw); } catch (e) { kiem("tệp mẫu là JSON hợp lệ", false, String(e)); }
if (lesson) {
  kiem("tệp mẫu là JSON hợp lệ", true);
  kiem("có trường sections (điều kiện phần mềm đòi khi nạp)", Array.isArray(lesson.sections) && lesson.sections.length > 0);

  const items = auditLesson(lesson);
  const loi = items.filter((i) => i.level === "error");
  kiem("bộ kiểm định KHÔNG có lỗi chặn xuất", loi.length === 0,
       loi.map((i) => `${i.code}: ${i.message}`).join(" | "));

  const canh = items.filter((i) => i.level === "warning");
  kiem("không có cảnh báo nào", canh.length === 0,
       canh.map((i) => `${i.code}: ${i.message}`).join(" | "));

  const deck = buildDeck(lesson, { teacher: "Hồ Thuyết Dũng", school: "THPT Phan Đăng Lưu" });
  kiem("dựng được bộ slide", deck.length > 0, `${deck.length} slide`);
  kiem("mỗi mục đều lên được slide", outlineDeck(deck).length === deck.length);

  /* Những điều kiện sư phạm mà prompt hứa hẹn — tệp mẫu phải làm gương. */
  const coHinh = lesson.sections.filter((s) => (s.visuals ?? []).length).length;
  kiem("ít nhất 55% số mục có hình", coHinh / lesson.sections.length >= 0.55,
       `${coHinh}/${lesson.sections.length}`);
  const soQuiz = lesson.sections.flatMap((s) => s.visuals ?? []).filter((v) => v.type === "quiz").length;
  kiem("có ít nhất 2 slide trắc nghiệm", soQuiz >= 2, `${soQuiz}`);
  const pha = new Set(lesson.sections.map((s) => s.phase));
  for (const p of ["khoi_dong", "kien_thuc", "vi_du", "luyen_tap", "van_dung", "cung_co"])
    kiem(`mạch hoạt động có pha "${p}"`, pha.has(p));
  kiem("mọi mục đều có ghi chú cho giáo viên", lesson.sections.every((s) => (s.notes ?? "").trim().length > 10));
  kiem("không mục nào kẻ bảng bằng ký tự | trong content",
       lesson.sections.every((s) => !/\|.*\|/.test(s.content ?? "")));

  /* Bảng biến thiên phải có expression để phần mềm tự kiểm chứng được. */
  const bbt = lesson.sections.flatMap((s) => s.visuals ?? []).filter((v) => v.type === "variation_table");
  kiem("mọi bảng biến thiên đều khai expression", bbt.length > 0 && bbt.every((v) => !!v.expression));
  kiem("mọi bảng biến thiên có đủ 2n-3 ô dấu",
       bbt.every((v) => v.derivative.length === 2 * v.x.length - 3));
  /* Đồ thị KHÔNG chấm điểm — đúng yêu cầu thầy Dũng đặt ở V12.2. */
  const dt = lesson.sections.flatMap((s) => s.visuals ?? []).filter((v) => v.type === "graph");
  kiem("đồ thị không đánh dấu điểm nào", dt.every((v) => !(v.points ?? []).length));
}

console.log(`\n${dat} phép kiểm đạt, ${hong} lỗi`);
process.exit(hong ? 1 : 0);
