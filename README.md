# LessonStudio V12 — Next.js/Vercel

Bản viết lại từ LessonStudio V9.0 Streamlit, ưu tiên hiển thị Toán học ổn định.

## Chạy cục bộ

1. Sao chép `.env.example` thành `.env.local` và nhập `GEMINI_API_KEY`.
2. Chạy `npm ci`.
3. Chạy `npm run dev`.

## Kiểm chứng trước khi triển khai

Chạy một lệnh duy nhất:

```bash
npm run verify
```

Lệnh này lần lượt kiểm tra kiểu TypeScript, chạy toàn bộ kiểm thử Toán học và
dựng bản production. Chỉ triển khai khi cả ba bước đều thành công.

Từ V12.11, GitHub Actions chạy đúng lệnh này ở **mỗi lần push và mỗi pull request**
(`.github/workflows/ci-verify.yml`), nên không còn phụ thuộc vào việc có ai nhớ gõ nó hay không.

`tsconfig.json` đã bật `"strict": true`. Đừng tắt lại để cho qua một lỗi kiểu: lỗi đó là thật.

## Triển khai Vercel

Import repository vào Vercel, thêm biến môi trường `GEMINI_API_KEY` và Deploy. Không đặt khóa API trong mã nguồn hay biến `NEXT_PUBLIC_*`.

## Visual Specification

Các hình Toán không được AI xuất thành ảnh. AI chỉ sinh JSON có cấu trúc; ứng dụng tự dựng `formula`, `variation_table`, `sign_chart` và `graph`. Điều này giúp hình nhất quán, có thể kiểm tra và sửa dữ liệu độc lập.

## Chức năng V12 nâng cao

- Nhập đồng thời tối đa 8 tệp PDF, DOCX, TXT, Markdown hoặc JSON (20 MB/tệp).
- Trích xuất nội dung ngay trong trình duyệt rồi bổ sung vào yêu cầu Gemini.
- Kiểm định cấu trúc bài giảng, công thức, bảng biến thiên, bảng xét dấu và miền đồ thị; lỗi nghiêm trọng chặn xuất.
- Xuất PowerPoint 16:9 giữ nguyên hình ảnh đã render, Word có bảng dữ liệu, ảnh xem trước, HTML và JSON.
  (Xuất PDF đã gỡ từ bản V12; nếu cần in, xuất PowerPoint rồi in ra PDF từ PowerPoint.)
