/**
 * lib/visualguide.ts — Hướng dẫn viết dữ liệu cho từng loại hình Toán (V11.9)
 *
 * VÌ SAO PHẢI CÓ. Ô "Sửa dữ liệu hình" là một ô JSON trắng. Người viết ra nó đã
 * biết trường nào tên gì, còn giáo viên thì không — và không có lý gì phải biết.
 * Gõ sai một tên trường thì hình biến thành khung trống, mà phần mềm không nói
 * được là thiếu gì.
 *
 * Bảng dưới đây là nguồn duy nhất của phần hướng dẫn hiện cạnh ô dữ liệu:
 * từng trường, bắt buộc hay không, một câu giải thích bằng tiếng Việt, và một
 * ví dụ mẫu lấy theo dạng bài thật của Toán THPT. Nút "Chèn mẫu" dùng chính ví
 * dụ này, nên hướng dẫn không bao giờ lệch với thứ phần mềm chèn vào.
 *
 * Khi thêm loại hình mới vào lib/types.ts thì thêm một mục ở đây, nếu không
 * giáo viên sẽ gặp một ô JSON trắng đúng như trước.
 */

export type FieldDoc = {
  name: string;
  /** true = thiếu trường này thì hình không dựng được. */
  required: boolean;
  desc: string;
};

export type VisualGuide = {
  /** Một câu nói rõ hình này dùng để dạy gì. */
  intro: string;
  fields: FieldDoc[];
  /** Ví dụ mẫu — cũng là thứ nút "Chèn mẫu" đưa vào ô dữ liệu. */
  sample: Record<string, unknown>;
  /** Vài điều dễ sai, viết như lời nhắc của đồng nghiệp. */
  notes?: string[];
};

/** Quy tắc chung, hiện ở mọi loại hình. */
export const COMMON_RULES = [
  'Tên trường phải viết đúng từng chữ, giữ nguyên dấu ngoặc kép: "expression", không phải "Expression".',
  "Số viết bằng dấu chấm thập phân theo đúng cú pháp JSON: 0.5 chứ không phải 0,5.",
  "Giữa hai trường phải có dấu phẩy; trường cuối cùng thì KHÔNG có dấu phẩy.",
  'Công thức Toán viết bằng LaTeX và phải nhân đôi dấu gạch chéo: "\\\\frac{1}{2}", "\\\\infty", "\\\\sqrt{3}".',
];

