/**
 * scripts/samples-hinh.mjs — Bộ RÀ SOÁT hình Toán (V12.0)
 *
 * Khác với scripts/samples.mjs (một mẫu mỗi loại, dùng để đo cỡ chữ), tệp này
 * dựng NHIỀU trường hợp cho mỗi loại hình, lấy theo dạng bài thật của Toán THPT
 * và cố tình gồm cả những ca khó: tên đỉnh kiểu S.ABCD, lăng trụ sáu cạnh, hai
 * nhóm biểu đồ hộp lệch thang nhau, miền nghiệm có ràng buộc x ≥ 0, y ≥ 0.
 *
 * Dùng: SAMPLES=hinh node scripts/measure-visuals.mjs
 */

export const SAMPLES = {
  /* ---------- Hình không gian: lỗi nặng nhất của V11 ---------- */
  chop_tu_giac: {
    type: "solid_3d",
    shape: "pyramid", baseSides: 4,
    labels: ["S", "A", "B", "C", "D"],
    highlights: [{ from: "S", to: "A", label: "SA ⊥ (ABCD)" }],
    caption: "Hình chóp S.ABCD",
  },
  chop_tam_giac: {
    type: "solid_3d",
    shape: "pyramid", baseSides: 3,
    labels: ["S", "A", "B", "C"],
    highlights: [{ from: "S", to: "B", label: "SB là đường cao", dashed: false }],
    caption: "Hình chóp S.ABC",
  },
  chop_luc_giac: {
    type: "solid_3d",
    shape: "pyramid", baseSides: 6,
    labels: ["S", "A", "B", "C", "D", "E", "F"],
    caption: "Hình chóp S.ABCDEF",
  },
  chop_chi_ghi_day: {
    // Thầy chỉ ghi tên đáy, không ghi đỉnh — phần mềm phải tự đặt "S".
    type: "solid_3d", shape: "pyramid", baseSides: 4,
    labels: ["A", "B", "C", "D"],
    caption: "Hình chóp có đáy ABCD",
  },
  lang_tru_tam_giac: {
    type: "solid_3d", shape: "prism", baseSides: 3,
    labels: ["A", "B", "C", "A'", "B'", "C'"],
    caption: "Lăng trụ ABC.A'B'C'",
  },
  hinh_lap_phuong: {
    type: "solid_3d", shape: "cube", baseSides: 4,
    labels: ["A", "B", "C", "D", "A'", "B'", "C'", "D'"],
    highlights: [{ from: "A", to: "C'", label: "Đường chéo AC'", dashed: true }],
    caption: "Hình lập phương ABCD.A'B'C'D'",
  },
  hinh_non: { type: "solid_3d", shape: "cone", labels: ["S"], caption: "Hình nón đỉnh S" },
  hinh_tru: { type: "solid_3d", shape: "cylinder", baseSides: 4, caption: "Hình trụ" },
  hinh_cau: { type: "solid_3d", shape: "sphere", caption: "Mặt cầu tâm O bán kính R" },

  /* ---------- Oxyz ---------- */
  oxyz_diem_vecto: {
    type: "oxyz",
    points: [{ x: 2, y: 1, z: 3, label: "A" }, { x: -1, y: 2, z: 1, label: "B" }],
    vectors: [{ x: 1, y: 1, z: 1, label: "n" }],
    range: 4,
  },
  /* Tâm mặt cầu chỉ khai MỘT chỗ. Mẫu cũ khai cả sphere.label lẫn một điểm
     cùng tên ở cùng toạ độ nên hai nhãn viết đè nhau — nay bộ kiểm định cảnh
     báo ca đó (OXYZ_TRUNG_NHAN). */
  oxyz_mat_cau: {
    type: "oxyz",
    sphere: { x: 1, y: 1, z: 1, r: 2, label: "I" },
    range: 4,
  },
  oxyz_mat_phang: {
    type: "oxyz",
    planes: [{ a: 2, b: -1, c: 3, d: -6, label: "P" }],
    vectors: [{ x: 2, y: -1, z: 3, label: "n" }],
    range: 4,
  },

  /* ---------- Vectơ mặt phẳng ---------- */
  vecto_tong: {
    type: "vector_2d",
    vectors: [{ x1: 0, y1: 0, x2: 3, y2: 2, label: "u" }, { x1: 0, y1: 0, x2: 1, y2: -2, label: "v" }],
    points: [{ x: 3, y: 2, label: "M" }],
    xMin: -3, xMax: 5, yMin: -3, yMax: 4,
    showParallelogram: true,
  },
  vecto_tam_giac: {
    type: "vector_2d",
    vectors: [{ x1: -2, y1: -1, x2: 3, y2: -1, label: "AB" }, { x1: 3, y1: -1, x2: 1, y2: 3, label: "BC" }],
    points: [{ x: -2, y: -1, label: "A" }, { x: 3, y: -1, label: "B" }, { x: 1, y: 3, label: "C" }],
    polygon: [{ x: -2, y: -1 }, { x: 3, y: -1 }, { x: 1, y: 3 }],
    xMin: -4, xMax: 5, yMin: -3, yMax: 4,
  },

  /* ---------- Miền nghiệm ---------- */
  mien_nghiem_quy_hoach: {
    type: "inequality_region",
    constraints: [
      { a: 1, b: 1, c: 6, op: "<=", label: "x + y ≤ 6" },
      { a: 1, b: 2, c: 8, op: "<=", label: "x + 2y ≤ 8" },
      { a: -1, b: 0, c: 0, op: "<=", label: "x ≥ 0" },
      { a: 0, b: -1, c: 0, op: "<=", label: "y ≥ 0" },
    ],
    xMin: -1, xMax: 8, yMin: -1, yMax: 8,
    objective: { p: 3, q: 4, label: "F = 3x + 4y" },
    vertices: [{ x: 0, y: 0, label: "O" }, { x: 6, y: 0, label: "A" }, { x: 4, y: 2, label: "B" }, { x: 0, y: 4, label: "C" }],
  },
  mien_nghiem_mot_bat: {
    type: "inequality_region",
    constraints: [{ a: 2, b: 3, c: 6, op: "<", label: "2x + 3y < 6" }],
    xMin: -4, xMax: 6, yMin: -4, yMax: 5,
  },

  /* ---------- Đường tròn lượng giác ---------- */
  luong_giac_goc: {
    type: "unit_circle",
    angles: [{ value: "\\pi/6", label: "π/6" }, { value: "\\pi/3", label: "π/3" }, { value: "3\\pi/4", label: "3π/4" }],
    show: ["sin", "cos"],
  },
  luong_giac_cung_nghiem: {
    type: "unit_circle",
    angles: [{ value: "\\pi/3", label: "π/3" }, { value: "2\\pi/3", label: "2π/3" }],
    arcs: [{ from: "\\pi/3", to: "2\\pi/3", label: "Cung nghiệm" }],
    show: ["sin"],
  },

  /* ---------- Trục số ---------- */
  truc_so_hai_khoang: {
    type: "number_line",
    min: -5, max: 5,
    intervals: [
      { from: -3, to: 2, closedLeft: true, closedRight: false, label: "[-3; 2)" },
      { from: 3, to: "+inf", closedLeft: false, label: "(3; +∞)" },
    ],
    points: [{ x: -3, label: "-3", filled: true }, { x: 2, label: "2" }],
  },
  truc_so_giao: {
    type: "number_line",
    min: -6, max: 6,
    intervals: [
      { from: "-inf", to: 1, closedRight: true, label: "A = (-∞; 1]" },
      { from: -2, to: 4, closedLeft: true, closedRight: true, label: "B = [-2; 4]" },
    ],
  },

  /* ---------- Thống kê ---------- */
  cot_hoc_luc: {
    type: "stat_chart", chart: "column",
    labels: ["Giỏi", "Khá", "Trung bình", "Yếu"],
    series: [{ name: "Lớp 12A", values: [12, 18, 10, 5] }],
    title: "Xếp loại học lực lớp 12A",
    xLabel: "Xếp loại", yLabel: "Số học sinh", showValues: true,
  },
  cot_hai_day: {
    type: "stat_chart", chart: "column",
    labels: ["Toán", "Lý", "Hoá"],
    series: [{ name: "Lớp 12A", values: [8.2, 7.5, 7.9] }, { name: "Lớp 12B", values: [7.6, 8.1, 7.2] }],
    title: "Điểm trung bình theo môn", yLabel: "Điểm", showValues: true,
  },
  duong_gap_khuc: {
    type: "stat_chart", chart: "line",
    labels: ["T9", "T10", "T11", "T12", "T1"],
    series: [{ name: "Số HS đạt giỏi", values: [8, 11, 9, 14, 17] }],
    title: "Số học sinh đạt loại giỏi", xLabel: "Tháng", yLabel: "Số HS", showValues: true,
  },
  quat_mon_hoc: {
    type: "stat_chart", chart: "pie",
    labels: ["Toán", "Lý", "Hoá", "Sinh"],
    series: [{ values: [35, 25, 22, 18] }],
    title: "Môn học yêu thích",
  },
  tan_so_ghep_nhom: {
    type: "stat_chart", chart: "histogram",
    labels: ["[150;155)", "[155;160)", "[160;165)", "[165;170)"],
    series: [{ values: [5, 12, 18, 7] }],
    bins: [150, 155, 160, 165, 170],
    title: "Chiều cao học sinh", xLabel: "Chiều cao (cm)", yLabel: "Số HS",
  },
  hop_hai_lop: {
    type: "box_plot",
    groups: [
      { name: "Lớp 12A", min: 3, q1: 5.5, median: 7, q3: 8.5, max: 10 },
      { name: "Lớp 12B", min: 4, q1: 6, median: 7.5, q3: 8, max: 9.5, outliers: [2] },
    ],
    title: "Phân bố điểm kiểm tra", unit: "điểm",
  },
  hop_mot_nhom: {
    type: "box_plot",
    groups: [{ name: "Cả khối 12", min: 2.5, q1: 5, median: 6.5, q3: 8, max: 9.75, outliers: [0.5, 10] }],
    title: "Điểm thi thử", unit: "điểm",
  },
  cay_xac_suat: {
    type: "prob_tree",
    root: "Hộp bi",
    branches: [
      { label: "Bi đỏ", p: "0,6", children: [{ label: "Đỏ", p: "0,5", result: "0,30" }, { label: "Xanh", p: "0,5", result: "0,30" }] },
      { label: "Bi xanh", p: "0,4", children: [{ label: "Đỏ", p: "0,25", result: "0,10" }, { label: "Xanh", p: "0,75", result: "0,30" }] },
    ],
    caption: "Xác suất có điều kiện",
  },
  bang_tan_so: {
    type: "data_table",
    headers: ["Điểm", "5", "6", "7", "8", "9", "10"],
    rows: [["Số HS", "3", "7", "12", "10", "6", "2"]],
    caption: "Bảng tần số điểm kiểm tra",
  },

  /* ---------- Bảng biến thiên và xét dấu ---------- */
  bbt_bac_ba: {
    type: "variation_table", label: "y", expression: "x^3-3x+2",
    x: ["-\\infty", "-1", "1", "+\\infty"],
    derivative: ["+", "0", "-", "0", "+"],
    values: ["-\\infty", "4", "0", "+\\infty"],
  },
  bbt_phan_thuc: {
    type: "variation_table", label: "y", expression: "(x^2+2x-2)/(x-1)",
    x: ["-\\infty", "0", "1", "2", "+\\infty"],
    derivative: ["+", "0", "-", "||", "-", "0", "+"],
    values: ["-\\infty", "2", "", "6", "+\\infty"],
    discontinuities: [{ index: 2, leftValue: "-\\infty", rightValue: "+\\infty" }],
  },
  xet_dau_tich: {
    type: "sign_chart",
    x: ["-\\infty", "-2", "1", "+\\infty"],
    rows: [
      { label: "x - 1", signs: ["-", "|", "-", "0", "+"] },
      { label: "x + 2", signs: ["-", "0", "+", "|", "+"] },
      { label: "f(x)", signs: ["+", "0", "-", "0", "+"] },
    ],
  },
  xet_dau_mot_dong: {
    type: "sign_chart", label: "f(x)",
    x: ["-\\infty", "-2", "3", "+\\infty"],
    signs: ["+", "0", "-", "0", "+"],
  },

  /* V12.1 — AI chỉ cho dấu trên khoảng, thiếu dấu tại mốc. CÓ biểu thức nên
     phần mềm phải tự tính lại cả bảng ngay lúc dựng hình (dấu 0 ở đây là do
     tính ra, không phải do bịa). */
  bbt_tu_tinh_lai: {
    type: "variation_table", label: "y", expression: "x^3-3x+2",
    x: ["-\\infty", "-1", "1", "+\\infty"],
    derivative: ["+", "-", "+"],
    values: ["-\\infty", "4", "0", "+\\infty"],
  },

  /* V12.1 — bảng có tham số m: KHÔNG có biểu thức nên không tính lại được.
     Thiếu dấu tại mốc thì phải ĐỂ TRỐNG. V12.0 tự ghi số 0 vào đó. */
  bbt_khong_co_bieu_thuc: {
    type: "variation_table", label: "y",
    x: ["-\\infty", "m", "+\\infty"],
    derivative: ["-", "+"],
    values: ["+\\infty", "2m", "+\\infty"],
  },
  xet_dau_chi_dau_khoang: {
    type: "sign_chart", label: "f(x)",
    x: ["-\\infty", "-2", "3", "+\\infty"],
    signs: ["+", "-", "+"],
  },

  /* ---------- Đồ thị ---------- */
  do_thi_bac_ba: {
    type: "graph", expression: "x^3-3x+1",
    xMin: -3, xMax: 3, yMin: -4, yMax: 4,
    points: [{ x: -1, y: 3, label: "CĐ(-1; 3)", kind: "max" }, { x: 1, y: -1, label: "CT(1; -1)", kind: "min" }],
  },
  do_thi_phan_thuc: {
    type: "graph", expression: "(x^2+2x-2)/(x-1)",
    xMin: -6, xMax: 8, yMin: -10, yMax: 14,
    asymptotes: [{ kind: "vertical", value: 1 }, { kind: "oblique", expression: "x+3" }],
    points: [{ x: 0, y: 2, label: "CĐ(0; 2)", kind: "max" }, { x: 2, y: 6, label: "CT(2; 6)", kind: "min" }],
  },
  do_thi_mu_log: {
    type: "graph", expression: "2^x",
    expressions: [{ expression: "2^x", label: "y = 2ˣ" }, { expression: "log(x)/log(2)", label: "y = log₂x", dashed: true }],
    xMin: -4, xMax: 6, yMin: -4, yMax: 6,
  },
  do_thi_tich_phan: {
    type: "graph", expression: "4-x^2",
    xMin: -3, xMax: 3, yMin: -1, yMax: 5,
    shade: { from: -2, to: 2, label: "S" },
  },

  /* Đúng đồ thị mà nút "Khảo sát hàm số" tự dựng ra — khung nhìn do phần mềm
     chọn, không phải do người viết mẫu chọn. */
  /* V12.2: đúng thứ nút "Khảo sát hàm số" dựng ra — KHÔNG còn chấm và nhãn
     điểm nào. Ba nhãn CĐ, CT, I trong vùng cao 4 đơn vị ở cỡ chữ 32 pt thì xếp
     kiểu gì cũng chen nhau. */
  do_thi_tu_khao_sat: {
    type: "graph", expression: "(x^2+2*x-2)/(x-1)",
    xMin: -3, xMax: 5, yMin: -4, yMax: 10,
    asymptotes: [{ kind: "vertical", value: 1 }, { kind: "oblique", expression: "x+3" }],
  },

  /* V12.1 — tâm đối xứng của hàm bậc ba là điểm uốn, vẽ bằng vòng tròn rỗng
     để không lẫn với chấm đặc của cực đại, cực tiểu. */
  do_thi_tam_doi_xung: {
    type: "graph", expression: "x^3-3*x+2",
    xMin: -3, xMax: 3, yMin: -3, yMax: 7,
    points: [
      { x: -1, y: 4, label: "CĐ(-1; 4)", kind: "max" },
      { x: 1, y: 0, label: "CT(1; 0)", kind: "min" },
      { x: 0, y: 2, label: "I(0; 2)", kind: "center" },
    ],
  },

  /* V12.1 — KHÔNG khai báo tiệm cận. Phần mềm phải tự tìm ra x = 1 và cắt nét
     vẽ ở đó, thay vì nối hai nhánh bằng một đường dựng đứng giả. */
  do_thi_tu_tim_tiem_can: {
    type: "graph", expression: "(x+1)/(x-1)",
    xMin: -4, xMax: 6, yMin: -4, yMax: 6,
  },

  /* ---------- Còn lại ---------- */
  ven_giao: { type: "venn", sets: [{ name: "A" }, { name: "B" }], shade: ["AB"], caption: "A ∩ B" },
  ven_ba_tap: { type: "venn", sets: [{ name: "A" }, { name: "B" }, { name: "C" }], shade: ["AB"], caption: "Ba tập hợp" },
  cong_thuc_tich_phan: {
    type: "formula", latex: "\\int_0^1 (x^2+1)\\,dx = \\frac{4}{3}", caption: "Công thức Newton – Leibniz",
  },
  quiz_phan_so: {
    type: "quiz",
    question: "Hàm số $y = \\frac{ax+b}{cx+d}$ có tiệm cận ngang là đường nào?",
    options: ["$y = \\frac{a}{c}$", "$x = -\\frac{d}{c}$", "$y = \\frac{b}{d}$", "$y = 0$"],
    answerIndex: 0,
  },
};
