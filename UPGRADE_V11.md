# LessonStudio V11 — Hướng dẫn áp dụng bản nâng cấp

Bản này được viết đè lên mã nguồn V10 và **đã build + kiểm thử thành công**
(`tsc --noEmit` sạch, `next build` thành công, 26 unit test đạt, xuất thử
PowerPoint 25 slide / 25 ghi chú / 15 hình mở được bằng LibreOffice).

## 1. Tệp mới và tệp thay đổi

| Tệp | Trạng thái | Vai trò |
|---|---|---|
| `lib/mathexpr.ts` | **mới** | Bộ phân tích biểu thức an toàn (không `eval`), hỗ trợ sin/cos/ln/log/√/\|x\|, dò tiệm cận, đạo hàm số học |
| `lib/latex.ts` | **mới** | LaTeX → Unicode cho PowerPoint/Word; **không xoá lệnh lạ** như V10 |
| `lib/bbt.ts` | **mới** | Logic bảng biến thiên tách riêng để unit test được |
| `lib/themes.ts` | **mới** | 5 bộ chủ đề trình chiếu + màu pha hoạt động + nhãn hình |
| `lib/prompt.ts` | **mới** | Nguồn duy nhất của prompt, bám Chương trình GDPT 2018 |
| `lib/types.ts` | viết lại | 16 loại hình (V10 có 4), thêm `phase`, `notes`, `questions`, `level`, `minutes` |
| `lib/audit.ts` | viết lại | Kiểm định chéo bằng đạo hàm số học; `repairLesson` **không bịa dữ liệu** |
| `lib/exporters.ts` | viết lại | Xuất SVG→PNG nét cao, ghi chú vào Notes, alt text, tràn hình sang slide phụ, thêm xuất HTML trình chiếu / phiếu học tập / JSON |
| `lib/gemini-client.ts` | viết lại | Thử lại có giãn cách, vá JSON cụt, tự bổ sung slide thiếu, huỷ được |
| `components/MathVisuals.tsx` | viết lại | Sửa BBT + đồ thị; marker SVG có id riêng theo `useId()` |
| `components/MathVisualsExtra.tsx` | **mới** | 12 loại hình mới: thống kê, hộp, cây xác suất, đường tròn lượng giác, trục số, miền nghiệm, hình không gian, Oxyz, vectơ, Ven, bảng, quiz |
| `app/page.tsx` | viết lại | Tự lưu, nút dừng, sửa được dữ liệu hình, sắp xếp slide, sửa ghi chú |
| `app/api/generate/route.ts` | viết lại | Không còn là mã chết: dùng cho chế độ khoá dùng chung + chặn lạm dụng |
| `app/v11.css` | **mới** | Cỡ chữ đạt chuẩn tiếp cận + style cho hình mới |
| `app/layout.tsx`, `next.config.ts` | sửa | Nạp CSS mới; xử lý `node:fs` của pptxgenjs |
| `types/vendor.d.ts` | sửa | Khai báo module bổ sung |

Tệp V10 gốc được giữ nguyên trong thư mục `_v10_backup/` của gói bàn giao.

## 2. Cài đặt

```bash
npm install            # đã thêm pptxgenjs vào dependencies
npm run dev
```

`pptxgenjs` nay là **dependency thật** thay vì tải từ CDN lúc bấm nút xuất —
mạng trường học chặn CDN là mất trắng công soạn ở đúng bước cuối cùng.

## 3. Chế độ khoá dùng chung (khuyến nghị cho cấp trường)

Trên Vercel đặt:

```
GEMINI_API_KEY=...          # khoá của nhà trường
GEMINI_MODEL=models/gemini-2.5-pro
```

Giáo viên chỉ cần tích **"Dùng khoá chung của nhà trường"**, không phải tự đăng ký khoá.
Tuyến `/api/generate` có giới hạn 8 lượt/phút cho mỗi IP.

## 4. Chạy kiểm thử

```bash
npx tsc --outDir _build --rootDir . --module esnext --moduleResolution bundler \
        --target ES2020 --skipLibCheck --noEmit false \
        lib/mathexpr.ts lib/latex.ts lib/bbt.ts
echo '{"type":"module"}' > _build/package.json
node tests.mjs
```

## 5. Việc nên làm tiếp (chưa nằm trong bản này)

1. Bật `"strict": true` trong `tsconfig.json` rồi sửa dần các cảnh báo.
2. Thêm ESLint config (`next lint` hiện không có cấu hình).
3. Trình sửa hình trực quan (kéo thả mốc bảng biến thiên) thay cho ô JSON.
4. Nhúng GeoGebra/Desmos cho các hình cần tương tác động.
5. Thư viện bài giảng dùng chung cho tổ chuyên môn (cần cơ sở dữ liệu).
