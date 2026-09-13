/**
 * lib/types.ts — Lược đồ dữ liệu bài giảng (V11)
 *
 * V10 chỉ có 4 loại hình (formula, variation_table, sign_chart, graph) => phủ được
 * đúng chương "Khảo sát hàm số" của lớp 12. V11 bổ sung các loại hình bắt buộc
 * theo Chương trình GDPT 2018: thống kê, xác suất, hình học không gian, Oxyz,
 * vectơ, lượng giác, miền nghiệm bất phương trình, dãy số, tập hợp.
 */

/* ---------- Hình Toán ---------- */

export type FormulaVisual = {
  type: "formula";
  latex: string;
  display?: boolean;
  /** Chú thích ngắn dưới công thức, ví dụ "Định lý Vi-ét". */
  caption?: string;
  /** Làm nổi bật khi trình chiếu (khung vàng). */
  highlight?: boolean;
};

export type VariationVisual = {
  type: "variation_table";
  x: string[];
  derivative: string[];
  values: string[];
  discontinuities?: { index: number; leftValue: string; rightValue: string }[];
  /** V11: biểu thức hàm số, dùng để kiểm định chéo bảng với đạo hàm số học. */
  expression?: string;
  label?: string;
};

export type SignVisual = {
  type: "sign_chart";
  x: string[];
  signs: string[];
  label?: string;
  /** V11: nhiều dòng xét dấu (tử, mẫu, thương) như SGK. */
  rows?: { label: string; signs: string[] }[];
};

