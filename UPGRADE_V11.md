# LessonStudio V11 — Hướng dẫn áp dụng bản nâng cấp

Bản này được viết đè lên mã nguồn V10 và **đã build + kiểm thử thành công**.

**Bản hiện tại: V11.6** — `next build` sạch, 39/39 kiểm thử đạt, 19/19 loại hình
Toán có chữ ≥ 32 pt khi in lên slide, xuất thử 31 slide mở được bằng LibreOffice
và không khối chữ nào tràn khung. Xem mục 5 để biết cách tự chạy lại các phép đo
này.

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
| `app/layout.tsx`, `next.config.ts` | sửa | Nạp CSS mới; xử lý `node:fs` của pptxgenjs; V11.6 thêm `suppressHydrationWarning` cho thẻ `<html>` để dẹp cảnh báo do tiện ích Chrome chèn class `mdl-js` |
| `lib/slides.ts` | viết lại ở V11.6 | Thang cỡ chữ `TYPO`, bố cục "chữ trên – hình dưới", chia slide theo sức chứa, `svgFontPx()` |
| `scripts/` | **mới ở V11.6** | Ba script đo cỡ chữ và xuất thử PowerPoint (xem mục 5) |
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
        lib/mathexpr.ts lib/latex.ts lib/bbt.ts lib/library.ts
echo '{"type":"module"}' > _build/package.json
node tests.mjs
```

## 5. V11.6 — Cỡ chữ đọc được từ cuối lớp

### Vấn đề

Mở tệp PowerPoint do V11.5 xuất ra và đo lại, kết quả như sau:

| Thành phần | V11.5 | V11.6 |
|---|---|---|
| Nội dung slide chỉ có chữ | 17–24 pt | **32–36 pt** |
| Nội dung khi slide có hình | 18 pt (cột trái rộng 3,65 in) | **32–36 pt** |
| Tiêu đề slide | 26 pt | 32 pt |
| Chữ bên trong bảng biến thiên, đồ thị, quiz | **13–15 pt** | **32–34 pt** |

Dòng cuối là chỗ nặng nhất. Hình được vẽ trong khung SVG rồi bị thu cho vừa ô
trên slide, nên chữ bên trong bị thu theo. Bảng biến thiên khung 860 px nhét vào
ô rộng 7,3 in có hệ số thu 0,61 — nhãn 22 px hoá ra 13 pt. Ở khoảng cách 8–10 m
(bàn cuối của một lớp thường), 13 pt là không đọc được.

### Cách sửa

Đảo lại thứ tự ràng buộc: **cỡ chữ là điều kiện cứng, bố cục phải chiều theo.**

1. `lib/slides.ts` có hằng `TYPO`, trong đó `bodyMin = 32` là ngưỡng sàn cho mọi
   chữ nội dung. Thừa chữ thì **sang slide mới**, không thu nhỏ chữ. Cũng đã bỏ
   `fit: "shrink"` ở các khối nội dung — để đó là PowerPoint tự hạ cỡ chữ mà
   giáo viên không hay biết.
2. Bỏ bố cục "chữ trái – hình phải". Chữ trải hết bề ngang ở trên, hình nằm dưới
   và cũng trải hết bề ngang. Mỗi slide nhiều nhất **một** hình.
3. Hình chỉ ở chung slide với chữ khi nó đủ dẹt để vẫn chiếm trọn bề ngang —
   `bandRoomFor()` tính phần chiều cao còn lại. Hình cao (đồ thị, quiz, bảng số
   liệu) chiếm trọn một slide riêng; đó chính là lý do chữ bên trong đủ to.
4. Cỡ chữ trong hình được tính **ngược** từ ô chứa bằng `svgFontPx(W, H)`, chứ
   không đặt cứng bằng px. Các lớp CSS trong `app/v11.css` chuyển sang đơn vị
   `em` để ăn theo cỡ gốc đó.
5. `exportPptx()` nay đi theo đúng `buildDeck()` mà khung xem trước dùng. Trước
   đây hai nơi dựng slide bằng hai vòng lặp riêng, nên xem trước một đằng, tệp
   xuất ra một nẻo.

Hệ quả: cùng một bài giảng, số slide tăng khoảng 25–30 % (bài mẫu: 25 → 31
slide). Đó là cái giá phải trả và là cái giá đúng — một slide không đọc được thì
có ít slide cũng vô nghĩa.

### Cách tự kiểm chứng

Ba script trong `scripts/` (không tham gia bản dựng, đã ghi trong `.vercelignore`):

```bash
npm i -D playwright esbuild        # chỉ cần cho việc kiểm chứng, không phải để chạy web

