/**
 * scripts/lesson-bai4.mjs — Bài giảng dùng để KIỂM CHỨNG phần công thức Toán.
 *
 * Nội dung chép đúng từ tệp "Bài 4: Khảo sát và vẽ đồ thị của một số hàm số cơ
 * bản" mà V11.5 đã xuất ra và giáo viên khoanh đỏ. Mỗi mục dưới đây tái hiện
 * một lỗi cụ thể, để chạy lại là thấy ngay đã sửa được hay chưa:
 *
 *   1. phân số hai tầng           -> \\frac trong "Yêu cầu cần đạt", "Dạng"
 *   2. chỉ số dưới bằng chữ       -> y_{CT}
 *   3. lim có cận                 -> \\lim_{x \\to -\\infty}
 *   4. tập hợp có ngoặc nhọn      -> \\mathbb{R}\\setminus\\{1\\}
 *   5. nhãn bảng biến thiên sai   -> label đặt cả biểu thức (cố ý để sai)
 *   6. tiêu đề dài hai dòng       -> heading của Ví dụ 1, Ví dụ 2
 *   7. nhãn trục đồ thị dài       -> "x (sản phẩm)", "f(x) (triệu đồng)"
 */

export const LESSON = {
  title: "Bài 4: Khảo sát và vẽ đồ thị của một số hàm số cơ bản",
  subject: "Toán",
  grade: "12",
  book: "Kết nối tri thức",
  objectives: [
    "Khảo sát sự biến thiên và vẽ đồ thị của hàm số bậc ba $y = ax^{3} + bx^{2} + cx + d$ $(a \\neq 0)$.",
    "Khảo sát và vẽ đồ thị hàm số phân thức nhất biến $y = \\frac{ax+b}{cx+d}$ $(c \\neq 0,\\ ad-bc \\neq 0)$.",
    "Khảo sát và vẽ đồ thị hàm phân thức $y = \\frac{ax^{2}+bx+c}{px+q}$ $(a \\neq 0,\\ p \\neq 0)$.",
    "Vận dụng sơ đồ khảo sát hàm số vào giải quyết một số bài toán thực tế.",
  ],
  keywords: ["khảo sát hàm số", "bảng biến thiên", "tiệm cận", "đồ thị"],
  sections: [
    {
      phase: "khoi_dong",
      heading: "Khởi động: Bài toán chi phí sản xuất",
      content:
        "Xét hàm chi phí trung bình $f(x)$ (triệu đồng/sản phẩm) khi sản xuất $x$ sản phẩm.\nQuy mô $x$ tăng lớn, chi phí trung bình thay đổi ra sao?\nĐồ thị hàm $f(x)$ có tiệm cận ngang $y = 2$.\nNhận xét: chi phí trung bình giảm dần theo $x$ nhưng luôn lớn hơn 2 triệu đồng.",
      visuals: [
        {
          type: "graph",
          expression: "2+4/x",
          xMin: 0.2, xMax: 10, yMin: 0, yMax: 7,
          xLabel: "x (sản phẩm)", yLabel: "f(x) (triệu đồng)",
          asymptotes: [{ kind: "horizontal", value: 2 }],
        },
      ],
      minutes: 5,
    },
    {
      phase: "khoi_dong",
      heading: "Ôn tập: Khảo sát hàm số bậc hai",
      content:
        "Cho hàm số bậc hai $y = x^{2} - 4x + 3$.\nTập xác định $D = \\mathbb{R}$. Đạo hàm $y' = 2x - 4 = 0 \\Leftrightarrow x = 2$.\nHàm số nghịch biến trên $(-\\infty; 2)$, đồng biến trên $(2; +\\infty)$.\nCực trị: đạt cực tiểu tại $x = 2$, $y_{CT} = -1$.",
      visuals: [
        {
          // CỐ Ý để label sai như bộ sinh nội dung đã làm: cả biểu thức nhét vào
          // cột trái. Phần mềm phải tự đưa nó lên dòng nhãn phía trên bảng.
          type: "variation_table",
          label: "x^2 - 4x + 3",
          x: ["-\\infty", "2", "+\\infty"],
          derivative: ["-", "0", "+"],
          values: ["+\\infty", "-1", "+\\infty"],
        },
      ],
      minutes: 7,
    },
    {
      phase: "kham_pha",
      heading: "Sơ đồ khảo sát sự biến thiên và vẽ đồ thị",
      content:
        "Bước 1: Tìm tập xác định của hàm số.\nBước 2: Khảo sát sự biến thiên — tính $y'$, tìm các điểm $y' = 0$.\nXét dấu $y'$ để tìm khoảng đơn điệu và cực trị.\nTìm giới hạn tại vô cực và các tiệm cận.\nBước 3: Vẽ đồ thị, xác định điểm đặc biệt và tính đối xứng.",
      minutes: 8,
    },
    {
      phase: "kien_thuc",
      heading: "Hàm số bậc ba: lí thuyết và tính chất",
      content:
        "Dạng tổng quát $y = ax^{3} + bx^{2} + cx + d$ $(a \\neq 0)$.\nTập xác định $D = \\mathbb{R}$, không có tiệm cận.\nĐạo hàm $y' = 3ax^{2} + 2bx + c$.\nTính đối xứng: đồ thị có tâm đối xứng $I(x_{0}; y_{0})$ với $x_{0} = -\\frac{b}{3a}$.",
      minutes: 7,
    },
    {
      phase: "vi_du",
      heading: "Ví dụ 1: Khảo sát hàm số $y = -x^{3} + 3x^{2} - 1$",
      content:
        "Tập xác định $D = \\mathbb{R}$. Đạo hàm $y' = -3x^{2} + 6x = 0 \\Leftrightarrow x = 0$ hoặc $x = 2$.\nNghịch biến trên $(-\\infty; 0)$ và $(2; +\\infty)$; đồng biến trên $(0; 2)$.\nCực tiểu tại $(0; -1)$, cực đại tại $(2; 3)$.\nGiới hạn: $\\lim_{x \\to -\\infty} y = +\\infty$; $\\lim_{x \\to +\\infty} y = -\\infty$.\nTâm đối xứng $I(1; 1)$, cắt $Oy$ tại $(0; -1)$.",
      visuals: [
        {
          type: "variation_table",
          label: "y",
          expression: "-x^3+3x^2-1",
          x: ["-\\infty", "0", "2", "+\\infty"],
          derivative: ["-", "0", "+", "0", "-"],
          values: ["+\\infty", "-1", "3", "-\\infty"],
        },
        {
          type: "graph",
          expression: "-x^3+3*x^2-1",
          xMin: -1.5, xMax: 3.5, yMin: -3, yMax: 4,
          points: [
            { x: 0, y: -1, label: "CT(0; -1)", kind: "min" },
            { x: 2, y: 3, label: "CĐ(2; 3)", kind: "max" },
          ],
        },
      ],
      minutes: 10,
    },
    {
      phase: "kien_thuc",
      heading: "Hàm phân thức $y = \\frac{ax+b}{cx+d}$",
      content:
        "Dạng $y = \\frac{ax+b}{cx+d}$ với $c \\neq 0$, $ad - bc \\neq 0$.\nTập xác định $D = \\mathbb{R} \\setminus \\{-\\frac{d}{c}\\}$.\nĐạo hàm $y' = \\frac{ad-bc}{(cx+d)^{2}}$.\nNếu $ad - bc > 0$ thì hàm đồng biến trên từng khoảng xác định.\nTiệm cận đứng $x = -\\frac{d}{c}$; tiệm cận ngang $y = \\frac{a}{c}$.",
      minutes: 8,
    },
    {
      phase: "vi_du",
      heading: "Ví dụ 3: Khảo sát hàm số $y = \\frac{x+1}{x-1}$",
      content:
        "Tập xác định $D = \\mathbb{R} \\setminus \\{1\\}$.\nĐạo hàm $y' = \\frac{-2}{(x-1)^{2}} < 0$ với mọi $x \\neq 1$.\nHàm số nghịch biến trên từng khoảng $(-\\infty; 1)$ và $(1; +\\infty)$.\nTiệm cận đứng $x = 1$, tiệm cận ngang $y = 1$, tâm đối xứng $I(1; 1)$.",
      visuals: [
        {
          type: "graph",
          expression: "(x+1)/(x-1)",
          xMin: -4, xMax: 6, yMin: -4, yMax: 6,
          asymptotes: [{ kind: "vertical", value: 1 }, { kind: "horizontal", value: 1 }],
        },
      ],
      minutes: 10,
    },
    {
      phase: "luyen_tap",
      heading: "Luyện tập: Nhận dạng đồ thị",
      content: "Quan sát đồ thị bên và chọn phương án đúng.",
      visuals: [
        {
          type: "quiz",
          question: "Hàm số $y = \\frac{ax+b}{cx+d}$ có tiệm cận ngang là đường nào?",
          options: ["$y = \\frac{a}{c}$", "$x = -\\frac{d}{c}$", "$y = \\frac{b}{d}$", "$y = 0$"],
          answerIndex: 0,
          explanation: "Khi $x \\to \\pm\\infty$ thì $y \\to \\frac{a}{c}$.",
        },
      ],
      minutes: 5,
    },
  ],
};
