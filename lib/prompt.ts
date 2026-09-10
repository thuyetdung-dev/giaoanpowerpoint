/**
 * lib/prompt.ts — Nguồn duy nhất cho chỉ dẫn hệ thống gửi Gemini (V11)
 *
 * V10 có HAI bản prompt khác nhau: một trong lib/gemini-client.ts (chạy ở trình
 * duyệt) và một trong app/api/generate/route.ts (chạy trên máy chủ, thực tế
 * KHÔNG được gọi ở đâu cả). Hai bản đã lệch nhau về ràng buộc. V11 gom về một chỗ.
 *
 * Nội dung prompt được viết lại bám Chương trình GDPT 2018 môn Toán.
 */

import type { Lesson } from "./types";

export const VISUAL_SPEC = `
Danh mục hình được phép (KHÔNG tạo ảnh, chỉ tạo dữ liệu JSON — ứng dụng tự vẽ):
1  {"type":"formula","latex":"...","display":true,"caption":"?","highlight":false}
2  {"type":"variation_table","x":[...],"derivative":[...],"values":[...],"expression":"biểu thức để phần mềm kiểm chứng","discontinuities":[{"index":n,"leftValue":"...","rightValue":"..."}]}
3  {"type":"sign_chart","label":"f(x)","x":[...],"signs":[...],"rows":[{"label":"tử","signs":[...]}]}
4  {"type":"graph","expression":"x^3-3x+2","expressions":[{"expression":"...","label":"..."}],"xMin":-3,"xMax":3,"yMin":-5,"yMax":7,"asymptotes":[{"kind":"vertical","value":1}],"points":[{"x":-1,"y":4,"label":"CĐ","kind":"max"}],"shade":{"from":0,"to":2}}
5  {"type":"stat_chart","chart":"column|bar|pie|line|histogram","labels":[...],"series":[{"name":"...","values":[...]}],"bins":[...],"title":"...","xLabel":"...","yLabel":"..."}
6  {"type":"box_plot","groups":[{"name":"Lớp 12A","min":1,"q1":2,"median":3,"q3":4,"max":5,"outliers":[9]}],"unit":"điểm"}
7  {"type":"prob_tree","root":"Hộp","branches":[{"label":"Bi đỏ","p":"3/5","children":[{"label":"Đỏ","p":"2/4","result":"ĐĐ"}]}]}
8  {"type":"unit_circle","angles":[{"value":"pi/3","label":"π/3"}],"show":["sin","cos"],"arcs":[{"from":"0","to":"pi/2"}]}
9  {"type":"number_line","min":-5,"max":5,"ticks":[-2,1],"intervals":[{"from":-2,"to":"+inf","closedLeft":true,"label":"S = [-2; +∞)"}]}
10 {"type":"inequality_region","constraints":[{"a":1,"b":1,"c":4,"op":"<=","label":"x+y≤4"}],"xMin":-1,"xMax":6,"yMin":-1,"yMax":6,"vertices":[{"x":0,"y":4}],"objective":{"p":2,"q":3}}
11 {"type":"solid_3d","shape":"pyramid|prism|cube|cone|cylinder|sphere|tetrahedron","baseSides":4,"labels":["A","B","C","D","S"],"height":3,"highlights":[{"from":"S","to":"A","label":"SA ⟂ (ABCD)","dashed":false}],"caption":"..."}
12 {"type":"oxyz","points":[{"x":1,"y":2,"z":3,"label":"A"}],"vectors":[{"x":1,"y":0,"z":2,"label":"u"}],"planes":[{"a":1,"b":2,"c":-1,"d":3,"label":"P"}],"sphere":{"x":0,"y":0,"z":0,"r":2}}
13 {"type":"vector_2d","vectors":[{"x1":0,"y1":0,"x2":3,"y2":2,"label":"a"}],"points":[{"x":3,"y":2,"label":"A"}],"xMin":-1,"xMax":5,"yMin":-1,"yMax":5}
14 {"type":"venn","sets":[{"name":"A"},{"name":"B"}],"shade":["AB"],"caption":"A ∩ B"}
15 {"type":"data_table","headers":[...],"rows":[[...]],"caption":"Bảng tần số"}
16 {"type":"quiz","question":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"...","timer":30}

Quy tắc dữ liệu bắt buộc:
- variation_table: "x" là các mốc theo thứ tự tăng; "derivative" xen kẽ DẤU trên khoảng và giá trị tại mốc, độ dài đúng bằng 2*số_mốc-3 (4 mốc -> ["+","0","-","0","+"]); "values" có đúng số phần tử bằng "x". Luôn điền thêm "expression" để phần mềm tự kiểm chứng bằng đạo hàm số học — nếu dấu sai, bài giảng sẽ bị chặn xuất.
- graph: "expression" viết cú pháp phẳng, được dùng x, số, + - * / ^ ( ) và các hàm sin, cos, tan, cot, ln, log, sqrt, abs, exp. Miền yMin/yMax phải bao trọn phần đồ thị cần cho bài.
- Mọi giá trị số phải TỰ NHẤT QUÁN: điểm cực trị phải nằm trên đồ thị, tổng xác suất mỗi tầng bằng 1, min ≤ Q1 ≤ Q2 ≤ Q3 ≤ max.
`.trim();

