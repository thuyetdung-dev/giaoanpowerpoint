/**
 * scripts/samples.mjs — Một hình mẫu cho MỖI loại, dùng để đo cỡ chữ.
 * Dữ liệu lấy theo dạng bài thường gặp của Toán THPT, không phải dữ liệu rỗng:
 * hình rỗng thì ít chữ, đo ra con số đẹp mà thực tế vẫn vỡ.
 */

export const SAMPLES = {
  bang_bien_thien: {
    type: "variation_table",
    label: "y",
    expression: "x^3-3x+2",
    x: ["-\\infty", "-1", "1", "+\\infty"],
    derivative: ["+", "0", "-", "0", "+"],
    values: ["-\\infty", "4", "0", "+\\infty"],
  },
  bang_bien_thien_nhan_sai: {
    type: "variation_table",
    label: "x^2 - 4x + 3",
    x: ["-\\infty", "2", "+\\infty"],
    derivative: ["-", "0", "+"],
    values: ["+\\infty", "-1", "+\\infty"],
  },
  bang_xet_dau_1: {
    type: "sign_chart",
    label: "f(x)",
    x: ["-\\infty", "-2", "3", "+\\infty"],
    signs: ["+", "0", "-", "0", "+"],
  },
  bang_xet_dau_3: {
    type: "sign_chart",
    x: ["-\\infty", "-2", "1", "+\\infty"],
    rows: [
      { label: "x - 1", signs: ["-", "0", "-", "0", "+"] },
      { label: "x + 2", signs: ["-", "0", "+", "0", "+"] },
      { label: "f(x)", signs: ["+", "0", "-", "0", "+"] },
    ],
  },
  do_thi: {
    type: "graph",
    expression: "x^3-3x+1",
    xMin: -3, xMax: 3, yMin: -4, yMax: 4,
    points: [
      { x: -1, y: 3, label: "CĐ(-1; 3)", kind: "max" },
      { x: 1, y: -1, label: "CT(1; -1)", kind: "min" },
    ],
  },
  do_thi_hai_duong: {
    type: "graph",
    expression: "2^x",
    expressions: [
      { expression: "2^x", label: "y = 2ˣ" },
      { expression: "log(x)/log(2)", label: "y = log₂x", dashed: true },
    ],
    xMin: -4, xMax: 6, yMin: -4, yMax: 6,
  },
  do_thi_nhan_truc_dai: {
    type: "graph",
    expression: "2+4/x",
    xMin: 0.2, xMax: 10, yMin: 0, yMax: 7,
    xLabel: "x (sản phẩm)", yLabel: "f(x) (triệu đồng)",
    asymptotes: [{ kind: "horizontal", value: 2 }],
  },
  cong_thuc: { type: "formula", latex: "\\int_0^1 (x^2+1)\\,dx = \\frac{4}{3}", caption: "Công thức Newton – Leibniz" },
  bang_so_lieu: {
    type: "data_table",
    headers: ["Lớp", "Sĩ số", "Điểm trung bình"],
    rows: [["12A1", "45", "8,2"], ["12A2", "43", "7,9"], ["12A3", "44", "8,5"]],
    caption: "Kết quả khảo sát giữa kỳ",
    highlightRow: 2,
  },
  trac_nghiem: {
    type: "quiz",
    question: "Hàm số $y = x^{3} - 3x + 1$ đồng biến trên khoảng nào sau đây?",
    options: ["$(-\\infty; -1)$", "$(-1; 1)$", "$(0; 2)$", "$(-1; +\\infty)$"],
    answerIndex: 0,
    explanation: "$y' = 3x^{2} - 3 > 0$ khi $x < -1$ hoặc $x > 1$.",
  },
  trac_nghiem_phan_so: {
    type: "quiz",
    question: "Hàm số $y = \\frac{ax+b}{cx+d}$ có tiệm cận ngang là đường nào?",
    options: ["$y = \\frac{a}{c}$", "$x = -\\frac{d}{c}$", "$y = \\frac{b}{d}$", "$y = 0$"],
    answerIndex: 0,
  },
  bieu_do_cot: {
    type: "stat_chart",
    chart: "column",
    labels: ["Giỏi", "Khá", "Trung bình", "Yếu"],
    series: [{ name: "Lớp 12A", values: [12, 18, 10, 5] }],
    title: "Xếp loại học lực lớp 12A",
    xLabel: "Xếp loại", yLabel: "Số học sinh",
    showValues: true,
  },
  bieu_do_quat: {
    type: "stat_chart",
    chart: "pie",
    labels: ["Toán", "Lý", "Hoá", "Sinh"],
    series: [{ values: [35, 25, 22, 18] }],
    title: "Môn học yêu thích",
  },
  bieu_do_hop: {
    type: "box_plot",
    groups: [
      { name: "Lớp 12A", min: 3, q1: 5.5, median: 7, q3: 8.5, max: 10 },
      { name: "Lớp 12B", min: 4, q1: 6, median: 7.5, q3: 8, max: 9.5, outliers: [2] },
    ],
    title: "Phân bố điểm kiểm tra", unit: "điểm",
  },
  so_do_cay: {
    type: "prob_tree",
    root: "Hộp bi",
    branches: [
      { label: "Bi đỏ", p: "0,6", children: [{ label: "Đỏ", p: "0,5", result: "0,30" }, { label: "Xanh", p: "0,5", result: "0,30" }] },
      { label: "Bi xanh", p: "0,4", children: [{ label: "Đỏ", p: "0,25", result: "0,10" }, { label: "Xanh", p: "0,75", result: "0,30" }] },
    ],
    caption: "Xác suất có điều kiện",
  },
  duong_tron_luong_giac: {
    type: "unit_circle",
    angles: [{ value: "\\pi/6", label: "π/6" }, { value: "\\pi/3", label: "π/3" }, { value: "3\\pi/4", label: "3π/4" }],
    show: ["sin", "cos"],
  },
  truc_so: {
    type: "number_line",
    min: -5, max: 5,
    intervals: [
      { from: -3, to: 2, closedLeft: true, closedRight: false, label: "[-3; 2)" },
      { from: 3, to: "+inf", closedLeft: false, label: "(3; +∞)" },
    ],
    points: [{ x: -3, label: "-3", filled: true }, { x: 2, label: "2" }],
  },
  mien_nghiem: {
    type: "inequality_region",
    constraints: [
      { a: 1, b: 1, c: 6, op: "<=", label: "x + y ≤ 6" },
      { a: 1, b: 2, c: 8, op: "<=", label: "x + 2y ≤ 8" },
    ],
    xMin: -1, xMax: 8, yMin: -1, yMax: 8,
    objective: { p: 3, q: 4, label: "F = 3x + 4y" },
    vertices: [{ x: 0, y: 0, label: "O" }, { x: 6, y: 0, label: "A" }, { x: 4, y: 2, label: "B" }],
  },
  hinh_khong_gian: {
    type: "solid_3d",
    shape: "pyramid", baseSides: 4,
    labels: ["S", "A", "B", "C", "D"],
    highlights: [{ from: "S", to: "A", label: "SA ⊥ (ABCD)", dashed: false }],
    caption: "Hình chóp S.ABCD",
  },
  he_truc_oxyz: {
    type: "oxyz",
    points: [{ x: 2, y: 1, z: 3, label: "A" }, { x: -1, y: 2, z: 1, label: "B" }],
    vectors: [{ x: 1, y: 1, z: 1, label: "n" }],
    range: 4,
  },
  vecto_mat_phang: {
    type: "vector_2d",
    vectors: [{ x1: 0, y1: 0, x2: 3, y2: 2, label: "u" }, { x1: 0, y1: 0, x2: 1, y2: -2, label: "v" }],
    points: [{ x: 3, y: 2, label: "M" }],
    xMin: -3, xMax: 5, yMin: -3, yMax: 4,
    showParallelogram: true,
  },
  bieu_do_ven: {
    type: "venn",
    sets: [{ name: "A" }, { name: "B" }],
    shade: ["AB"],
    caption: "A ∩ B",
  },
};