export type GraphVisual = {
  type: "graph";
  expression: string;
  /** V11: vẽ nhiều đồ thị trên cùng hệ trục (so sánh y = a^x và y = log_a x). */
  expressions?: { expression: string; label?: string; color?: string; dashed?: boolean }[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  asymptotes?: { kind: "vertical" | "horizontal" | "oblique"; value?: number; expression?: string }[];
  /**
   * Điểm cần đánh dấu. `kind: "center"` là TÂM ĐỐI XỨNG — vẽ bằng vòng tròn
   * RỖNG vì nó không phải điểm thuộc đồ thị (hàm phân thức không xác định tại
   * hoành độ của tâm). Vẽ chấm đặc như các điểm khác là nói sai.
   */
  points?: { x: number; y: number; label?: string; kind?: "max" | "min" | "inflection" | "root" | "plain" | "center" }[];
  /** V11: tô miền giữa đồ thị và trục Ox (dạy tích phân, diện tích hình phẳng). */
  shade?: { from: number; to: number; label?: string };
  xLabel?: string;
  yLabel?: string;
};

/** V11 — Thống kê (lớp 10, 11, 12). */
export type StatChartVisual = {
  type: "stat_chart";
  chart: "bar" | "column" | "pie" | "line" | "histogram";
  labels: string[];
  series: { name?: string; values: number[]; color?: string }[];
  /** Với histogram: mốc lớp ghép, ví dụ [150,155,160,165]. */
  bins?: number[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  /** Hiển thị số liệu trên cột. */
  showValues?: boolean;
};

/** V11 — Biểu đồ hộp, tứ phân vị, giá trị ngoại lệ (lớp 10 & 12). */
export type BoxPlotVisual = {
  type: "box_plot";
  groups: { name: string; min: number; q1: number; median: number; q3: number; max: number; outliers?: number[] }[];
  title?: string;
  unit?: string;
};

/** V11 — Sơ đồ cây xác suất (lớp 11 & 12, xác suất có điều kiện). */
export type ProbTreeVisual = {
  type: "prob_tree";
  root?: string;
  branches: {
    label: string;
    p: string;
    children?: { label: string; p: string; result?: string }[];
  }[];
  caption?: string;
};

/** V11 — Đường tròn lượng giác (lớp 11). */
export type UnitCircleVisual = {
  type: "unit_circle";
  /** Góc cần đánh dấu, theo radian hoặc chuỗi LaTeX như "\\pi/3". */
  angles: { value: string; label?: string; color?: string }[];
  /** Hiện trục sin/cos/tan/cot. */
  show?: ("sin" | "cos" | "tan" | "cot")[];
  /** Tô cung nghiệm của phương trình lượng giác. */
  arcs?: { from: string; to: string; label?: string }[];
};

/** V11 — Trục số: tập nghiệm bất phương trình, hợp/giao tập hợp (lớp 10). */
export type NumberLineVisual = {
  type: "number_line";
  min: number;
  max: number;
  ticks?: number[];
  intervals: { from: number | "-inf"; to: number | "+inf"; closedLeft?: boolean; closedRight?: boolean; label?: string; color?: string }[];
  points?: { x: number; label?: string; filled?: boolean }[];
};

/** V11 — Miền nghiệm bất phương trình bậc nhất hai ẩn (lớp 10). */
export type RegionVisual = {
  type: "inequality_region";
  /** Mỗi ràng buộc dạng a*x + b*y <= c. */
  constraints: { a: number; b: number; c: number; op: "<=" | ">=" | "<" | ">"; label?: string }[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Hàm mục tiêu F = p*x + q*y cho bài toán quy hoạch tuyến tính. */
  objective?: { p: number; q: number; label?: string };
  vertices?: { x: number; y: number; label?: string }[];
};

/** V11 — Hình không gian (lớp 11 & 12). */
export type Solid3DVisual = {
  type: "solid_3d";
  shape: "pyramid" | "prism" | "cube" | "cone" | "cylinder" | "sphere" | "tetrahedron";
  /** Số cạnh đáy với chóp/lăng trụ (3 = tam giác, 4 = tứ giác, 6 = lục giác). */
  baseSides?: number;
  labels?: string[];
  height?: number;
  /** Các đoạn cần tô đậm, ví dụ đường cao SH, khoảng cách. */
  highlights?: { from: string; to: string; label?: string; dashed?: boolean; color?: string }[];
  caption?: string;
};

/** V11 — Hệ trục Oxyz và vectơ trong không gian (lớp 12). */
export type OxyzVisual = {
  type: "oxyz";
  points?: { x: number; y: number; z: number; label?: string }[];
  vectors?: { from?: string; x: number; y: number; z: number; label?: string; color?: string }[];
  /** Mặt phẳng ax + by + cz + d = 0. */
  planes?: { a: number; b: number; c: number; d: number; label?: string }[];
  sphere?: { x: number; y: number; z: number; r: number; label?: string };
  range?: number;
};

/** V11 — Vectơ trong mặt phẳng (lớp 10). */
export type VectorVisual = {
  type: "vector_2d";
  vectors: { x1: number; y1: number; x2: number; y2: number; label?: string; color?: string; dashed?: boolean }[];
  points?: { x: number; y: number; label?: string }[];
  polygon?: { x: number; y: number; label?: string }[];
  xMin: number; xMax: number; yMin: number; yMax: number;
  /** Hiện quy tắc hình bình hành. */
  showParallelogram?: boolean;
};

/** V11 — Biểu đồ Ven (lớp 10, mệnh đề & tập hợp). */
export type VennVisual = {
  type: "venn";
  sets: { name: string; color?: string }[];
  /** Vùng cần tô: "A", "B", "AB", "A-B", "AuB"... */
  shade?: string[];
  caption?: string;
};

/** V11 — Bảng số liệu / bảng tần số. */
export type TableVisual = {
  type: "data_table";
  headers: string[];
  rows: string[][];
  caption?: string;
  /** Chỉ số cột/hàng cần tô nổi bật. */
  highlightRow?: number;
};

/** V11 — Slide tương tác: câu hỏi trắc nghiệm bấm chọn khi trình chiếu HTML. */
export type QuizVisual = {
  type: "quiz";
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  /** Giây đếm ngược hiển thị trên slide. */
  timer?: number;
};

export type Visual =
  | FormulaVisual
  | VariationVisual
  | SignVisual
  | GraphVisual
  | StatChartVisual
  | BoxPlotVisual
  | ProbTreeVisual
  | UnitCircleVisual
  | NumberLineVisual
  | RegionVisual
  | Solid3DVisual
  | OxyzVisual
  | VectorVisual
  | VennVisual
  | TableVisual
  | QuizVisual;

export type VisualType = Visual["type"];

/* ---------- Cấu trúc bài giảng ---------- */

/** Pha hoạt động theo Công văn 5512 / CT GDPT 2018. */
export type Phase = "khoi_dong" | "kham_pha" | "kien_thuc" | "vi_du" | "luyen_tap" | "van_dung" | "cung_co";

export type Section = {
  heading: string;
  content: string;
  visuals?: Visual[];
  /** V11: pha hoạt động, dùng để tô màu và chọn bố cục slide. */
  phase?: Phase;
  /** V11: ghi chú cho giáo viên -> xuất vào Notes của PowerPoint (V10 có checkbox nhưng không dùng). */
  notes?: string;
  /** V11: câu hỏi gợi mở giáo viên đặt cho lớp. */
  questions?: string[];
  /** V11: mức độ nhận thức, phục vụ ma trận đề. */
  level?: "NB" | "TH" | "VD" | "VDC";
  /** V11: thời lượng dự kiến (phút) để tổng hợp thành tiến trình tiết dạy. */
  minutes?: number;
  /** V11: bố cục ép buộc khi cần. */
  layout?: "auto" | "text" | "hero" | "split" | "two-visual" | "full-visual";
};

export type Lesson = {
  title: string;
  subject?: string;
  grade?: string;
  /** V11: bộ sách, mạch kiến thức, yêu cầu cần đạt (CT 2018). */
  book?: string;
  strand?: string;
  objectives?: string[];
  competencies?: string[];
  keywords?: string[];
  sections: Section[];
  /** V11: bộ chủ đề trình chiếu. */
  theme?: string;
};