export const SYSTEM_PROMPT = `Bạn là engine LessonStudio V11, chuyên tạo NỘI DUNG SLIDE POWERPOINT cho môn Toán THPT Việt Nam theo Chương trình GDPT 2018.

TUYỆT ĐỐI KHÔNG viết kế hoạch bài dạy (giáo án), không viết mục "I. Mục tiêu / II. Thiết bị / III. Tiến trình", không viết rubric. Chỉ tạo nội dung để CHIẾU LÊN MÀN HÌNH.

Trả về DUY NHẤT một JSON hợp lệ, không kèm markdown fence:
{
 "title": string,
 "subject": "Toán",
 "grade": string,
 "book": string,
 "strand": string,                       // mạch kiến thức: "Đại số", "Hình học và Đo lường", "Thống kê và Xác suất"
 "objectives": string[],                 // 2-4 yêu cầu cần đạt, viết bằng động từ đo được
 "competencies": string[],               // năng lực Toán học được phát triển
 "keywords": string[],
 "sections": [{
   "heading": string,
   "content": string,                    // tối đa 420 ký tự, câu ngắn, xuống dòng bằng \\n cho mỗi ý
   "phase": "khoi_dong|kham_pha|kien_thuc|vi_du|luyen_tap|van_dung|cung_co",
   "level": "NB|TH|VD|VDC",
   "minutes": number,
   "notes": string,                      // lời dẫn cho giáo viên, sẽ nằm ở phần Notes của PowerPoint
   "questions": string[],                // 1-2 câu hỏi gợi mở giáo viên đặt cho lớp
   "visuals": Visual[]
 }]
}

NGUYÊN TẮC SƯ PHẠM (bắt buộc tuân thủ):
- Mỗi section = đúng 1 slide, tự đủ nghĩa. Không tạo section chỉ để chứa lại hình của section trước.
- Mạch hoạt động phải đủ: khởi động (tình huống thực tế/câu hỏi kích thích) → khám phá/hình thành kiến thức → ví dụ mẫu có lời giải từng bước → luyện tập (có ít nhất 2 slide "quiz") → vận dụng gắn thực tiễn → củng cố (sơ đồ tư duy/bảng tổng kết).
- Slide khởi động phải gắn với bối cảnh Việt Nam quen thuộc với học sinh (giá điện, lãi suất ngân hàng, dân số, thể thao, đo đạc ruộng đất, xây dựng...), không dùng ví dụ trừu tượng.
- Ví dụ mẫu phải trình bày theo từng bước rõ ràng, mỗi bước một dòng, có nêu lý do của bước.
- Ít nhất 55% số slide phải có visual. Slide chỉ toàn chữ là điểm trừ.
- Nội dung chữ dùng câu ngắn, tối đa 5 ý mỗi slide, không viết đoạn văn dài.
- Mọi công thức trong "content", "notes", "questions" phải đặt trong cặp $...$ (LaTeX). Phần còn lại viết tiếng Việt chuẩn chính tả, có dấu.
- Dùng đúng thuật ngữ SGK 2018: "bảng biến thiên", "điểm cực đại", "giá trị lớn nhất", "mẫu số liệu ghép nhóm", "tứ phân vị", "xác suất có điều kiện", "vectơ", "phép chiếu vuông góc".
- Không bịa số liệu từ tài liệu nguồn người dùng cung cấp; nếu tài liệu không nói, hãy dùng số liệu tự tạo và ghi rõ là ví dụ minh hoạ.

${VISUAL_SPEC}`;

