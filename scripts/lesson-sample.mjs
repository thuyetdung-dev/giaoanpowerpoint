/**
 * scripts/lesson-sample.mjs — Bài giảng mẫu dùng cho kiểm thử đầu-cuối.
 * Nội dung lấy đúng từ tệp PowerPoint mà V11.5 đã xuất ra
 * ("Bài 1: Tính đơn điệu và cực trị của hàm số"), để so sánh được hai bản.
 */

export const LESSON = {
  title: "Bài 1: Tính đơn điệu và cực trị của hàm số",
  subject: "Toán",
  grade: "12",
  book: "Kết nối tri thức",
  theme: "",
  objectives: [
    "Nhận biết được tính đơn điệu của hàm số thông qua đạo hàm.",
    "Xác định được các điểm cực trị của hàm số.",
    "Vận dụng đạo hàm để giải quyết các bài toán thực tế về tối ưu hóa.",
  ],
  keywords: ["đơn điệu", "cực trị", "đạo hàm", "bảng biến thiên"],
  sections: [
    {
      phase: "khoi_dong",
      heading: "Khởi động: Bài toán thực tế",
      content:
        "Một nhà máy sản xuất linh kiện điện tử.\nLợi nhuận P(x) (triệu đồng) phụ thuộc vào số lượng sản phẩm x (nghìn chiếc).\nP(x) = -x³ + 3x² + 9x - 5.\nLàm thế nào để xác định khoảng sản xuất mà lợi nhuận tăng hoặc giảm?",
      notes: "Dẫn dắt học sinh về việc tìm khoảng đồng biến, nghịch biến của hàm số.",
      questions: ["Làm sao để biết khi nào lợi nhuận tăng?"],
      minutes: 5,
    },
    {
      phase: "kien_thuc",
      heading: "Định nghĩa tính đơn điệu",
      content:
        "Hàm số y=f(x) gọi là đồng biến trên (a; b) nếu:\nVới mọi x₁, x₂ ∈(a; b), x₁ < x₂ ⇒f(x₁) < f(x₂).\nHàm số y=f(x) gọi là nghịch biến trên (a; b) nếu:\nVới mọi x₁, x₂ ∈(a; b), x₁ < x₂ ⇒f(x₁) > f(x₂).",
      minutes: 5,
    },
    {
      phase: "kien_thuc",
      heading: "Liên hệ giữa đạo hàm và tính đơn điệu",
      content:
        "Cho hàm số f(x) có đạo hàm trên (a; b):\nNếu f'(x) > 0 với mọi x ∈(a; b) thì f(x) đồng biến trên (a; b).\nNếu f'(x) < 0 với mọi x ∈(a; b) thì f(x) nghịch biến trên (a; b).\nNếu f'(x) = 0 tại hữu hạn điểm thì hàm số vẫn đơn điệu.",
      minutes: 8,
    },
    {
      phase: "vi_du",
      heading: "Ví dụ 1: Xét tính đơn điệu",
      content:
        "Xét tính đơn điệu của hàm số f(x) = x³ - 3x + 2.\nBước 1: Tính đạo hàm f'(x) = 3x² - 3.\nBước 2: Giải phương trình f'(x) = 0 ⇒x = ±1.\nBước 3: Lập bảng xét dấu đạo hàm.\nBước 4: Kết luận khoảng đồng biến, nghịch biến.",
      visuals: [
        {
          type: "sign_chart",
          label: "f'(x)",
          x: ["-\\infty", "-1", "1", "+\\infty"],
          signs: ["+", "0", "-", "0", "+"],
        },
      ],
      minutes: 3,
    },
    {
      phase: "kien_thuc",
      heading: "Bảng biến thiên",
      content:
        "Bảng biến thiên giúp thể hiện trực quan tính đơn điệu và cực trị.\nCác thành phần:\nDòng x: các điểm làm f'(x)=0 hoặc không xác định.\nDòng f'(x): dấu của đạo hàm.\nDòng f(x): chiều biến thiên và giá trị cực trị.",
      visuals: [
        {
          type: "variation_table",
          label: "f",
          expression: "x^3-3x+2",
          x: ["-\\infty", "-1", "1", "+\\infty"],
          derivative: ["+", "0", "-", "0", "+"],
          values: ["-\\infty", "4", "0", "+\\infty"],
        },
      ],
      minutes: 7,
    },
    {
      phase: "luyen_tap",
      heading: "Luyện tập 1: Quiz",
      content:
        "Cho hàm số y=f(x) xác định trên ℝ, có bảng biến thiên như hình bên.\nQuan sát dấu của f'(x) và chiều mũi tên.\nHàm số đạt cực tiểu tại điểm nào?",
      visuals: [
        {
          type: "quiz",
          question: "Hàm số đạt cực tiểu tại điểm nào?",
          options: ["x = -2", "x = 0", "x = 1", "x = 2"],
          answerIndex: 0,
          explanation: "Đạo hàm đổi dấu từ âm sang dương tại x = -2 nên đó là điểm cực tiểu.",
        },
      ],
      minutes: 5,
    },
    {
      phase: "vi_du",
      heading: "Ví dụ 2: Tìm cực trị",
      content:
        "Tìm cực trị của hàm số f(x) = x⁴ - 2x² + 1.\nBước 1: f'(x) = 4x³ - 4x.\nBước 2: f'(x) = 0 ⇒x = 0, x = 1, x = -1.\nBước 3: Lập bảng biến thiên.\nBước 4: Xác định điểm cực đại, cực tiểu dựa vào sự đổi dấu của f'(x).",
      visuals: [
        {
          type: "graph",
          expression: "x^4-2x^2+1",
          xMin: -2.2, xMax: 2.2, yMin: -1, yMax: 4,
          /* V12.2: không đánh dấu cực trị lên đồ thị nữa — toạ độ đã có
             trong bảng biến thiên và trong phần chữ; chấm kèm nhãn ở cỡ chữ
             32 pt làm hình rối. */
        },
      ],
      minutes: 10,
    },
    {
      phase: "kien_thuc",
      heading: "Điều kiện đủ để có cực trị",
      content:
        "Giả sử f(x) liên tục trên (a; b) chứa x₀ và có đạo hàm trên (a; b) trừ điểm x₀.\nNếu f'(x) đổi dấu từ dương sang âm khi qua x₀ thì x₀ là điểm cực đại.\nNếu f'(x) đổi dấu từ âm sang dương khi qua x₀ thì x₀ là điểm cực tiểu.",
      minutes: 7,
    },
    {
      phase: "van_dung",
      heading: "Vận dụng: Tối ưu hóa",
      content:
        "Một mảnh vườn hình chữ nhật có chu vi 20m.\nGọi x là chiều rộng (m).\nDiện tích S(x) = x(10-x) = -x² + 10x.\nTìm x để diện tích lớn nhất.",
      visuals: [
        {
          type: "formula",
          latex: "S'(x) = -2x + 10 = 0 \\Rightarrow x = 5",
          caption: "Diện tích lớn nhất khi mảnh vườn là hình vuông cạnh 5 m",
        },
      ],
      minutes: 10,
    },
    {
      phase: "kien_thuc",
      heading: "Các bước khảo sát đơn điệu",
      content:
        "Tìm tập xác định D.\nTính đạo hàm f'(x).\nTìm các điểm xᵢ mà f'(xᵢ)=0 hoặc không xác định.\nLập bảng biến thiên.\nKết luận các khoảng đơn điệu.",
      minutes: 5,
    },
    {
      phase: "cung_co",
      heading: "Bài tập về nhà",
      content:
        "Xét tính đơn điệu của f(x) = (x+1)/(x-1).\nTìm cực trị của f(x) = x³ - 3x² + 2.\nTìm m để hàm số y = x³ - mx² + 3x đồng biến trên ℝ.",
      minutes: 3,
    },
  ],
};
