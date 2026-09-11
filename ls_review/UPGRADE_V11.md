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

---

## Phụ lục — bản V11.1

**Khung xem trước là slide thật.** `lib/slides.ts` giữ toàn bộ toạ độ bố cục tính
bằng inch (hệ của PowerPoint); `components/SlideView.tsx` vẽ lại trên web ở tỉ lệ
96 px/inch, còn `lib/exporters.ts` dùng thẳng số inch đó. Nhờ chung một nguồn toạ
độ, những gì hiện trên màn hình khớp với file xuất ra.

**Trình chiếu toàn màn hình.** Nút ⛶ ở thanh trên và cạnh khung slide. Phím ←/→
hoặc phím cách để chuyển slide, **S** bật/tắt ghi chú giáo viên, **Esc** thoát.

**Nút ghi rõ chữ.** ↑ LÊN · ↓ XUỐNG · ⧉ NHÂN BẢN · 🗑 XOÁ SLIDE · ✎ SỬA SLIDE,
thay cho các biểu tượng khó đoán. Khi sửa, khung slide vẫn hiển thị phía trên.

**Sửa lỗi hiển thị tiếng Việt.** Phông `Georgia` không có glyph tiếng Việt dựng
sẵn (ồ, ắ, ầ, ố...), nên trình duyệt phải ghép chữ nền với dấu rời và chữ hiện ra
thành "nguô`n", "bă´t buộc", "hàm sô´". Đã thay toàn bộ Georgia bằng bộ phông có
đủ tiếng Việt: `"Times New Roman", Cambria, "Liberation Serif", "Noto Serif",
"DejaVu Serif", serif`.

**Lưu ý khi chọn phông về sau:** trước khi dùng một phông mới cho giao diện hoặc
cho slide, hãy thử với chuỗi kiểm tra `ồ ắ ầ ố ề ử ữ ợ ẫ ẳ Ồ Ắ Ầ Ố Ề Ử Ữ Ợ`.
Nếu dấu bị lệch hay tách rời thì phông đó thiếu glyph tiếng Việt, đừng dùng.

---

## Phụ lục — bản V11.2: hỗ trợ OpenAI

Phần mềm nay gọi được **cả Gemini lẫn OpenAI**. Xem `HUONG_DAN_OPENAI.md` để biết
các bước cấu hình.

| Tệp | Trạng thái | Vai trò |
|---|---|---|
| `lib/ai.ts` | **mới** | Lớp điều phối chung: chọn nhà cung cấp, thử lại, vá JSON, gọi bổ sung slide |
| `lib/openai-client.ts` | **mới** | Bộ nối OpenAI; tự gỡ tham số mà API không nhận rồi thử lại |
| `lib/gemini-client.ts` | rút gọn | Chỉ còn phần riêng của Gemini |
| `app/api/generate/route.ts` | sửa | Nhận `provider`, dùng `OPENAI_API_KEY` hoặc `GEMINI_API_KEY` |
| `app/api/models/route.ts` | **mới** | Liệt kê mô hình khi khoá nằm trên máy chủ |
| `app/page.tsx` | sửa | Ô chọn nguồn AI + cảnh báo an toàn cho khoá trả phí |
| `.env.example` | viết lại | Liệt kê đủ biến môi trường |

**Vì sao không hard-code tên mô hình:** tên mô hình của cả hai hãng đổi vài tháng
một lần. Phần mềm luôn **hỏi API danh sách mô hình thật của tài khoản** rồi xếp
hạng, nên không hỏng khi hãng ra bản mới hay khai tử bản cũ.

**Vì sao dòng `pro` bị xếp cuối:** giá gấp nhiều lần mà chênh lệch chất lượng
không đáng kể với việc soạn bài giảng. `rankOpenAIModel()` trừ điểm dòng này để
chế độ "Tự động chọn mô hình" không vô tình đốt tiền của giáo viên.