# 1. Đo cỡ chữ bên trong cả 19 loại hình Toán
npx esbuild scripts/_entry.tsx --bundle --outfile=/tmp/vis-bundle.js \
    --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"'
node scripts/measure-visuals.mjs      # in bảng kết quả + ảnh dựng thử vào .measure/

# 2. Xuất thật một tệp .pptx bằng chính hàm exportPptx của ứng dụng
npx esbuild scripts/_export-entry.tsx --bundle --outfile=/tmp/export-bundle.js \
    --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"'
node scripts/build-sample-pptx.mjs

# 3. Mở tệp đó ra đo lại cỡ chữ từng slide
python3 scripts/check-pptx.py .measure/bai_giang_V11_6.pptx
```

Kết quả trên bản này: **19/19 loại hình đạt**, **31/31 slide có mọi chữ nội dung
≥ 32 pt**, không khối chữ nào tràn khung.

### Sửa cỡ chữ theo ý mình

Muốn đổi ngưỡng, sửa `TYPO.bodyMin` và `TYPO.bodyMax` trong `lib/slides.ts`
(nhớ sửa cả `bodySteps`). Nâng ngưỡng lên thì số slide tăng thêm; hạ xuống thì
ngược lại. Sau khi sửa, chạy lại ba script ở trên — đừng tin mắt thường, vì chữ
trong hình bị thu theo hệ số mà mắt không ước lượng được.

## 6. Việc nên làm tiếp (chưa nằm trong bản này)

1. Bật `"strict": true` trong `tsconfig.json` rồi sửa dần các cảnh báo.
2. Thêm ESLint config (`next lint` hiện không có cấu hình).
3. Trình sửa hình trực quan (kéo thả mốc bảng biến thiên) thay cho ô JSON.
4. Nhúng GeoGebra/Desmos cho các hình cần tương tác động.
5. Thư viện bài giảng dùng chung cho tổ chuyên môn (cần cơ sở dữ liệu).
6. Hệ trục Oxyz vẽ hơi nhỏ so với khung (chữ đã đủ to, chỉ là hình chưa dùng hết
   chỗ) — nên chỉnh lại tỉ lệ trong `components/MathVisualsExtra.tsx`.

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

---

## Phụ lục — bản V11.3

**Chặn "bảng vẽ bằng ký tự |".** AI hay quên là đã có sẵn loại hình bảng, nên kẻ
bảng biến thiên bằng dấu gạch đứng ngay trong `content`. Chiếu lên màn hình chỉ
ra một dãy chữ lộn xộn. Nay có hai cảnh báo mới trong `lib/audit.ts`:

- `ASCII_TABLE` — phát hiện từ 2 dòng trở lên có nhiều dấu `|`.
- `BBT_MISSING_VISUAL` — đề bài nói "có bảng biến thiên" mà slide không có bảng.

`lib/prompt.ts` cũng cấm thẳng việc này và yêu cầu: câu trắc nghiệm dựa trên một
bảng biến thiên cho sẵn thì slide phải có ĐỒNG THỜI `variation_table` và `quiz`.

**Chia chiều cao theo loại hình.** `visualBoxes()` trước đây chia đều chiều cao
cho các hình trên cùng một slide. Với cặp *bảng biến thiên + câu hỏi 4 phương án*
thì phương án D bị cắt mất — học sinh không thấy đáp án cuối. Nay mỗi loại hình
có trọng số riêng (`HEIGHT_WEIGHT`): quiz 1,55 — bảng xét dấu 0,75 — trục số 0,6…
Cả khung xem trước lẫn bộ xuất PPTX dùng chung hàm này nên hai bên vẫn khớp nhau.

---

## Phụ lục — bản V11.4: mở lối ra khỏi trình biên tập

**Lỗi.** Màn hình khởi đầu — nơi đặt ô tải tài liệu, nút *Mở tệp JSON* và nút
*TẠO POWERPOINT BÀI GIẢNG* — chỉ hiện khi `lesson` còn rỗng (`app/page.tsx`,
nhánh `{!lesson ? … : …}`). Trong trình biên tập lại không có nút nào đưa
`lesson` về rỗng. Thêm nữa, bản nháp tự khôi phục từ `localStorage` ngay khi mở
trang, nên tải lại trang cũng không thoát ra được.

Hệ quả: soạn xong bài đầu tiên là kẹt vĩnh viễn với bài đó. Đổi *Tên bài* ở
thanh bên không có tác dụng vì không còn nút để bấm tạo.

**Cách sửa.** Thêm nút **✚ Bài mới** ở thanh công cụ trình biên tập. Bấm vào sẽ
hiện dải xác nhận với ba lựa chọn: *Lưu JSON trước*, *Xoá và soạn bài mới*,
*Huỷ*. Hàm `startNewLesson()` huỷ lượt gọi AI đang chạy, đưa `lesson` về rỗng,
dọn `audit`/`selected`/`editing`/`visualDraft`/`presenting`, **xoá cả bản nháp
trong `localStorage`** rồi trả giao diện về màn hình khởi đầu. Thông tin giáo
viên, trường và các tuỳ chọn ở thanh bên được giữ nguyên để soạn bài tiếp theo
không phải nhập lại.

Có hỏi lại trước khi xoá vì bản nháp chỉ nằm trong trình duyệt — xoá nhầm là mất
công soạn cả buổi, không có cách khôi phục.

| Tệp | Trạng thái | Vai trò |
|---|---|---|
| `app/page.tsx` | sửa | Thêm trạng thái `confirmNew`, hàm `startNewLesson()`, nút ✚ Bài mới và dải xác nhận |
| `app/v11.css` | sửa | Style cho nút ✚ Bài mới và dải xác nhận; ẩn dải này khi in |

---

## Phụ lục — bản V11.5: thư viện bài giảng trong trình duyệt

**Vấn đề còn lại sau V11.4.** Nút *Bài mới* đã mở được lối ra, nhưng vẫn phải
xoá bài cũ mới soạn được bài mới, vì cả phần mềm chỉ có **một** chỗ lưu duy nhất
(`lessonstudio.v11.draft`). Giáo viên dạy ba khối, mỗi tuần vài bài — cách lưu
đó không khớp với thực tế công việc.

**Thư viện.** Nay lưu được nhiều bài và chuyển qua lại tuỳ ý:

- Mọi bài vừa tạo, vừa nạp từ JSON hay đang sửa đều **tự vào thư viện** sau 600 ms,
  không cần bấm lưu.
- Nút **▤ Thư viện (n)** ở thanh công cụ mở danh sách: tiêu đề, khối lớp, bộ sách,
  số slide, số hình và thời điểm sửa gần nhất. Mỗi dòng có *Mở*, *Nhân bản*, *Xoá*.
- Danh sách cũng hiện ở màn hình khởi đầu, nên sau khi bấm *Bài mới* vẫn quay lại
  bài cũ được.
- *Nhân bản* để soạn biến thể cho lớp khác mà không động vào bài gốc.
- *Xoá* phải xác nhận ngay trên dòng đó — xoá là mất hẳn.
- Mở lại trang thì bài đang làm dở tự mở ra như cũ.

**Chuyển đổi tự động.** `migrateLegacyDraft()` biến bản nháp của V11.0–V11.4 thành
mục đầu tiên của thư viện rồi xoá khoá cũ. Giáo viên đang soạn dở không mất bài.

**Vì sao tách chỉ mục khỏi nội dung.** `lib.index` chỉ giữ phần mô tả (vài trăm
byte); nội dung mỗi bài nằm riêng ở `lib.item.<id>` (thường 30–100 KB). Mở trang
chỉ đọc chỉ mục, và tự lưu chỉ ghi đè đúng bài đang mở thay vì ghi lại cả thư viện
mỗi 600 ms.

**Ghi nội dung trước, cập nhật chỉ mục sau.** Nếu hết dung lượng giữa chừng thì
chỉ mục vẫn khớp với thứ thực sự nằm trong bộ nhớ — không sinh ra mục bấm vào thì
báo "không mở được".

**Giới hạn phải nói rõ với người dùng.** `localStorage` chỉ khoảng 5 MB, thuộc về
một trình duyệt trên một máy. Xoá dữ liệu duyệt web, dùng cửa sổ ẩn danh hay đổi
máy là mất. Vì vậy mọi hàm ghi đều trả lỗi tường minh (`QUOTA_HINT`) thay vì thất
bại im lặng, và bảng thư viện luôn kèm dòng nhắc xuất JSON làm bản lưu thật.

| Tệp | Trạng thái | Vai trò |
|---|---|---|
| `lib/library.ts` | **mới** | Chỉ mục + nội dung từng bài, nhân bản, xoá, chuyển đổi bản nháp cũ, xử lý hết dung lượng |
| `app/page.tsx` | sửa | Trạng thái `library`/`activeId`, tự lưu vào thư viện, `openEntry`/`copyEntry`/`deleteEntry`, bảng `LibraryPanel` |
| `app/v11.css` | sửa | Style bảng thư viện |
| `tests.mjs` | sửa | 13 kiểm thử mới cho thư viện (tổng 39, tất cả đạt) |
