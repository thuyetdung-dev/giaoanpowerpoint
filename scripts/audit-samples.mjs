/**
 * scripts/audit-samples.mjs — Đưa CẢ BỘ hình mẫu qua chính bộ kiểm định.
 *
 * Vì sao cần (V12.1): bộ đo cỡ chữ chỉ nói hình có đọc được hay không, nó
 * không nói hình có ĐÚNG hay không. Khi tôi lần đầu chạy phép kiểm này trên 47
 * hình mẫu thì ba lỗi lộ ra, cả ba đều là lỗi của phần mềm chứ không phải của
 * dữ liệu mẫu:
 *   - sơ đồ cây ghi xác suất "0,6" kiểu Việt Nam bị đọc thành 0 nên báo "tổng
 *     xác suất bằng 0,000" — đúng cách viết mà ô hướng dẫn dạy thầy dùng;
 *   - hình nón đỉnh S bị đòi "cần 5 tên nhưng có 1";
 *   - bảng biến thiên có biểu thức bị báo "lỗi chặn xuất" trong khi bộ dựng
 *     hình đã tự tính lại và vẽ đúng.
 *
 * Chạy:  node scripts/audit-samples.mjs           (bộ rà soát 47 hình)
 *        SAMPLES=mot node scripts/audit-samples.mjs   (bộ một-mẫu-mỗi-loại)
 */
import { auditLesson } from "../_build/lib/audit.js";

const { SAMPLES } = await import(process.env.SAMPLES === "mot" ? "./samples.mjs" : "./samples-hinh.mjs");

/* Những mã nói về CẤU TRÚC BÀI GIẢNG, không phải về hình: mỗi mẫu ở đây chỉ là
   một slide rời nên đương nhiên thiếu phần khởi động, luyện tập… */
const BO_QUA = /^(PHASE_|NO_INTERACTION|FEW_NOTES|TEXT|PASS$)/;

/* Mẫu CỐ TÌNH sai, dựng riêng để xem phần mềm xử lý ca thiếu dữ liệu thế nào. */
const CO_Y = {
  bbt_tu_tinh_lai: ["BBT_DA_TU_TINH_LAI", "BBT_DERIVATIVE_LENGTH", "BBT_SIGN_MISMATCH", "BBT_NO_EXTREMUM"],
  bbt_khong_co_bieu_thuc: ["BBT_DERIVATIVE_LENGTH"],
  do_thi_tu_tim_tiem_can: ["GRAPH_ASYMPTOTE"],
  xet_dau_chi_dau_khoang: ["SC_UNKNOWN"],
};

let hong = 0;
for (const [ten, v] of Object.entries(SAMPLES)) {
  const items = auditLesson({
    title: "Kiểm định hình mẫu",
    sections: [{ heading: "Hình mẫu", content: "Một câu nội dung đủ dài để không bị coi là slide trống.", visuals: [v] }],
  }).filter((i) => i.code && !BO_QUA.test(i.code) && i.level !== "info" && i.level !== "ok");

  const laHen = CO_Y[ten] ?? [];
  const batNgo = items.filter((i) => !laHen.includes(i.code));
  const chanXuat = items.filter((i) => i.level === "error");

  if (batNgo.length || chanXuat.length) {
    hong++;
    console.log(`✗ ${ten}`);
    for (const i of items) console.log(`    ${i.level.toUpperCase().padEnd(8)}${i.code}  ${i.message}`);
  }
}

const tong = Object.keys(SAMPLES).length;
if (hong) {
  console.log(`\n${hong}/${tong} hình mẫu có báo ngoài dự kiến hoặc bị chặn xuất.`);
  process.exit(1);
}
console.log(`\n✓ Cả ${tong} hình mẫu đều qua bộ kiểm định, không hình nào bị chặn xuất.`);