export const VISUAL_GUIDE: Record<string, VisualGuide> = {
  formula: {
    intro: "Một công thức in to giữa slide, kèm chú thích.",
    fields: [
      { name: "latex", required: true, desc: "Công thức viết bằng LaTeX, không cần dấu $ bao ngoài." },
      { name: "caption", required: false, desc: "Chú thích ngắn dưới công thức, ví dụ tên định lý." },
      { name: "display", required: false, desc: "true = công thức đứng riêng một dòng (mặc định)." },
      { name: "highlight", required: false, desc: "true = đóng khung vàng cho nổi bật khi chiếu." },
    ],
    sample: {
      type: "formula",
      latex: "\\int_0^1 (x^2+1)\\,dx = \\frac{4}{3}",
      caption: "Công thức Newton – Leibniz",
    },
  },

  variation_table: {
    intro: "Bảng biến thiên ba hàng x, y′, y — có mũi tên và cả tiệm cận đứng.",
    fields: [
      { name: "expression", required: false, desc: "Biểu thức hàm số. Có thể viết dạng máy tính (x)/(2*x+10) hoặc LaTeX \\frac{x}{2x+10}; phần mềm vừa kiểm định vừa hiển thị phân số hai tầng." },
      { name: "x", required: true, desc: "Các mốc trên hàng x, từ trái sang phải, kể cả -\\infty và +\\infty." },
      { name: "derivative", required: true, desc: "Hàng y′, xen kẽ dấu và nghiệm. Có n mốc x thì hàng này có 2n−3 ô. Dùng \"||\" tại điểm không xác định." },
      { name: "values", required: true, desc: "Hàng y, đúng một giá trị cho mỗi mốc x. Để chuỗi rỗng tại mốc gián đoạn." },
      { name: "discontinuities", required: false, desc: "Điểm gián đoạn: index là vị trí trong hàng x (đếm từ 0), leftValue và rightValue là giới hạn hai phía." },
      { name: "label", required: false, desc: "Tên hàm hiện ở cột trái, chỉ nên là \"y\". Biểu thức đầy đủ đặt ở expression." },
    ],
    sample: {
      type: "variation_table",
      label: "y",
      expression: "(x^2+2x-2)/(x-1)",
      x: ["-\\infty", "0", "1", "2", "+\\infty"],
      derivative: ["+", "0", "-", "||", "-", "0", "+"],
      values: ["-\\infty", "2", "", "6", "+\\infty"],
      discontinuities: [{ index: 2, leftValue: "-\\infty", rightValue: "+\\infty" }],
    },
    notes: [
      "Điền expression là cách nhanh nhất: bấm “Tự sửa” thì phần mềm giải y′ = 0, tìm tiệm cận và viết lại cả bảng, kể cả nghiệm dạng căn.",
      "Đếm ô hàng y′ cho đúng: 5 mốc x thì cần 7 ô (dấu – nghiệm – dấu – nghiệm – dấu – nghiệm – dấu).",
    ],
  },

  sign_chart: {
    intro: "Bảng xét dấu một biểu thức, hoặc nhiều dòng tử – mẫu – thương như SGK.",
    fields: [
      { name: "x", required: true, desc: "Các mốc trên hàng x, kể cả -\\infty và +\\infty." },
      { name: "signs", required: true, desc: "Xen kẽ DẤU trên khoảng và GIÁ TRỊ tại mốc: 2n−3 ô với n mốc x. Ghi \"0\" chỉ khi CHÍNH HÀNG ĐÓ bằng 0 tại mốc; ghi \"||\" nếu không xác định; ghi \"+\" hoặc \"−\" nếu hàng đó khác 0 tại mốc. Bỏ qua nếu dùng rows." },
      { name: "label", required: false, desc: "Tên biểu thức hiện ở cột trái, ví dụ \"f(x)\"." },
      { name: "rows", required: false, desc: "Nhiều dòng xét dấu, mỗi dòng có label và signs. Dùng thay cho signs." },
    ],
    sample: {
      type: "sign_chart",
      x: ["-\\infty", "-2", "1", "+\\infty"],
      rows: [
        // Tại x = -2 chỉ có (x + 2) bằng 0; hàng (x - 1) vẫn âm nên ghi dấu, không ghi 0.
        { label: "x - 1", signs: ["-", "-", "-", "0", "+"] },
        { label: "x + 2", signs: ["-", "0", "+", "+", "+"] },
        { label: "f(x)", signs: ["+", "0", "-", "0", "+"] },
      ],
    },
    notes: [
      "Ở MỘT MỐC, không được ghi 0 cho tất cả các hàng. Chỉ hàng có nhân tử bằng 0 tại mốc đó mới ghi 0 — đây là lỗi hay gặp nhất khi lập bảng xét dấu tích, thương.",
      "Nên ghi đủ 2n−3 ô trong signs. Ghi thiếu (chỉ n−1 dấu trên khoảng) thì ô tại mốc để trống, phần mềm KHÔNG tự điền 0 vì điền là có thể biến một điểm không xác định thành nghiệm.",
    ],
  },

  graph: {
    intro: "Đồ thị hàm số trên hệ trục Oxy, kèm tiệm cận. Mặc định KHÔNG chấm điểm nào lên hình.",
    fields: [
      { name: "expression", required: true, desc: "Hàm số cần vẽ, viết như máy tính: 50*x/(100-x), x^3-3*x, sqrt(x+1), sin(x), ln(x)." },
      { name: "xMin, xMax, yMin, yMax", required: true, desc: "Khung nhìn. Đặt sao cho phần đáng xem nằm trong khung." },
      { name: "asymptotes", required: false, desc: "Tiệm cận: kind là \"vertical\" hoặc \"horizontal\" (kèm value), hoặc \"oblique\" (kèm expression)." },
      { name: "points", required: false, desc: "Điểm cần đánh dấu: x, y, label, và kind là \"max\", \"min\", \"inflection\", \"root\", \"plain\" hoặc \"center\" (tâm đối xứng, vẽ vòng tròn rỗng). DÙNG DÈ: mỗi nhãn cao hơn hai đơn vị của trục, ba nhãn gần nhau là hình rối." },
      { name: "expressions", required: false, desc: "Các đường vẽ THÊM trên cùng hệ trục, mỗi đường có expression, label, color, dashed." },
      { name: "shade", required: false, desc: "Tô miền giữa đồ thị và trục Ox (dạy tích phân): from, to, label." },
      { name: "xLabel, yLabel", required: false, desc: "Tên hai trục. Viết ngắn, ví dụ \"p (%)\" và \"C(p) (triệu đồng)\"." },
    ],
    sample: {
      type: "graph",
      expression: "(x^2+2x-2)/(x-1)",
      xMin: -6, xMax: 8, yMin: -10, yMax: 14,
      asymptotes: [{ kind: "vertical", value: 1 }, { kind: "oblique", expression: "x+3" }],
    },
    notes: [
      "Dấu nhân nên viết rõ: 2*x an toàn hơn 2x, và 50*x/(100-x) an toàn hơn 50x/(100-x).",
      "Hàm chính ở expression LUÔN được vẽ; expressions chỉ là các đường vẽ thêm.",
      "Đừng chấm cực đại, cực tiểu lên đồ thị: toạ độ của chúng đã có trong bảng biến thiên và trong phần chữ. Chữ trên slide cao 32 pt trong khi một đơn vị của trục thường chỉ khoảng 17 px, nên mỗi nhãn chiếm hơn hai đơn vị chiều cao — vài nhãn gần nhau là hình rối ngay.",
      'Nếu thật sự cần chỉ MỘT điểm (ví dụ giao điểm với trục tung) thì mới dùng points; kind: "center" vẽ vòng tròn RỖNG vì tâm đối xứng không thuộc đồ thị của hàm phân thức.',
      "Tiệm cận đứng VÀ tiệm cận ngang đều được tự dò từ expression nên không khai vẫn có; vẫn nên khai trong asymptotes cho dữ liệu bài giảng tường minh.",
    ],
  },

  stat_chart: {
    intro: "Biểu đồ thống kê: cột, cột ngang, đường, hình quạt, tần số ghép nhóm.",
    fields: [
      { name: "chart", required: true, desc: "Một trong: \"column\" (cột đứng), \"bar\" (cột ngang), \"line\" (đường), \"pie\" (quạt), \"histogram\" (tần số ghép nhóm)." },
      { name: "labels", required: true, desc: "Tên từng cột / từng phần quạt." },
      { name: "series", required: true, desc: "Các dãy số liệu: mỗi dãy có values (số lượng phải bằng số labels), thêm name và color nếu muốn." },
      { name: "bins", required: false, desc: "Chỉ dùng với histogram: các mốc lớp ghép, ví dụ [150, 155, 160, 165]." },
      { name: "title", required: false, desc: "Tên biểu đồ." },
      { name: "xLabel, yLabel", required: false, desc: "Tên hai trục." },
      { name: "showValues", required: false, desc: "true = in số liệu ngay trên cột." },
    ],
    sample: {
      type: "stat_chart",
      chart: "column",
      labels: ["Giỏi", "Khá", "Trung bình", "Yếu"],
      series: [{ name: "Lớp 12A", values: [12, 18, 10, 5] }],
      title: "Xếp loại học lực lớp 12A",
      xLabel: "Xếp loại", yLabel: "Số học sinh",
      showValues: true,
    },
  },

  box_plot: {
    intro: "Biểu đồ hộp: tứ phân vị và giá trị ngoại lệ, so sánh nhiều nhóm.",
    fields: [
      { name: "groups", required: true, desc: "Mỗi nhóm cần name, min, q1, median, q3, max; thêm outliers nếu có giá trị ngoại lệ." },
      { name: "title", required: false, desc: "Tên biểu đồ." },
      { name: "unit", required: false, desc: "Đơn vị ghi trên trục, ví dụ \"điểm\"." },
    ],
    sample: {
      type: "box_plot",
      groups: [
        { name: "Lớp 12A", min: 3, q1: 5.5, median: 7, q3: 8.5, max: 10 },
        { name: "Lớp 12B", min: 4, q1: 6, median: 7.5, q3: 8, max: 9.5, outliers: [2] },
      ],
      title: "Phân bố điểm kiểm tra", unit: "điểm",
    },
  },

  prob_tree: {
    intro: "Sơ đồ cây xác suất hai tầng, dạy xác suất có điều kiện.",
    fields: [
      { name: "branches", required: true, desc: "Nhánh tầng một: mỗi nhánh có label, p (xác suất, viết dạng chuỗi) và children." },
      { name: "children", required: false, desc: "Nhánh tầng hai trong mỗi nhánh: label, p, và result là xác suất của cả đường đi." },
      { name: "root", required: false, desc: "Tên gốc cây, ví dụ \"Hộp bi\"." },
      { name: "caption", required: false, desc: "Chú thích dưới sơ đồ." },
    ],
    sample: {
      type: "prob_tree",
      root: "Hộp bi",
      branches: [
        { label: "Bi đỏ", p: "0,6", children: [{ label: "Đỏ", p: "0,5", result: "0,30" }, { label: "Xanh", p: "0,5", result: "0,30" }] },
        { label: "Bi xanh", p: "0,4", children: [{ label: "Đỏ", p: "0,25", result: "0,10" }, { label: "Xanh", p: "0,75", result: "0,30" }] },
      ],
      caption: "Xác suất có điều kiện",
    },
    notes: ["p và result là CHUỖI nên viết dấu phẩy thập phân kiểu Việt Nam cũng được: \"0,6\"."],
  },

  unit_circle: {
    intro: "Đường tròn lượng giác: đánh dấu góc, hiện trục sin/cos, tô cung nghiệm.",
    fields: [
      { name: "angles", required: true, desc: "Các góc cần đánh dấu: value viết bằng LaTeX như \"\\\\pi/3\", label là chữ hiện trên hình." },
      { name: "show", required: false, desc: "Trục cần hiện, chọn trong [\"sin\", \"cos\", \"tan\", \"cot\"]." },
      { name: "arcs", required: false, desc: "Cung nghiệm cần tô: from, to, label." },
    ],
    sample: {
      type: "unit_circle",
      angles: [{ value: "\\pi/6", label: "π/6" }, { value: "\\pi/3", label: "π/3" }, { value: "3\\pi/4", label: "3π/4" }],
      show: ["sin", "cos"],
    },
  },

  number_line: {
    intro: "Trục số: tập nghiệm bất phương trình, hợp và giao của các tập hợp.",
    fields: [
      { name: "min, max", required: true, desc: "Hai đầu của trục số." },
      { name: "intervals", required: true, desc: "Các khoảng: from và to (dùng \"-inf\" / \"+inf\" cho vô cực), closedLeft và closedRight cho ngoặc vuông, label là chữ hiện trên hình." },
      { name: "points", required: false, desc: "Điểm cần đánh dấu: x, label, filled (true = chấm đặc)." },
      { name: "ticks", required: false, desc: "Các vạch chia muốn hiện, ví dụ [-4, -2, 0, 2, 4]." },
    ],
    sample: {
      type: "number_line",
      min: -5, max: 5,
      intervals: [
        { from: -3, to: 2, closedLeft: true, closedRight: false, label: "[-3; 2)" },
        { from: 3, to: "+inf", closedLeft: false, label: "(3; +∞)" },
      ],
      points: [{ x: -3, label: "-3", filled: true }, { x: 2, label: "2" }],
    },
  },

  inequality_region: {
    intro: "Miền nghiệm hệ bất phương trình bậc nhất hai ẩn, kèm bài toán tìm giá trị lớn nhất.",
    fields: [
      { name: "constraints", required: true, desc: "Mỗi ràng buộc dạng a*x + b*y op c: cần a, b, c và op là \"<=\", \">=\", \"<\" hoặc \">\"." },
      { name: "xMin, xMax, yMin, yMax", required: true, desc: "Khung nhìn." },
      { name: "objective", required: false, desc: "Hàm mục tiêu F = p*x + q*y: cần p, q và label." },
      { name: "vertices", required: false, desc: "Các đỉnh của miền nghiệm cần ghi tên: x, y, label." },
    ],
    sample: {
      type: "inequality_region",
      constraints: [
        { a: 1, b: 1, c: 6, op: "<=", label: "x + y ≤ 6" },
        { a: 1, b: 2, c: 8, op: "<=", label: "x + 2y ≤ 8" },
      ],
      xMin: -1, xMax: 8, yMin: -1, yMax: 8,
      objective: { p: 3, q: 4, label: "F = 3x + 4y" },
      vertices: [{ x: 0, y: 0, label: "O" }, { x: 6, y: 0, label: "A" }, { x: 4, y: 2, label: "B" }],
    },
  },

  solid_3d: {
    intro: "Hình không gian: chóp, lăng trụ, khối tròn — kèm đường cao và khoảng cách.",
    fields: [
      { name: "shape", required: true, desc: "Một trong: \"pyramid\", \"prism\", \"cube\", \"tetrahedron\", \"cone\", \"cylinder\", \"sphere\"." },
      { name: "baseSides", required: false, desc: "Số cạnh đáy với chóp và lăng trụ: 3 tam giác, 4 tứ giác, 6 lục giác." },
      { name: "labels", required: false, desc: "Tên các đỉnh theo thứ tự đỉnh trên rồi đáy, ví dụ [\"S\", \"A\", \"B\", \"C\", \"D\"]." },
      { name: "highlights", required: false, desc: "Đoạn cần tô đậm: from, to là tên đỉnh, thêm label và dashed." },
      { name: "caption", required: false, desc: "Chú thích, ví dụ \"Hình chóp S.ABCD\"." },
    ],
    sample: {
      type: "solid_3d",
      shape: "pyramid", baseSides: 4,
      labels: ["S", "A", "B", "C", "D"],
      highlights: [{ from: "S", to: "A", label: "SA ⊥ (ABCD)", dashed: false }],
      caption: "Hình chóp S.ABCD",
    },
  },

  oxyz: {
    intro: "Hệ trục Oxyz: điểm, vectơ, mặt phẳng, mặt cầu trong không gian.",
    fields: [
      { name: "points", required: false, desc: "Các điểm: x, y, z, label." },
      { name: "vectors", required: false, desc: "Các vectơ: x, y, z là toạ độ, thêm from là tên điểm gốc, label và color." },
      { name: "planes", required: false, desc: "Mặt phẳng a*x + b*y + c*z + d = 0: cần a, b, c, d và label." },
      { name: "sphere", required: false, desc: "Mặt cầu: tâm x, y, z và bán kính r." },
      { name: "range", required: false, desc: "Độ dài trục hiện trên hình, ví dụ 4." },
    ],
    sample: {
      type: "oxyz",
      points: [{ x: 2, y: 1, z: 3, label: "A" }, { x: -1, y: 2, z: 1, label: "B" }],
      vectors: [{ x: 1, y: 1, z: 1, label: "n" }],
      range: 4,
    },
  },

  vector_2d: {
    intro: "Vectơ trong mặt phẳng: tổng, hiệu, quy tắc hình bình hành.",
    fields: [
      { name: "vectors", required: true, desc: "Mỗi vectơ đi từ (x1; y1) đến (x2; y2), thêm label, color, dashed." },
      { name: "xMin, xMax, yMin, yMax", required: true, desc: "Khung nhìn." },
      { name: "points", required: false, desc: "Điểm cần ghi tên: x, y, label." },
      { name: "polygon", required: false, desc: "Đa giác cần vẽ, liệt kê các đỉnh theo thứ tự." },
      { name: "showParallelogram", required: false, desc: "true = vẽ thêm hình bình hành dựng từ hai vectơ đầu." },
    ],
    sample: {
      type: "vector_2d",
      vectors: [{ x1: 0, y1: 0, x2: 3, y2: 2, label: "u" }, { x1: 0, y1: 0, x2: 1, y2: -2, label: "v" }],
      points: [{ x: 3, y: 2, label: "M" }],
      xMin: -3, xMax: 5, yMin: -3, yMax: 4,
      showParallelogram: true,
    },
  },

  venn: {
    intro: "Biểu đồ Ven: hợp, giao, phần bù của các tập hợp.",
    fields: [
      { name: "sets", required: true, desc: "Các tập hợp: mỗi tập có name, thêm color. Vẽ được 2 hoặc 3 tập." },
      { name: "shade", required: false, desc: "Vùng cần tô, viết theo tên tập: \"A\", \"B\", \"AB\" (giao), \"A-B\" (hiệu), \"AuB\" (hợp)." },
      { name: "caption", required: false, desc: "Chú thích dưới hình." },
    ],
    sample: {
      type: "venn",
      sets: [{ name: "A" }, { name: "B" }],
      shade: ["AB"],
      caption: "A ∩ B",
    },
  },

  data_table: {
    intro: "Bảng số liệu hoặc bảng tần số.",
    fields: [
      { name: "headers", required: true, desc: "Tên các cột." },
      { name: "rows", required: true, desc: "Các dòng. MỖI DÒNG phải có đúng bằng số cột tiêu đề." },
      { name: "caption", required: false, desc: "Tên bảng." },
      { name: "highlightRow", required: false, desc: "Số thứ tự dòng cần tô nổi bật, đếm từ 1." },
    ],
    sample: {
      type: "data_table",
      headers: ["Lớp", "Sĩ số", "Điểm trung bình"],
      rows: [["12A1", "45", "8,2"], ["12A2", "43", "7,9"], ["12A3", "44", "8,5"]],
      caption: "Kết quả khảo sát giữa kỳ",
      highlightRow: 2,
    },
    notes: ["Mọi ô đều là CHUỖI, nên phải có dấu ngoặc kép cả khi ô đó là số: \"45\"."],
  },

  quiz: {
    intro: "Câu hỏi trắc nghiệm, bấm chọn được khi trình chiếu bằng HTML.",
    fields: [
      { name: "question", required: true, desc: "Câu hỏi. Công thức đặt trong $...$." },
      { name: "options", required: true, desc: "Các phương án, thường là 4." },
      { name: "answerIndex", required: true, desc: "Số thứ tự phương án đúng, ĐẾM TỪ 0: phương án A là 0, B là 1, C là 2, D là 3." },
      { name: "explanation", required: false, desc: "Lời giải ngắn hiện sau khi chọn." },
      { name: "timer", required: false, desc: "Số giây đếm ngược hiện trên slide." },
    ],
    sample: {
      type: "quiz",
      question: "Hàm số $y = x^{3} - 3x + 1$ đồng biến trên khoảng nào sau đây?",
      options: ["$(-\\infty; -1)$", "$(-1; 1)$", "$(0; 2)$", "$(-1; +\\infty)$"],
      answerIndex: 0,
      explanation: "$y' = 3x^{2} - 3 > 0$ khi $x < -1$ hoặc $x > 1$.",
    },
    notes: ["answerIndex đếm TỪ 0. Muốn đáp án là phương án B thì ghi 1, không phải 2."],
  },
};

