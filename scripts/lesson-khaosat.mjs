/**
 * scripts/lesson-khaosat.mjs — Bài giảng do CHÍNH nút "Khảo sát hàm số" dựng ra.
 *
 * Vì sao cần (V12.2): hai bài mẫu kia mô phỏng kết quả của AI, không phải kết
 * quả của nút khảo sát. Từ V12.2 đồ thị không còn chấm điểm nào, toàn bộ toạ độ
 * chuyển sang phần CHỮ — nên phải đo lại chính bộ slide ấy: chữ dài thêm mà
 * tràn khung thì hỏng đúng chỗ vừa sửa.
 *
 * Dùng:  LESSON=khaosat OUT=khaosat_V12_2 node scripts/build-sample-pptx.mjs
 */
import { khaoSatHamSo } from "../_build/lib/khaosat.js";

const HAM = ["(x^2+2*x-2)/(x-1)", "(x+1)/(x-1)", "x^3-3*x+2", "x^4-2*x^2"];

export const LESSON = {
  title: "Khảo sát bốn hàm số bằng nút Khảo sát hàm số",
  grade: "12",
  book: "Kết nối tri thức",
  sections: HAM.flatMap((f) => {
    const ks = khaoSatHamSo(f);
    if (!ks.ok) throw new Error(`không khảo sát được ${f}: ${ks.error}`);
    return ks.sections;
  }),
};
