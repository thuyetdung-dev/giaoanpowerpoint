# Dùng khoá OpenAI cho phần mềm giaoanpowerpoint

Phần mềm chạy được với hai nguồn AI: **Google Gemini** (có bậc miễn phí) và
**OpenAI** (trả phí theo lượng chữ). Tài liệu này hướng dẫn cách gắn khoá OpenAI.

---

## 1. Cách làm được khuyến nghị — đặt khoá trên Vercel

Đây là cách **an toàn duy nhất** nếu trang web của bạn ai cũng mở được.

1. Vào <https://vercel.com> → chọn dự án **giaoanpowerpoint**.
2. Vào **Settings → Environment Variables**.
3. Thêm hai biến (bấm **Add** cho từng biến):

   | Key | Value | Environments |
   |---|---|---|
   | `OPENAI_API_KEY` | khoá của bạn, dạng `sk-...` | chọn cả ba: Production, Preview, Development |
   | `AI_PROVIDER` | `openai` | chọn cả ba |

4. Vào tab **Deployments** → bấm **⋯** ở bản mới nhất → **Redeploy**.
   (Biến môi trường chỉ có tác dụng sau khi triển khai lại.)
5. Mở trang web, ở thanh bên:
   - **Nguồn AI** → chọn **OpenAI**
   - Tích ô **Dùng khoá chung của nhà trường**
   - Bấm **Dò** để lấy danh sách mô hình, rồi chọn mô hình muốn dùng.
6. Soạn bài như bình thường.

Ở chế độ này khoá nằm trên máy chủ Vercel, trình duyệt của giáo viên và học sinh
không bao giờ nhìn thấy khoá.

---

## 2. Cách thứ hai — tự dán khoá vào trình duyệt

Chỉ nên dùng khi **chỉ một mình bạn** mở trang (chạy trên máy cá nhân bằng
`npm run dev`), hoặc trang có mật khẩu bảo vệ.

1. Thanh bên → **Nguồn AI** → **OpenAI**
2. Bỏ tích ô "Dùng khoá chung của nhà trường"
3. Dán khoá `sk-...` vào ô khoá API → bấm **Dò** → chọn mô hình.

Khoá được lưu trong bộ nhớ trình duyệt của máy đó, không gửi về máy chủ
LessonStudio. Nhưng nếu trang công khai thì bất kỳ ai mở trang cũng có thể lấy
khoá bằng công cụ Developer Tools và dùng hết tiền trong tài khoản của bạn.

---

## 3. Chọn mô hình nào

Bấm **Dò** để phần mềm lấy đúng danh sách mô hình mà tài khoản của bạn được cấp
(danh sách này khác nhau tuỳ tài khoản và thay đổi theo thời gian).

Nguyên tắc chọn:

- **Dòng rẻ (tên có `luna`, `mini`, `nano`)** — đủ tốt cho phần lớn bài giảng,
  chi phí rất thấp. Nên bắt đầu từ đây.
- **Dòng tầm trung (`terra`, số hiệu chính như `gpt-5.4`)** — nội dung mạch lạc
  hơn, bám sách giáo khoa tốt hơn. Dùng khi soạn bài hội giảng.
- **Dòng `pro`** — đắt gấp nhiều lần, không đáng cho việc soạn bài hằng ngày.
  Phần mềm cố ý xếp dòng này xuống cuối khi tự chọn.

Nếu chọn "Tự động chọn mô hình", phần mềm lấy mô hình mạnh nhất **không phải
dòng pro** trong danh sách tài khoản bạn có.

---

## 4. Kiểm soát chi phí

1. Vào <https://platform.openai.com> → **Settings → Limits**, đặt
   **Monthly budget** (ví dụ 5 USD) và bật cảnh báo qua email.
   Đây là việc nên làm **ngay hôm nay**, trước cả khi soạn bài đầu tiên.
2. Tài liệu nguồn càng dài thì càng tốn. Nếu chỉ cần bài giảng theo chuẩn
   chương trình, hãy để trống phần tải tài liệu.
3. Số slide dự kiến càng lớn càng tốn. 20–25 slide là đủ cho 2 tiết.
4. Xem mức tiêu thụ thực tế tại **platform.openai.com → Usage**.

---

## 5. Gặp lỗi thì đọc ở đây

| Thông báo | Nguyên nhân | Cách xử lý |
|---|---|---|
| *Máy chủ chưa cấu hình OPENAI_API_KEY* | Chưa thêm biến, hoặc thêm rồi mà chưa Redeploy | Thêm biến rồi Redeploy lại |
| *Khoá API OpenAI không hợp lệ hoặc đã bị thu hồi* | Khoá sai, thiếu ký tự, hoặc đã xoá trên OpenAI | Tạo khoá mới, dán lại, Redeploy |
| *Tài khoản của bạn chưa được cấp mô hình "..."* | Mô hình đó không có trong tài khoản | Bấm **Dò** rồi chọn mô hình khác trong danh sách |
| *OpenAI báo vượt hạn mức hoặc hết số dư* | Hết tiền hoặc chạm trần chi tiêu | Nạp tiền hoặc nâng trần ở mục **Billing** |
| *Mô hình trả lời bị cắt vì chạm giới hạn độ dài* | Bài quá dài | Giảm số slide dự kiến hoặc bớt tài liệu nguồn |

---

## 6. Vẫn dùng song song được cả hai

Bạn có thể đặt cả `OPENAI_API_KEY` lẫn `GEMINI_API_KEY` trên Vercel. Khi đó
giáo viên chọn nguồn nào trong thanh bên thì phần mềm gọi nguồn đó — tiện để
so sánh chất lượng, hoặc dùng Gemini miễn phí cho bài thường và OpenAI cho bài
hội giảng.