/** Ví dụ mẫu của một loại hình, đã định dạng sẵn để chèn vào ô dữ liệu. */
export function sampleFor(type: string): string | null {
  const g = VISUAL_GUIDE[type];
  return g ? JSON.stringify(g.sample, null, 2) : null;
}

/**
 * Đọc ô dữ liệu và trả về lời báo lỗi bằng TIẾNG VIỆT.
 *
 * Thông báo gốc của JSON.parse là tiếng Anh và nói về vị trí ký tự, thứ giáo
 * viên không dùng được. Ở đây đổi thành câu chỉ rõ dòng nào và thường là sai gì.
 */
export function readVisualJson(text: string): { ok: boolean; value?: Record<string, unknown>; error?: string } {
  const raw = String(text ?? "").trim();
  if (!raw) return { ok: false, error: "Ô dữ liệu đang trống. Bấm “Chèn mẫu” để có sẵn khung rồi sửa số." };
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return { ok: false, error: "Dữ liệu phải là một đối tượng mở bằng { và đóng bằng }." };
    if (!("type" in value))
      return { ok: false, error: 'Thiếu trường "type" — đây là trường cho biết đây là loại hình gì.' };
    return { ok: true, value: value as Record<string, unknown> };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const pos = /position (\d+)/.exec(msg);
    let where = "";
    if (pos) {
      const i = Number(pos[1]);
      where = ` (khoảng dòng ${raw.slice(0, i).split("\n").length})`;
    }
    // Hai lỗi chiếm gần hết số lần gõ sai, nên gọi đúng tên chúng.
    if (/Unexpected token .?\}/.test(msg) || /Expected double-quoted property name/.test(msg))
      return { ok: false, error: `Có dấu phẩy đứng trước dấu } hoặc ]${where}. Trường cuối cùng không được có dấu phẩy.` };
    if (/Unexpected non-whitespace|Unexpected token/.test(msg))
      return { ok: false, error: `Sai cú pháp${where}: thường là thiếu dấu phẩy giữa hai trường, hoặc thiếu một dấu ngoặc kép.` };
    if (/Unterminated string/.test(msg))
      return { ok: false, error: `Có một dấu ngoặc kép chưa đóng${where}.` };
    return { ok: false, error: `Chưa đọc được dữ liệu${where}. ${msg}` };
  }
}