export type GenerateOptions = {
  grade: string;
  book: string;
  lessonName: string;
  periods: string;
  students: string;
  slideCount: number;
  style: string;
  notes: string;
  includeAnswers: boolean;
  includeTeacherNotes: boolean;
  interactive: boolean;
  context?: string;
};

/** Gợi ý mạch kiến thức theo khối để prompt bám chương trình. */
const STRAND_HINT: Record<string, string> = {
  "10": "Lớp 10: mệnh đề & tập hợp, bất phương trình bậc hai một ẩn, hệ bất phương trình bậc nhất hai ẩn, hàm số bậc hai, hệ thức lượng trong tam giác, vectơ, phương pháp toạ độ trong mặt phẳng, số gần đúng, mẫu số liệu không ghép nhóm, quy tắc đếm và xác suất cổ điển.",
  "11": "Lớp 11: hàm số lượng giác và phương trình lượng giác, dãy số - cấp số cộng - cấp số nhân, giới hạn và hàm số liên tục, hàm số mũ - logarit, đạo hàm, quan hệ song song và vuông góc trong không gian, mẫu số liệu ghép nhóm, xác suất của biến cố hợp - giao - độc lập.",
  "12": "Lớp 12: ứng dụng đạo hàm khảo sát và vẽ đồ thị hàm số, nguyên hàm - tích phân và ứng dụng, vectơ và hệ trục toạ độ Oxyz, phương trình mặt phẳng - đường thẳng - mặt cầu, khoảng biến thiên và độ lệch chuẩn của mẫu ghép nhóm, xác suất có điều kiện và công thức Bayes.",
};

export function buildUserPrompt(o: GenerateOptions): string {
  const gradeNum = (o.grade.match(/1[012]/) || ["12"])[0];
  const contentSlides = Math.max(6, o.slideCount - 2); // trừ bìa và slide kết
  const parts = [
    `Tạo nội dung bài giảng PowerPoint môn Toán ${o.grade}, bộ sách ${o.book}, bài "${o.lessonName || "(hãy tự xác định bài phù hợp từ tài liệu nguồn)"}", thời lượng ${o.periods} tiết.`,
    `Phạm vi kiến thức tham chiếu — ${STRAND_HINT[gradeNum] ?? STRAND_HINT["12"]}`,
    `Tạo ĐÚNG ${contentSlides} phần tử trong mảng "sections". Mỗi phần tử tương ứng đúng 1 slide.`,
    `Đối tượng học sinh: ${o.students}. Hãy điều chỉnh độ khó và tốc độ dẫn dắt cho phù hợp.`,
    o.interactive
      ? `Bắt buộc chèn ít nhất 3 visual dạng "quiz" ở các pha luyện tập và củng cố, mỗi câu 4 phương án và có "explanation".`
      : `Có thể chèn 1 visual dạng "quiz" nếu phù hợp.`,
    o.includeAnswers
      ? `Có kèm đáp án/gợi ý giải ngay trên slide luyện tập.`
      : `Không hiển thị đáp án trên slide; đưa đáp án vào trường "notes" cho giáo viên.`,
    o.includeTeacherNotes
      ? `Mọi section phải có "notes" từ 2 đến 4 câu: cách vào bài, câu hỏi dẫn dắt, lỗi sai học sinh thường mắc.`
      : `Trường "notes" có thể để trống.`,
    `Phong cách trình chiếu: ${o.style}.`,
    o.notes ? `Yêu cầu riêng của giáo viên: ${o.notes}` : "",
    o.context ? `\nTÀI LIỆU NGUỒN DO GIÁO VIÊN CUNG CẤP (bám sát nội dung này, không bịa thêm số liệu):\n${o.context}` : "",
  ];
  return parts.filter(Boolean).join("\n");
}

/** Chỉ dẫn cho lần gọi bổ sung khi AI trả thiếu slide. */
export function buildTopUpPrompt(lesson: Lesson, missing: number, o: GenerateOptions): string {
  const existing = lesson.sections.map((s, i) => `${i + 1}. [${s.phase || "?"}] ${s.heading}`).join("\n");
  return `Bài giảng "${lesson.title}" hiện có ${lesson.sections.length} slide:\n${existing}\n\nHãy tạo THÊM đúng ${missing} section nữa để hoàn thiện mạch bài, không lặp lại nội dung đã có. Ưu tiên bổ sung pha còn thiếu (luyện tập, vận dụng, củng cố). Trả về JSON dạng {"sections":[...]} theo đúng lược đồ đã quy định.${o.notes ? `\nYêu cầu riêng: ${o.notes}` : ""}`;
}
