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

## Đăng nhập (V12.11)

Trang **không mở cho mọi người**. Middleware chặn mọi đường dẫn — kể cả
`/api/generate`, tuyến tiêu tiền khoá AI — trước khi yêu cầu chạm tới mã ứng dụng.
Thiếu cấu hình thì phần mềm **khoá lại**, không mở ra.

Cần hai biến môi trường:

| Biến | Nội dung |
|---|---|
| `AUTH_SECRET` | chuỗi ngẫu nhiên ≥ 32 ký tự, dùng để ký cookie phiên. Đổi nó = buộc mọi người đăng nhập lại |
| `TEACHERS` | danh sách tài khoản, mỗi người một dòng, ngăn nhau bằng `;` |

Mỗi dòng có dạng `tên|vai trò|salt|hash` (vai trò: `admin` hoặc `teacher`).
**Đừng tự gõ tay** — mở trang `/tao-tai-khoan` của chính phần mềm, nhập tên và mật
khẩu, nó in ra sẵn dòng để dán vào `TEACHERS`.

Mật khẩu được băm **ngay tại trình duyệt** (PBKDF2-SHA256, 210.000 vòng) nên không
bao giờ đi qua mạng, và biến `TEACHERS` không chứa mật khẩu thật. Giáo viên có thể
tự mở trang đó, tự chọn mật khẩu, rồi chỉ đưa dòng kết quả cho quản trị.

Trang `/tao-tai-khoan` cố ý để ai cũng vào được: nó chỉ là một phép tính chạy tại
máy người dùng, không cấp quyền gì. Che nó lại thì chính quản trị cũng không tạo
nổi tài khoản đầu tiên.

`lib/auth.ts` chỉ dùng **Web Crypto**, tuyệt đối không `node:crypto` — vì nó phải
chạy được ở cả middleware (Edge), route handler (Node) và trình duyệt. Có một phép
kiểm tra tự động canh điều này.

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
