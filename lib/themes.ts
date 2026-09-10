/**
 * lib/themes.ts — Bộ chủ đề trình chiếu (V11)
 *
 * V10 có ô chọn "Phong cách" nhưng chỉ nhét chuỗi đó vào prompt AI; màu sắc slide
 * xuất ra luôn cố định (const C = {navy, coral...}). V11 tách hẳn thành theme,
 * dùng chung cho cả bản xem trước trên web lẫn file PowerPoint xuất ra.
 *
 * Ghi chú phông chữ: V10 dùng "Aptos Display"/"Aptos" — phông này chỉ có trên
 * Microsoft 365 đời mới. Rất nhiều máy tính ở trường THPT còn Office 2016/2019
 * hoặc WPS => PowerPoint sẽ thay phông và vỡ bố cục. V11 mặc định dùng phông
 * chắc chắn có tiếng Việt trên mọi máy (Calibri/Times New Roman/Arial).
 */

export type Theme = {
  id: string;
  name: string;
  /** Mô tả để giáo viên chọn nhanh. */
  hint: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  primary: string;
  accent: string;
  line: string;
  /** Nền slide bìa và slide chuyển mục. */
  coverBg: string;
  coverInk: string;
  headFont: string;
  bodyFont: string;
  mathFont: string;
  /** Bảng màu cho biểu đồ thống kê. */
  chart: string[];
};

export const THEMES: Theme[] = [
  {
    id: "academic",
    name: "Xanh học thuật",
    hint: "Trang nghiêm, hợp hội giảng và thao giảng cấp trường/tỉnh",
    bg: "FFFFFF",
    surface: "F5F9FC",
    ink: "17283A",
    muted: "63788A",
    primary: "17324D",
    accent: "E4572E",
    line: "D5E1EA",
    coverBg: "17324D",
    coverInk: "FFFFFF",
    headFont: "Times New Roman",
    bodyFont: "Calibri",
    mathFont: "Cambria Math",
    chart: ["17324D", "E4572E", "0E8A72", "F2A541", "6C63A6", "3C8DAD"],
  },
  {
    id: "minimal",
    name: "Hiện đại tối giản",
    hint: "Nhiều khoảng trắng, chữ to, hợp lớp học có máy chiếu mờ",
    bg: "FFFFFF",
    surface: "F7F7F8",
    ink: "1B1B1F",
    muted: "6E6E76",
    primary: "111827",
    accent: "2563EB",
    line: "E4E4E8",
    coverBg: "111827",
    coverInk: "FFFFFF",
    headFont: "Calibri",
    bodyFont: "Calibri",
    mathFont: "Cambria Math",
    chart: ["2563EB", "111827", "059669", "D97706", "7C3AED", "0891B2"],
  },
  {
    id: "classroom",
    name: "Tươi sáng lớp học",
    hint: "Màu ấm, nhiều tương phản, giữ sự chú ý của học sinh lớp 10",
    bg: "FFFDF7",
    surface: "FFF4E3",
    ink: "26303B",
    muted: "6B7785",
    primary: "0F766E",
    accent: "F4511E",
    line: "F0DFC6",
    coverBg: "0F766E",
    coverInk: "FFFFFF",
    headFont: "Verdana",
    bodyFont: "Calibri",
    mathFont: "Cambria Math",
    chart: ["0F766E", "F4511E", "F9A825", "3949AB", "8E24AA", "00897B"],
  },
  {
    id: "night",
    name: "Nền tối giảng đường",
    hint: "Chống chói khi phòng tối, chữ sáng trên nền than chì",
    bg: "141A21",
    surface: "1D2630",
    ink: "F2F6FA",
    muted: "9AA9B8",
    primary: "5AC8E0",
    accent: "FFB454",
    line: "2C3844",
    coverBg: "0D1218",
    coverInk: "FFFFFF",
    headFont: "Calibri",
    bodyFont: "Calibri",
    mathFont: "Cambria Math",
    chart: ["5AC8E0", "FFB454", "7DD87D", "FF7A9C", "B58BFF", "63C7B2"],
  },
  {
    id: "exam",
    name: "Ôn thi tốt nghiệp",
    hint: "Đậm chất luyện đề: nhiều bảng, nhấn mạnh mức độ NB-TH-VD-VDC",
    bg: "FFFFFF",
    surface: "F3F6F9",
    ink: "1F2933",
    muted: "5B6B7B",
    primary: "9B1C1C",
    accent: "1D4ED8",
    line: "DCE3EA",
    coverBg: "7F1D1D",
    coverInk: "FFFFFF",
    headFont: "Times New Roman",
    bodyFont: "Times New Roman",
    mathFont: "Cambria Math",
    chart: ["9B1C1C", "1D4ED8", "047857", "B45309", "6D28D9", "0E7490"],
  },
];

export function getTheme(idOrName?: string): Theme {
  if (!idOrName) return THEMES[0];
  const key = idOrName.trim().toLowerCase();
  return (
    THEMES.find((t) => t.id === key || t.name.toLowerCase() === key) ?? THEMES[0]
  );
}

/** Nhãn tiếng Việt của từng loại hình — dùng chung cho giao diện và bộ xuất. */
export const VISUAL_LABEL: Record<string, string> = {
  formula: "CÔNG THỨC",
  variation_table: "BẢNG BIẾN THIÊN",
  sign_chart: "BẢNG XÉT DẤU",
  graph: "ĐỒ THỊ HÀM SỐ",
  stat_chart: "BIỂU ĐỒ THỐNG KÊ",
  box_plot: "BIỂU ĐỒ HỘP",
  prob_tree: "SƠ ĐỒ CÂY XÁC SUẤT",
  unit_circle: "ĐƯỜNG TRÒN LƯỢNG GIÁC",
  number_line: "TRỤC SỐ",
  inequality_region: "MIỀN NGHIỆM",
  solid_3d: "HÌNH KHÔNG GIAN",
  oxyz: "HỆ TRỤC Oxyz",
  vector_2d: "VECTƠ",
  venn: "BIỂU ĐỒ VEN",
  data_table: "BẢNG SỐ LIỆU",
  quiz: "CÂU HỎI TƯƠNG TÁC",
};

/** Màu nhận diện cho từng pha hoạt động (CT GDPT 2018). */
export const PHASE_META: Record<string, { label: string; color: string; icon: string }> = {
  khoi_dong: { label: "Khởi động", color: "F4511E", icon: "🔥" },
  kham_pha: { label: "Khám phá", color: "1D4ED8", icon: "🔎" },
  kien_thuc: { label: "Kiến thức mới", color: "0F766E", icon: "📘" },
  vi_du: { label: "Ví dụ mẫu", color: "6D28D9", icon: "✏️" },
  luyen_tap: { label: "Luyện tập", color: "B45309", icon: "🎯" },
  van_dung: { label: "Vận dụng", color: "047857", icon: "🌍" },
  cung_co: { label: "Củng cố", color: "9B1C1C", icon: "🧩" },
};
