# LessonStudio V11 — Hướng dẫn áp dụng bản nâng cấp

Bản này được viết đè lên mã nguồn V10 và **đã build + kiểm thử thành công**.

**Bản hiện tại: V12.5** — `next build` sạch, 223/223 kiểm thử đạt, 41/41 phép
kiểm OCR đạt, 42/42 phép kiểm đường đi JSON, 26/26 loại
hình Toán có chữ nền ≥ 32 pt khi in lên slide, 47/47 trường hợp trong bộ rà soát
hình đều đạt và **cả 47 đều qua chính bộ kiểm định của phần mềm, không hình nào
bị chặn xuất**, hai bài giảng mẫu xuất thử mở được bằng LibreOffice, không khối
chữ nào tràn khung. Xem mục 5 → 14 để tự chạy lại mọi phép đo.

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
| `scripts/` | **mới ở V11.6** | Script đo cỡ chữ và xuất thử PowerPoint (xem mục 5, 6) |
| `lib/latex.ts` | sửa ở V11.7 | Cờ `lossy`, `splitMathSegments()`, `needsRichMath()`; sửa `\lim`, `\setminus`, `\{ \}` |
| `lib/bbt.ts` | sửa ở V11.7 | Dùng chung `lib/latex.ts`; thêm `shortLabel()`, `tableCaption()` |
| `components/MathText.tsx` | **mới ở V11.7** | `MathText` / `MixedMath` tách riêng để quiz và bảng số liệu dùng được mà không tạo vòng lặp import |
| `lib/prompt.ts` | sửa ở V11.7 | Quy tắc viết công thức cho bộ sinh nội dung |
| `lib/bbtsolve.ts` | **mới ở V11.8** | Tự **giải** ra bảng biến thiên từ biểu thức: nghiệm `y' = 0` (ghi dạng căn), tiệm cận đứng, giới hạn hai phía |
| `lib/mathexpr.ts` | sửa ở V11.8 | `detectPoles()` dò tiệm cận theo ngưỡng tương đối với bước lưới, không còn phụ thuộc may rủi |
| `lib/bbt.ts` | sửa ở V11.8 | `computeLevels()` cho **mỗi nhánh một thang riêng**, không dồn cả bảng vào một thang |
| `lib/audit.ts` | sửa ở V11.8 | Kiểm mốc bảng có đúng là nghiệm `y'` hay không; tự dựng lại bảng sai từ biểu thức |
| `components/MathVisuals.tsx` | sửa ở V11.8 | Luôn vẽ hàm chính; xếp nhãn điểm cực trị tránh đè nhau; giới hạn một phía không cưỡi lên vạch đôi |
| `lib/visualguide.ts` | **mới ở V11.9** | Hướng dẫn từng trường của cả 16 loại hình + ví dụ mẫu + bộ đọc JSON báo lỗi bằng tiếng Việt |
| `lib/slides.ts` | sửa ở V11.9 | `outlineDeck()` — liệt kê TỪNG slide của bản xuất cho danh sách bên trái |
| `app/page.tsx` | sửa ở V11.9 | Danh sách từng slide, ô sửa toàn màn hình, ô thống kê bấm được, ô hướng dẫn dữ liệu hình |
| `scripts/shoot-editor.mjs` | **mới ở V11.9** | Mở trang thật bằng Chromium, chụp ảnh và kiểm từng chỗ vừa sửa của giao diện |
| `lib/plot.ts` | **mới ở V12.0** | Thứ MỌI hình cần: vạch chia vừa chỗ, số theo dấu phẩy Việt Nam, xếp nhãn tránh nhau |
| `lib/deriv.ts` | **mới ở V12.0** | Đạo hàm KÝ HIỆU, có khai triển đa thức để ra đúng dạng SGK |
| `lib/khaosat.ts` | **mới ở V12.0** | Nút "Khảo sát hàm số": một dòng hàm số → ba slide, không qua AI |
| `scripts/samples-hinh.mjs` | **mới ở V12.0** | Bộ rà soát 42 trường hợp hình, nhiều ca cho mỗi loại |
| `components/MathVisualsExtra.tsx` | viết lại ở V12.0 | Hình chóp, Oxyz, vectơ, miền nghiệm, lượng giác, trục số, thống kê |
| `lib/audit.ts` | sửa ở V12.0 | Phép kiểm riêng cho cả 16 loại hình, không chỉ bảng biến thiên và đồ thị |
| `lib/mathexpr.ts` | sửa ở V12.0 | Xuất `parseExpression()` để lấy cây biểu thức cho đạo hàm ký hiệu |
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

## 6. V11.7 — Công thức Toán hiển thị đúng

### Vấn đề

Mở tệp PowerPoint của bài "Khảo sát và vẽ đồ thị của một số hàm số cơ bản" do
V11.6 xuất ra, đối chiếu với cách viết của sách giáo khoa:

| Hiện ra trên slide | Phải là | Nguyên nhân |
|---|---|---|
| `y = (ax+b)/(cx+d)` | phân số hai tầng | Unicode không có phân số tổng quát, `lib/latex.ts` ép về một dòng |
| `y_(CT)` | `y` với `CT` nhỏ bên dưới | chữ C, T không có dạng chỉ số trong Unicode |
| `limₓ →-∞ y = +∞` | `lim` với `x→-∞` bên dưới | biểu thức chính quy bắt cận dừng ở dấu cách |
| `x^2 - 4x + 3` trong bảng biến thiên | `x² - 4x + 3` | `plainMath()` của `lib/bbt.ts` tự viết riêng, không xử lý dấu `^` |
| cả biểu thức nhét vào cột trái bảng biến thiên | chỉ `y` và `y′` | bộ sinh nội dung điền nhầm trường `label`, phần mềm không chặn |
| `D = ℝ \\1\` | `D = ℝ \ {1}` | `\{` `\}` bị xoá cùng với dấu ngoặc nhọn thường |
| tiêu đề hai dòng tràn qua đường kẻ | nằm gọn trong khung | ô tiêu đề chỉ cao 0,76 in = đúng một dòng |
| nhãn trục `x (sả` bị cắt cụt | hiện đủ chữ | nhãn canh trái, đặt ở mép phải khung vẽ |
| `$y = \\frac{a}{c}$` in nguyên văn trong quiz | phân số | câu hỏi trắc nghiệm in chuỗi thô, không qua bộ dựng công thức |

### Cách sửa

**1. Bộ chuyển LaTeX biết tự nhận là mình không đủ sức.** `latexToUnicode()` nay
trả về thêm cờ `lossy`. Cờ bật lên khi Unicode không diễn đạt nổi: phân số tổng
quát, chỉ số bằng chữ cái, giới hạn có cận. Nguyên tắc: thà báo "tôi không diễn
đạt được" còn hơn in ra một thứ gần đúng mà học sinh đọc thành nghĩa khác.

**2. Khối chữ có công thức được dựng bằng KaTeX rồi chụp thành ảnh.**
`needsRichMath()` quyết định từng khối. CHỈ khối nào thật sự cần mới thành ảnh —
bài mẫu Bài 4 có 31 slide thì 9 khối là ảnh, phần còn lại vẫn là chữ thật sửa
được trong PowerPoint. Ảnh luôn đặt vừa bề ngang ô nên cỡ chữ giữ nguyên 32–36
pt; nếu vì lý do nào đó phải thu theo chiều cao, bộ xuất ghi lại vào
`lastRichMathReport` để bộ kiểm chứng bắt được (chính nhờ vậy mà phát hiện slide
"Yêu cầu cần đạt" chưa được chia trang, đang bị thu còn 24 pt).

**3. Phân số và `lim` dựng ở cỡ đầy đủ** (`\displaystyle`): phân số không bị thu
nhỏ, cận của `lim` nằm ngay dưới chữ `lim` — đúng cách viết của SGK. Riêng ô
chật (phương án trắc nghiệm, ô bảng số liệu) dùng cỡ giữa dòng cho gọn.

**4. Bảng biến thiên.** `plainMath()` nay dùng chung `lib/latex.ts` nên `x^2` ra
`x²`. Cột trái chỉ còn `y` và `y′`; biểu thức đầy đủ chuyển thành dòng nhãn
`y = x² - 4x + 3` ngay trên bảng. Bảng xét dấu có cột trái tự giãn theo nhãn dài
nhất.

**5. Ô tiêu đề dành sẵn chỗ cho hai dòng.** Vùng nội dung vì thế ngắn đi 0,26 in;
cỡ chữ trong hình tự tính lại nên vẫn đạt ngưỡng.

**6. Prompt siết lại** (`lib/prompt.ts`): bắt buộc `\frac`, `\lim_{x \to a}`,
chỉ số bọc ngoặc nhọn, và `label` của bảng biến thiên chỉ được là tên hàm ngắn.

### Tự kiểm chứng

```bash
npm i -D playwright esbuild       # chỉ dùng để kiểm chứng, không phải để chạy web

# Cỡ chữ bên trong 22 loại hình Toán
npx esbuild scripts/_entry.tsx --bundle --outfile=/tmp/vis-bundle.js \
    --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"'
node scripts/measure-visuals.mjs

# Xuất thật hai bài giảng mẫu bằng chính hàm exportPptx của ứng dụng
npx esbuild scripts/_export-entry.tsx --bundle --outfile=/tmp/export-bundle.js \
    --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"'
node scripts/build-sample-pptx.mjs                    # Bài 1 — kiểm cỡ chữ
LESSON=bai4 OUT=bai4 node scripts/build-sample-pptx.mjs   # Bài 4 — kiểm công thức

# Mở tệp xuất ra, đo lại cỡ chữ từng slide
python3 scripts/check-pptx.py .measure/bai4.pptx
```

`scripts/lesson-bai4.mjs` tái hiện đúng từng lỗi kể trong bảng trên, nên chạy lại
là biết ngay còn sót chỗ nào.

> **Lưu ý về bộ kiểm chứng:** `scripts/katex-css.mjs` nhúng phông KaTeX dưới dạng
> data URI. Thiếu bước này thì trang kiểm chứng rơi về phông hệ thống, `ℝ` hoá
> thành `R` và `≠` mất nét gạch — bộ kiểm chứng sẽ báo lỗi ở chỗ không có lỗi và,
> tệ hơn, bỏ sót lỗi thật.

### Điều còn hạn chế

Khối chữ dựng thành ảnh KHÔNG gõ sửa được trong PowerPoint (vẫn sửa được trong
phần mềm rồi xuất lại). Đây là đánh đổi đã cân nhắc: cách duy nhất để có công
thức sửa được ngay trong PowerPoint là dùng định dạng Equation của Office
(OMML), nhưng phải tự viết bộ chuyển đổi và vá lại tệp `.pptx` — sai một dấu là
PowerPoint báo hỏng tệp, mà ở đây không có PowerPoint thật để kiểm tra.

## 7. V11.8 — Bảng biến thiên và đồ thị hàm phân thức đúng Toán

### Vấn đề

Sáu lỗi này **không phải lỗi trình bày, là lỗi Toán**. Slide đẹp mà nội dung sai
thì tệ hơn slide xấu, vì học sinh chép vào vở.

| Hiện ra trên slide | Phải là | Nguyên nhân |
|---|---|---|
| bảng biến thiên của $y=\frac{x^2-x+1}{x+1}$ ghi mốc $x=0$ và $x=1$ | $x=-1\pm\sqrt3$ | bộ sinh nội dung **bịa** hàng $x$; phần mềm chỉ đối chiếu **dấu** của $y'$ trên từng khoảng, mà dấu thì đúng, nên không bắt được |
| mũi tên hai nhánh so le nhau, nhánh phải bị kéo dẹt | mỗi nhánh một thang riêng | `computeLevels()` chuẩn hoá cả bảng theo một thang, nên $-\infty$ của nhánh trái ép hết các bậc của nhánh phải về sát nhau |
| đồ thị chỉ còn đúng một đường thẳng chéo | đường cong **và** tiệm cận | khi có mảng `expressions`, trường `expression` bị bỏ qua hoàn toàn — hàm số chính biến mất |
| hai nhãn `CĐ` và `CT` dính thành một khối chữ; nhãn đứng đúng chỗ chấm của điểm khác | mỗi nhãn cạnh chấm của nó | nhãn được xếp **rời từng cái**, không cái nào biết cái khác ở đâu |
| giới hạn một phía ($-\infty$, $+\infty$) cưỡi lên vạch đôi của tiệm cận | nằm hai bên vạch | `textAnchor` đặt ở **thuộc tính** SVG, mà `.bbt-value{text-anchor:middle}` trong CSS thắng thuộc tính |
| chú giải in nguyên chuỗi thô `2^x` | `y = 2ˣ` | khi hàm chính trùng một phần tử của `expressions`, nhãn đẹp của phần tử đó bị bỏ mất |

### Cách sửa

**1. Biểu thức là nguồn sự thật, bảng chỉ là cách trình bày của nó.**
`lib/bbtsolve.ts` (mới) tự giải ra bảng: quét lưới tìm nghiệm $y'=0$ bằng chia
đôi, dò tiệm cận đứng, tính giới hạn hai phía, rồi **viết nghiệm vô tỉ dưới dạng
căn** ($-1-\sqrt3$, giá trị $-3-2\sqrt3$) chứ không làm tròn. `repairLesson()`
so bảng của AI với bảng tự giải; khác thì **thay thẳng** và ghi vào danh sách
"đã sửa" kèm biểu thức. Bảng nào **không có** `expression` thì để nguyên — không
có gì để đối chiếu thì không được đoán.

**2. Bộ kiểm định siết thêm hai điều.** Mốc giữa bảng phải là nghiệm của $y'$
hoặc điểm gián đoạn đã khai báo (`BBT_NODE_NOT_ROOT`), và giá trị viết bằng căn
cũng được đối chiếu — trước đây chuỗi `-3 - 2\sqrt{3}` bị cắt thành `-3-23` rồi
bỏ qua im lặng, tức là đúng những ô đáng kiểm nhất thì không kiểm.

**3. Mỗi nhánh một thang.** `computeLevels()` nay chia bảng theo các điểm gián
đoạn, chuẩn hoá bậc trong **từng nhánh** rồi mới trải lên chiều cao ô. Nhờ vậy
nhánh trái và nhánh phải của hàm phân thức đều dùng hết chiều cao, mũi tên dựng
đúng độ dốc.

**4. Hàm chính luôn được vẽ.** `expressions` chỉ còn là các đường vẽ **thêm**.
Nếu hàm chính cũng nằm trong `expressions` thì lấy luôn nhãn/màu/nét đứt của nó.
`auditGraph()` nhắc một dòng khi danh sách thiếu hàm chính, để thầy biết hình sẽ
có thêm một đường so với mô tả của AI.

**5. Nhãn điểm được xếp một lượt cho cả bộ**, tránh ba thứ: nhãn khác, **chấm**
của điểm khác, và chữ đã có trên hình (dãy số hai trục, tên trục). Không còn chỗ
thì nhãn đổi sang phía đối diện; nhãn đã rời xa chấm thì có nét mảnh nối lại.

**6. `detectPoles()` dò tiệm cận theo ngưỡng tương đối với bước lưới.** Ngưỡng
cũ `jump > 1e4` gần như không bao giờ đạt trên lưới thật — kiểm thử cũ đạt chỉ
vì trên đoạn $[-3;3]$ tình cờ có điểm lưới rơi đúng $x=1$. Nay `1/(x-1)` ra
$x=1$ trên cả $[-40;40]$, còn $x^3-3x$ không bị nhận nhầm nghiệm thành tiệm cận.

### Tự kiểm chứng

```bash
node tests.mjs              # 67 kiểm thử, có 3 nhóm mới cho V11.8

# Dựng lại 26 loại hình (thêm 4 hình hàm phân thức của Bài 4) và đo cỡ chữ
npx esbuild scripts/_entry.tsx --bundle --outfile=/tmp/vis-bundle.js \
    --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"'
node scripts/measure-visuals.mjs          # ảnh dựng thử nằm trong .measure/

# Xuất thật Bài 4 (đã thêm Ví dụ 4 — hàm bậc hai trên bậc nhất)
npx esbuild scripts/_export-entry.tsx --bundle --outfile=/tmp/export-bundle.js \
    --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"'
LESSON=bai4 node scripts/build-sample-pptx.mjs
python3 scripts/check-pptx.py .measure/bai4.pptx
```

Bảng tự giải đã được đối chiếu bằng tay với bốn hàm trong bài:

| Hàm số | Mốc $x$ | Giá trị $y$ |
|---|---|---|
| $\frac{x+1}{x-1}$ | không có cực trị, tiệm cận đứng $x=1$ | $1 \to -\infty$ ‖ $+\infty \to 1$ |
| $\frac{x^2-x+1}{x+1}$ | $-1-\sqrt3$, $-1$, $-1+\sqrt3$ | $-3-2\sqrt3$ và $-3+2\sqrt3$ |
| $\frac{x^2+2x-2}{x-1}$ | $0$, $1$, $2$ | $2$ và $6$ |
| $\frac{-x^2+x+1}{x-2}$ | $1$, $2$, $3$ | $-1$ và $-5$ |

### Điều còn hạn chế

Bộ giải làm việc **bằng số**, không biến đổi đại số. Nó nhận ra nghiệm vô tỉ dạng
$\frac{a\pm k\sqrt m}{c}$ với $m$, $c$ nhỏ và viết đúng dạng căn; ngoài khoảng đó
nó ghi `\approx` kèm hai chữ số thập phân thay vì ghi bừa một dạng căn không đúng.
Hàm có tham số chữ (ví dụ $y=\frac{x+m}{x-1}$) thì không giải được — bảng của AI
được giữ nguyên và bộ kiểm định chỉ nhắc thầy tự đối chiếu.

## 8. V11.9 — Trình biên tập: xem được mọi slide, sửa được thoải mái

### Vấn đề

Năm chỗ giáo viên chỉ ra, đều là chuyện dùng được hay không dùng được, không
phải chuyện đẹp xấu.

| Giáo viên gặp | Phải là | Nguyên nhân |
|---|---|---|
| Bài 18 mục xuất ra **74 slide** mà danh sách bên trái chỉ có 18 dòng | thấy hết 74 slide | danh sách vẽ theo `lesson.sections`, còn bản xuất thì do `buildDeck()` chia trang — 56 slide "(tiếp)" không có dòng nào để bấm |
| Ô "Sửa nội dung slide" nằm trong cột giữa, rộng chừng một phần ba màn hình | ô sửa toàn màn hình | ô nội dung cao 6 dòng cho slide có 5 ý kèm công thức; gõ tới đâu cũng phải cuộn |
| Bấm "5 gợi ý sư phạm" không ra gì | mở bảng liệt kê 5 gợi ý đó | các ô thống kê là `<span>`, chỉ in con số |
| Nút "Xem thử 10 slide" | bỏ | xuất một tệp riêng 10 slide để xem thử, trong khi khung xem trước đã là hình ảnh thật của từng slide |
| Ô dữ liệu hình là một ô JSON trắng | có hướng dẫn bên cạnh | tên trường chỉ người viết mã mới biết; gõ sai một chữ là hình thành khung trống mà không báo thiếu gì |

### Cách sửa

**1. Danh sách liệt kê TỪNG slide** (`outlineDeck()` trong `lib/slides.ts`).
Mỗi dòng là một slide của bản xuất, đúng thứ tự sẽ mở trong PowerPoint: trang
bìa, "Yêu cầu cần đạt", trang phân cách từng pha, slide nội dung, trang kết.
Slide "(tiếp)" thụt vào một chút và ghi rõ *tiếp 2/3*, bấm vào là xem được ngay
— trước đây phải xuất cả tệp mới biết nó trông thế nào. Nút **Theo mục** đổi về
cách xem cũ khi cần sắp xếp lại bài.

Bốn slide bìa / phân cách / kết được đánh dấu *tự dựng* và các nút LÊN, XUỐNG,
NHÂN BẢN, XOÁ MỤC bị chặn ở đó: chúng tác động lên cả **mục**, mà lúc ấy mục
đang chọn không nằm trên màn hình — bấm XOÁ MỤC là xoá mất thứ mình không thấy.

**2. Ô sửa toàn màn hình.** Nửa trái là tiêu đề, nội dung (chiếm hết chiều cao
còn lại) và ghi chú; nửa phải là khung slide 16:9 cập nhật ngay khi gõ, kèm hai
nút **Slide trước / Slide sau** để xem chữ vừa gõ tràn sang slide "(tiếp)" ra
sao. Esc hoặc **XONG** để đóng; đang mở ô dữ liệu hình thì Esc đóng ô đó trước,
không làm mất đoạn JSON đang gõ dở.

**3. Mỗi ô thống kê là một nút.** Bấm vào mở bảng liệt kê chi tiết, mỗi dòng có
nút nhảy tới đúng mục cần sửa. Ô "18 slide" cũ gây hiểu nhầm nên tách thành hai:
**mục nội dung** và **slide khi xuất**.

**4. Ô hướng dẫn cạnh ô dữ liệu hình** (`lib/visualguide.ts`). Hiện đúng cho
loại hình đang sửa: từng trường, trường nào bắt buộc, một câu giải thích bằng
tiếng Việt, mấy điều dễ sai, và nút **Chèn mẫu** đưa sẵn một ví dụ đầy đủ để
thầy chỉ việc sửa số. Bộ đọc JSON báo lỗi bằng tiếng Việt kèm số dòng ("có dấu
phẩy đứng trước dấu }" thay vì "Unexpected token } in JSON at position 58") và
nút **Áp dụng** bị chặn khi dữ liệu chưa đọc được, nên không lưu được dữ liệu hỏng.

### Tự kiểm chứng

Giao diện không kiểm được bằng kiểu dữ liệu hay unit test, nên có thêm một bộ mở
trang thật rồi xem ảnh:

```bash
npm run build
npx next start -p 3123 &
node scripts/shoot-editor.mjs        # ảnh lưu vào .measure/ui-*.png
```

Bộ này tự dừng và báo lỗi nếu: số dòng trong danh sách khác số slide của bản
xuất, nút "Xem thử 10 slide" còn đó, bấm slide "(tiếp)" không mở ra đúng slide,
ở slide tự dựng mà các nút sửa mục vẫn bấm được, gõ JSON sai mà nút Áp dụng
không bị chặn, "Chèn mẫu" cho ra dữ liệu không đọc được, hay Esc không đóng
được ô sửa. `node tests.mjs` kiểm thêm phần thuần tính toán: `outlineDeck()`
liệt kê đủ mọi slide, và **cả 16 ví dụ mẫu đều là dữ liệu hợp lệ** — nếu không
thì nút "Chèn mẫu" sẽ chèn vào một thứ hỏng.

### Điều còn hạn chế

Slide "(tiếp)" xem được nhưng **không sửa riêng được**: phần mềm tự chia trang
theo sức chứa, nên sửa là sửa cả mục, và số slide "(tiếp)" sẽ tự thay đổi theo.
Muốn tách hẳn thành hai mục riêng thì dùng nút **NHÂN BẢN** rồi cắt nội dung.

## 9. V12.0 — Hình đúng và rõ cho cả 16 loại, cộng nút "Khảo sát hàm số"

### Vấn đề

Tới V11.9 chỉ **bảng biến thiên** và **đồ thị hàm số** từng bị soi bằng toán
học. Mười bốn loại hình còn lại — thêm vào ở V11 — chưa từng bị mở ra xem từng
cái. Mở ra thì thấy:

| Loại hình | Lỗi |
|---|---|
| Hình chóp | **Vẽ NGƯỢC**: `labels: ["S","A","B","C","D"]` thì S rơi xuống một đỉnh đáy, D leo lên làm đỉnh chóp — vẽ ra hình chóp D.SABC. Thêm nữa, đáy hình vuông chiếu thành hình thoi nên đỉnh sau nằm đúng trên đỉnh trước, hai nhãn đè nhau |
| Hệ trục Oxyz | Không vạch chia nào; vectơ $\vec n(1;1;1)$ vẽ thành một mũi nhọn bé xíu ở gốc (mũi tên phóng theo bề dày nét); mặt phẳng chỉ ghi phương trình chứ không vẽ; hình chiếm 40 % khung |
| Vectơ mặt phẳng | **Không một con số nào trên trục** nên không kiểm được $\vec u = (3;2)$; `showParallelogram` khai rồi mà **bị bỏ qua im lặng**; tên vectơ thiếu mũi |
| Miền nghiệm | Không số trên trục; chú giải nằm **trong** khung nên đè lên chính các đường ràng buộc; nhãn hàm mục tiêu bị khung cắt |
| Đường tròn lượng giác | Thiếu bốn điểm đặc biệt A, A′, B, B′ và chiều dương; nhãn O cưỡi lên chấm gốc |
| Trục số | Chỉ ba vạch chia (min, giữa, max) nên không đọc được mút khoảng; các khoảng không có gì dóng lên trục |
| Biểu đồ hộp | **Không có trục số** nên hai nhóm không so sánh được — mà so sánh là việc duy nhất của biểu đồ hộp; số ghi "5.5" theo lối Anh–Mỹ |
| Biểu đồ cột | Tên trục tung đè lên hàng số, **mất hẳn vạch 16**: dãy vạch đọc ra 0; 4; 8; 12; 20 |
| Biểu đồ quạt | Chữ "35 %" màu xám đậm trên múi màu navy — không đọc được |
| Bảng xét dấu, sơ đồ cây, Oxyz, Ven, trắc nghiệm… | **Không có phép kiểm nào**: xác suất các nhánh cộng thành 1,1; tích hai xác suất ghi sai; đỉnh miền nghiệm không thoả ràng buộc; hai phương án trắc nghiệm giống nhau — tất cả lên slide mà phần mềm báo "Đạt" |

### Cách sửa

**1. Hình chóp vẽ theo lối SGK.** `labels[0]` là ĐỈNH, đúng cách gọi S.ABCD.
Đáy vẽ thành **hình bình hành** (cạnh trước nằm ngang, cạnh sau đẩy lên và lệch
phải) nên bốn đỉnh tách nhau rõ; cạnh bị khối che vẽ nét đứt. Hệ số thu tính từ
**khung bao của mọi điểm** nên khối luôn chiếm hết chỗ — V11 đặt cứng `s = 52`.
Nhãn đỉnh toả từ tâm đáy ra ngoài và xếp một lượt để không đè nhau. Hình nón,
hình trụ, mặt cầu đều có đường cao, bán kính R và tâm O như SGK.

**2. Mọi hình có trục đều có số trên trục.** `lib/plot.ts` (mới) gom lại phần
mà trước đây mỗi hình tự lo một kiểu:
- `ticksFit` / `ticksFitDoc`: nới bước chia cho tới khi nhãn không chạm nhau,
  tính theo **chỗ có thật** trên hình. Trục ngang so bề ngang chữ, trục đứng so
  chiều cao dòng — hai đại lượng khác nhau, dùng lẫn là ra một vạch duy nhất.
- `soVN`: dấu **phẩy** thập phân. "5.5" trên biểu đồ hộp là lỗi không đáng có.
- `chonChoDat`: xếp nhãn tránh hàng số trên trục, tránh nhãn khác và tránh
  **chấm của điểm khác** — thiếu điều kiện cuối thì nhãn "CĐ(0; 2)" đứng đúng
  chỗ chấm cực tiểu (2; 6), giáo viên đọc ra toạ độ sai hoàn toàn.

**3. Bộ kiểm định phủ cả 16 loại hình.** Mỗi loại có phép kiểm riêng, và mỗi
phép kiểm đều kèm một ca sai trong `tests.mjs` để chứng minh nó thật sự bắt được:
xác suất nhánh cộng ≠ 1 hoặc tích sai; tứ phân vị sai thứ tự; giá trị ngoại lệ
lại nằm trong hai đầu râu; **đỉnh miền nghiệm không thoả ràng buộc** (nay là
LỖI chặn xuất, không còn là cảnh báo — bài quy hoạch tuyến tính lấy giá trị lớn
nhất tại đỉnh); ô "0" của bảng xét dấu không phải nghiệm của dòng đó; tên đỉnh
hình chóp trùng nhau; mốc lớp histogram không tăng dần; hai phương án trắc
nghiệm giống nhau.

**4. Nút "Khảo sát hàm số".** Nhập một dòng, phần mềm dựng ba slide: tập xác
định, đạo hàm **viết thành công thức**, nghiệm $y' = 0$, bảng biến thiên, tiệm
cận đứng / ngang / xiên, và đồ thị có điểm cực trị. **Không gọi AI** — mọi con số
tính trực tiếp từ biểu thức, nên không có bước nào phải soi lại.

Để viết được $y'$ ra công thức cần đạo hàm **ký hiệu** (`lib/deriv.ts`), có kèm
khai triển đa thức: đạo hàm thô của $\frac{x^2+2x-2}{x-1}$ là
$\frac{(2x+2)(x-1)-(x^2+2x-2)}{(x-1)^2}$ — đúng về toán nhưng không ai in như vậy
lên slide. Rút gọn xong ra $\frac{x^2-2x}{(x-1)^2}$, đúng dạng SGK.

| Hàm số | Phần mềm tự tính ra |
|---|---|
| $\frac{x+1}{x-1}$ | $y' = \frac{-2}{(x-1)^2}$; không cực trị; TCĐ $x=1$, TCN $y=1$ |
| $\frac{x^2+2x-2}{x-1}$ | $y' = \frac{x^2-2x}{(x-1)^2}$; CĐ(0; 2), CT(2; 6); TCĐ $x=1$, TCX $y=x+3$ |
| $\frac{-x^2+x+1}{x-2}$ | CĐ/CT tại $x=1$ và $x=3$; TCĐ $x=2$, TCX $y=-x-1$ |
| $x^4-2x^2$ | $y' = 4x^3-4x$; CT(±1; −1), CĐ(0; 0) |

Đạo hàm ký hiệu còn được **đối chiếu với đạo hàm số học** tại bốn điểm bất kỳ
trong `tests.mjs`: hai đường tính hoàn toàn độc lập, khớp nhau thì gần như chắc
chắn cả hai đúng.

### Tự kiểm chứng

```bash
node tests.mjs                       # 138 kiểm thử

# Bộ RÀ SOÁT hình: 42 trường hợp, nhiều ca cho mỗi loại
npx esbuild scripts/_entry.tsx --bundle --outfile=/tmp/vis-bundle.js \
    --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"'
SAMPLES=hinh node scripts/measure-visuals.mjs     # ảnh vào .measure/hinh/
node scripts/measure-visuals.mjs                  # bộ đo cỡ chữ, ảnh vào .measure/

# Giao diện: mở trang thật rồi chụp ảnh
npm run build && npx next start -p 3123 &
node scripts/shoot-editor.mjs                     # ảnh vào .measure/ui-*.png
```

`scripts/samples-hinh.mjs` gồm cả những ca khó cố ý: hình chóp ghi đủ tên
S.ABCD và hình chóp chỉ ghi tên đáy, lăng trụ ba cạnh và lập phương, chóp lục
giác, hai nhóm biểu đồ hộp lệch thang, miền nghiệm có ràng buộc $x \ge 0,
y \ge 0$. Chạy lại là biết ngay còn sót chỗ nào.

### Điều còn hạn chế

Đạo hàm ký hiệu **không** làm được hàm có dấu giá trị tuyệt đối, không lấy được
$u^v$ khi cả cơ số lẫn số mũ chứa $x$, và không phân tích thành nhân tử (nó
khai triển, không rút gọn phân thức). Gặp ca đó nó **nói rõ là không làm được**
chứ không in ra một công thức gần đúng — bảng biến thiên vẫn dựng bình thường vì
bảng được tính bằng số.

Bộ kiểm định hình chỉ kiểm được những gì **tính được**. Hình chóp có tên đỉnh
hợp lệ nhưng đề bài mô tả một quan hệ hình học khác (SA ⊥ đáy trong khi hình vẽ
cho SA là cạnh bên) thì phần mềm không biết — chỗ đó vẫn cần mắt của giáo viên.

## 10. V12.1 — Soi lại từng hình bằng mắt: tám lỗi nữa lộ ra

V12.0 đã mở từng loại hình ra xem một lượt. V12.1 làm lại việc đó **sau khi
sửa**, với những ca mà V12.0 chưa dựng thử: đồ thị không khai tiệm cận, bảng chỉ
cho dấu trên khoảng, góc lượng giác có hệ số trước π, mặt cầu có tên tâm. Mỗi ca
lộ ra một lỗi thật.

### 10.1 Lỗi nặng nhất: góc 2π/3 bị vẽ thành 81,9°

`parseAngle` thay chữ π bằng **chuỗi số** `"3.141592653589793"` rồi mới đem đi
tính. Với `"2\pi/3"` phép thay ấy tạo ra `"23.141592653589793/3"` — bộ đọc biểu
thức thấy **một** con số 23,14 chứ không thấy 2 nhân π. Hậu quả:

| Viết vào | V12.0 vẽ ra | Đúng phải là |
|---|---|---|
| `2\pi/3` | 81,9° | 120° |
| `3\pi/4` | 114,9° | 135° |
| `5\pi/6` | 22,9° | 150° |

Cung nghiệm sai theo: hai đầu cung lệch nhau hơn π nên cờ "cung lớn" của SVG bật
lên, vệt tô đi đường dài quanh gần hết đường tròn rồi **tràn ra ngoài khung**.

Nay hàm đọc góc chuyển sang `lib/plot.ts` (`gocRadian`) và giữ π ở dạng **tên
hằng** `pi` — bộ đọc biểu thức đã biết hằng này và biết nhân ngầm. Bề rộng cung
cũng được chuẩn hoá về `[0; 2π)` trước khi so, nên hai cách viết cùng một tia
(2π/3 và −4π/3) không còn cho ra cung 338°.

### 10.2 Đồ thị: tự dò cả tiệm cận NGANG, không chỉ tiệm cận đứng

V12.1 (bản đầu) đã tự dò tiệm cận đứng nên đồ thị `(x+1)/(x−1)` bị **cắt** đúng
chỗ x = 1 thay vì nối hai nhánh bằng một đường dựng đứng giả. Nhưng đường y = 1
thì không có — mà SGK vẽ hàm nhất biến là luôn vẽ **cả hai** tiệm cận. Nay
`detectHorizontalAsymptote()` dò bằng số: lấy giá trị ở hai đầu ±10³…±10⁶, chỉ
nhận khi hai đầu cùng hữu hạn, cùng tiến về một số, và số đó không trùng trục Ox
(trục đã vẽ rồi, kẻ thêm chỉ gây rối). Thà không vẽ còn hơn vẽ sai:

| Hàm số | Kết luận |
|---|---|
| `(x+1)/(x-1)` | y = 1 |
| `(2x+3)/(x-1)` | y = 2 |
| `(x^2+1)/(x^2-1)` | y = 1 |
| `(x^2+2x-2)/(x-1)` | không có (đây là tiệm cận **xiên**) |
| `atan(x)` | không kết luận (hai đầu khác nhau) |
| `1/x` | không kẻ (y = 0 trùng trục Ox) |

### 10.3 Nhãn điểm phải đứng cạnh **chấm của mình**

V12.0 chỉ đẩy nhãn theo chiều dọc. Với đồ thị `(x²+2x−2)/(x−1)` — ba nhãn CĐ, CT
và tâm đối xứng I gần nhau — nhãn `CĐ(0; 2)` bị đẩy lên ba dòng, đứng **ngay
cạnh chấm cực tiểu (2; 6)**; ai đọc cũng tưởng chấm xanh là CĐ(0; 2). Nay chỗ
đặt được **xếp theo giá** = khoảng cách tới chấm + tiền phạt cho chỗ trái quy
ước, rồi chọn chỗ rẻ nhất còn trống, nên chỗ sát chấm được thử trước chỗ xa — kể
cả khi nó nằm ngang thay vì nằm trên. Bốn điều kiện mới:

1. **Không đè trục hoành**: `CT(1; 0)` của y = x³−3x+2 từng nhảy sang ngang chấm
   — mà chấm nằm ngay trên trục, nên đường trục kẻ gạch đôi cả dòng chữ.
2. **Cùng phía trục với chấm của nó**: `CT(1; −1)` của y = x³−3x+1 từng được đặt
   phía **trên** trục trong khi chấm nằm dưới trục, giữa nhãn và chấm có cả một
   đường trục chắn qua.
3. **Đè đường cong là một khoản tiền phạt, không phải một lệnh cấm.** Cấm hẳn thì
   nhãn bị đẩy ra xa; nhãn đứng xa chấm là lỗi **nặng hơn** nhãn chạm đường cong
   (chữ có viền trắng nên vẫn đọc được). Hai cái được cân trên cùng một bàn cân.
4. **Số trên trục bị chấm đè thì hạ xuống một dòng.** Đồ thị y = x³−3x+1 khung
   [−4; 4] có cực tiểu (1; −1) rơi đúng hàng số của trục hoành, chấm xanh trùm
   mất số "1" — mà "1" chính là hoành độ cần đọc.

### 10.4 Không bịa số 0, và vẽ vạch "|" bằng nét

- Bảng biến thiên và bảng xét dấu: khi mảng dấu chỉ có dấu trên **khoảng**
  (n−1 ô), V12.0 tự ghi số 0 vào **mọi** mốc. Với hàm phân thức thì mốc giữa là
  điểm **không xác định**, không phải nghiệm — ghi 0 ở đó là dạy sai. Nay để
  trống, và bảng nào có `expression` thì phần mềm **tự tính lại cả bảng ngay lúc
  vẽ**, không chờ bấm "Tự sửa".
- Dấu `|` và `||` nay vẽ bằng **nét**, không bằng chữ: chữ "|" của phông Times
  chỉ dày khoảng 2 px trong khung vẽ, thu xuống cỡ slide rồi chiếu lên tường thì
  gần như mất hẳn — mà đúng chỗ đó lại phân biệt "không phải nghiệm của dòng
  này" với "bằng 0".
- Ở bảng biến thiên, chữ "‖" giữa hai vạch đôi đã **bỏ**: vạch đôi vẽ bằng nét
  xuyên suốt bảng rồi, kẹp thêm một sợi chữ mảnh vào giữa chỉ làm bẩn.

### 10.5 Tâm đối xứng — thứ SGK luôn đánh dấu mà V12.0 bỏ quên

`Khảo sát hàm số` nay tự tìm và vẽ tâm đối xứng I bằng **vòng tròn rỗng** (nó
không thuộc đồ thị của hàm phân thức, chấm đặc là nói sai):

| Hàm số | Tâm |
|---|---|
| `(x+1)/(x-1)` | I(1; 1) — giao hai tiệm cận |
| `(x^2+2x-2)/(x-1)` | I(1; 4) — trên tiệm cận xiên |
| `x^3-3x+2` | I(0; 2) — điểm uốn |
| `x^2-4x+3`, `x^4-2x^2` | không có |

### 10.6 Ba trường đã khai báo mà hình chưa bao giờ vẽ

`lib/types.ts` cho khai báo, phần mềm nhận, rồi **bỏ im lặng** — đúng loại lỗi
`showParallelogram` của V12.0:

- `graph.shade.label` — bài diện tích hình phẳng tô vùng rồi không có chữ **S**
  để chỉ vào mà nói.
- `oxyz.sphere.label` — mặt cầu hiện ra có chấm tâm mà không có chữ **I**, nên
  không viết được phương trình `(x−1)²+(y−1)²+(z−1)² = 4` dựa vào hình.
- `unit_circle.arcs[].label` — bài giải phương trình lượng giác tô một vệt màu
  rồi không nói vệt ấy là gì. (Viết vào giữa cung thì chữ "Cung nghiệm" rộng hơn
  cả cung 60°, nên chú giải nằm ở góc trên bên trái, ngoài đường tròn.)

### 10.7 Dấu phẩy Việt Nam

- **Dãy số trên trục đồ thị**: đang in "4.5" và "1.5" kiểu Anh, trong khi biểu
  đồ hộp và biểu đồ cột đã ghi đúng "5,5" từ V12.0. Nay dùng chung `soVN()`.
- **Sơ đồ cây**: `auditTree` gọi `Number("0,6")` → `NaN` → `|| 0` → 0, nên sơ đồ
  ghi **đúng** kiểu Việt Nam ("0,6" và "0,4") bị báo *"tổng xác suất nhánh cấp 1
  bằng 0,000"*. Chính ô hướng dẫn của phần mềm dạy giáo viên viết dấu phẩy, rồi
  bộ kiểm định lại bắt lỗi cách viết ấy — đó là lỗi của phần mềm.

### 10.8 Bộ kiểm định nói cùng một điều với bộ dựng hình

Ba chỗ bộ kiểm định tự mâu thuẫn với phần mềm, tìm ra bằng `scripts/audit-samples.mjs`:

| Mã | V12.0 | V12.1 |
|---|---|---|
| `BBT_DERIVATIVE_LENGTH`, `BBT_SIGN_MISMATCH` | **lỗi chặn xuất** cho bảng mà chính phần mềm đã tự tính lại và vẽ đúng | hạ xuống cảnh báo, thêm `BBT_DA_TU_TINH_LAI` nói rõ việc đã làm — **vẫn giữ nguyên lời chẩn đoán chi tiết** |
| `SOLID_LABELS` | hình nón đỉnh S bị đòi "cần 5 tên nhưng có 1" | chỉ đếm tên với khối có đỉnh đa giác |
| `GRAPH_ASYMPTOTE` | "chưa vẽ đường tiệm cận" — trong khi phần mềm đã tự vẽ | "phần mềm đã tự vẽ đường này trên hình" |

Thêm một phép kiểm mới: `OXYZ_TRUNG_NHAN` — khai cả `sphere.label` lẫn một điểm
cùng tên ở đúng tâm mặt cầu thì hai nhãn viết đè lên nhau thành khối chữ không
đọc được. Đây là lỗi tôi nhìn thấy trong **ảnh dựng thử của chính mình**.

### 10.9 Bịt lỗ hổng trong chính bộ kiểm chứng

Hai bộ đo đọc bundle ở `/tmp` mà **không tự dựng lại** — phải gõ lệnh `esbuild`
bằng tay trước khi đo. Tôi quên một lần, bộ đo đọc bundle cũ, và tôi ngồi **xem
ảnh của bản trước rồi tưởng là bản mới**: kết luận "vòng tròn rỗng chưa chạy" và
"tiệm cận chưa vẽ" đều sai. Nói sai còn tệ hơn không nói. Nay
`scripts/measure-visuals.mjs` và `scripts/build-sample-pptx.mjs` tự dựng bundle
mỗi lần chạy, nên không còn khe hở đó.

Và `scripts/audit-samples.mjs` (mới) đưa **cả 47 hình mẫu qua chính bộ kiểm
định** — thứ mà trước đây không ai chạy. Ba lỗi ở mục 10.7–10.8 lộ ra ngay lần
chạy đầu tiên.

### 10.10 Tự chạy lại

```bash
npx tsc -p tsconfig.json          # phải dùng tsconfig CỦA DỰ ÁN (strict: false)
npm run build
node tests.mjs                    # 188 kiểm thử
SAMPLES=hinh node scripts/measure-visuals.mjs   # 47 hình, tự dựng bundle
node scripts/measure-visuals.mjs                # 26 loại, đo cỡ chữ
node scripts/audit-samples.mjs                  # 47 hình qua bộ kiểm định
SAMPLES=mot node scripts/audit-samples.mjs
node scripts/shoot-editor.mjs     # cần `npx next start -p 3123` chạy sẵn
LESSON=bai4 OUT=bai4_V12_1 node scripts/build-sample-pptx.mjs
python3 scripts/check-pptx.py
```

### 10.11 Còn lại, nói thẳng

- **Miền nghiệm**: nhãn đỉnh chỉ đổi được **chiều dọc**, chưa sang trái/phải như
  đồ thị đã làm ở mục 10.3. Nhãn `O(0; 0)` vì thế trôi vào giữa vùng tô.
- **Hệ trục Oxyz**: dãy số trên ba trục xếp hơi chen chúc quanh gốc; hình cũng
  chưa dùng hết bề ngang khung.
- **Chữ tham số**: giá trị dạng chữ ("m", "2m") trong bảng biến thiên in đứng,
  chưa in nghiêng như quy ước Toán.

## 11. V12.2 — Đồ thị bỏ hẳn chấm và nhãn điểm

Thầy Dũng khoanh đỏ hai hình V12.1 và viết: *"bỏ kí hiệu các điểm I(1;4),
CT(2;6), CĐ(0;2) và các dấu chấm của CT, I, CĐ vì nhìn vào nó rối mắt và chấm
cũng không đúng vị trí!"*

### 11.1 Đo trước đã: chấm có sai vị trí không?

Không. Tôi dựng lại hình rồi đo toạ độ từng chấm trong khung vẽ:

| Điểm | Toạ độ phải có | Toạ độ vẽ ra | Lệch |
|---|---|---|---|
| CĐ(0; 2) | (358,50; 219,43) | (358,50; 219,43) | 0,0000 px |
| CT(2; 6) | (541,50; 151,71) | (541,50; 151,71) | 0,0000 px |
| I(1; 4) | (450,00; 185,57) | (450,00; 185,57) | 0,0000 px |

Nhưng **đúng toạ độ không có nghĩa là hình dễ nhìn**, và cảm giác "chấm sai vị
trí" của thầy có nguyên nhân đo được:

> Khung nhìn của hàm này cao **14 đơn vị** trên một khung vẽ cao 333 px, tức
> **1 đơn vị ≈ 17 px**. Cỡ chữ sàn của phần mềm là **36 px**. Vậy mỗi nhãn
> **cao hơn hai đơn vị của trục**. Ba nhãn nằm trong một vùng cao 4 đơn vị thì
> xếp kiểu gì cũng phải chen nhau, và nhãn buộc phải lệch khỏi chấm — mà nhãn
> lệch khỏi chấm thì người đọc lấy **vị trí chữ** làm vị trí điểm.

Đây là giới hạn hình học, không phải lỗi đặt nhãn: V12.1 đã xếp nhãn theo giá
(gần chấm nhất thắng) mà vẫn không đủ chỗ. Cách chữa duy nhất còn lại là bỏ
chúng khỏi hình.

### 11.2 Bỏ chấm, KHÔNG bỏ số liệu

Các con số không mất đi, chỉ chuyển chỗ:

| Thông tin | V12.1 | V12.2 |
|---|---|---|
| Toạ độ cực trị | chấm + nhãn trên đồ thị (và trong bảng biến thiên, và ở slide 1) | bảng biến thiên, slide 1, **và thêm một dòng chữ ngay trên slide đồ thị** |
| Tâm đối xứng | vòng tròn rỗng + nhãn I(…) | dòng chữ "Tâm đối xứng: I(1; 4) — giao của hai đường tiệm cận" |

Slide đồ thị của `(x²+2x−2)/(x−1)` nay đọc:

```
Đồ thị đi qua điểm cực đại (0; 2) và điểm cực tiểu (2; 6).
Tiệm cận đứng: x = 1.
Tiệm cận xiên: y = x + 3.
Tâm đối xứng: I(1; 4) — giao của hai đường tiệm cận.
```

Hình chỉ còn **đường cong và hai đường tiệm cận** — đúng thứ cần nhìn.

Dòng liệt kê cực trị nối theo lối tiếng Việt: hai điểm dùng "và", từ ba điểm
trở lên dùng dấu phẩy rồi mới "và" (`x⁴ − 2x²` ra "điểm cực tiểu (−1; −1),
điểm cực đại (0; 0) **và** điểm cực tiểu (1; −1)").

### 11.3 Ba chỗ cùng phải đổi theo

1. **`lib/khaosat.ts`** — nút "Khảo sát hàm số" không sinh `points` nữa.
2. **`lib/prompt.ts`** — thêm một dòng bảo AI đừng chấm cực trị lên đồ thị, kèm
   lý do bằng con số (nhãn cao hơn hai đơn vị của trục). Chỉ dùng `points` khi
   đề bài hỏi thẳng về **một** điểm cụ thể.
3. **`lib/visualguide.ts`** — ô hướng dẫn bên cạnh ô dữ liệu nói rõ điều đó, và
   ví dụ mẫu "Chèn mẫu" của loại `graph` không còn điểm nào.

Trường `points` **vẫn còn** trong `lib/types.ts` và bộ dựng hình vẫn vẽ: thầy
nào muốn đánh dấu một điểm cụ thể thì tự khai trong ô dữ liệu hình.

### 11.4 Thêm một bài mẫu để đo đúng chỗ vừa sửa

`scripts/lesson-khaosat.mjs` (mới) dựng bài giảng từ **chính nút Khảo sát hàm
số** cho bốn hàm — phân thức bậc hai trên bậc nhất, nhất biến, bậc ba, trùng
phương — rồi xuất PowerPoint và đo lại. Hai bài mẫu cũ mô phỏng kết quả của AI,
không chạy qua `khaosat.ts`, nên không phát hiện được chuyện chữ dài thêm mà
tràn khung.

Nhân tiện: `scripts/check-pptx.py` mặc định mở `bai_giang_V11_6.pptx`. Chạy
`python3 scripts/check-pptx.py` mà quên đưa đường dẫn thì **đo nhầm tệp cũ**.
Luôn ghi rõ tệp:

```bash
LESSON=khaosat OUT=khaosat_V12_2 node scripts/build-sample-pptx.mjs
python3 scripts/check-pptx.py .measure/khaosat_V12_2.pptx
```

### 11.5 Tự chạy lại

```bash
npx tsc -p tsconfig.json
npm run build
node tests.mjs                                   # 195 kiểm thử
SAMPLES=hinh node scripts/measure-visuals.mjs    # 47 hình
node scripts/measure-visuals.mjs                 # 26 loại
node scripts/audit-samples.mjs
SAMPLES=mot node scripts/audit-samples.mjs
node scripts/shoot-editor.mjs                    # cần next start -p 3123
LESSON=khaosat OUT=khaosat_V12_2 node scripts/build-sample-pptx.mjs
python3 scripts/check-pptx.py .measure/khaosat_V12_2.pptx
```

## 12. V12.3 — Đọc được sách giáo khoa bản scan

Thầy Dũng tải `12-sgk-toan-12-tap-mot.pdf` lên và nhận về:

> *Đã đọc 0 tài liệu. Không đọc được: 12-sgk-toan-12-tap-mot.pdf không có văn bản
> có thể trích xuất. Nếu là PDF ảnh quét, hãy dùng OCR trước.*

Câu ấy đúng về kỹ thuật nhưng vô dụng với người dùng: phần mềm nhận ra đúng vấn
đề, gọi đúng tên giải pháp, rồi **đẩy việc khó sang cho giáo viên và bỏ đấy**.
Sách giáo khoa bản scan là dạng tài liệu phổ biến nhất mà giáo viên có trong
tay, nên phần mềm phải tự đọc được.

### 12.1 Đọc ngay trong máy thầy, không gửi sách đi đâu

`lib/ocr.ts` (mới): mỗi trang PDF được pdf.js vẽ ra một tấm ảnh, rồi Tesseract
nhận dạng chữ tiếng Việt trên tấm ảnh đó. Toàn bộ chạy **trong trình duyệt**:

- sách không rời khỏi máy — không lên máy chủ của phần mềm, không lên máy chủ
  của ai khác;
- Vercel không phải cài thêm gì, bản dựng không nặng thêm một byte.

Bộ nhận dạng nặng khoảng **42 MB** nếu cài qua `npm`, nên nó **không** nằm trong
`package.json` — mà được tải từ CDN **đúng lúc thầy bấm nút**, và chỉ tải lần
đầu (trình duyệt nhớ lại tệp ngôn ngữ). Chính `lib/importer.ts` đã tải
`pdf.worker` từ cùng CDN ấy và chạy tốt trên máy thầy, nên đây không phải một
phụ thuộc mới lạ. Có **hai** nguồn (jsDelivr, unpkg) thử lần lượt, phòng khi
mạng nhà trường chặn một cái.

### 12.2 Giao diện: một lối đi, không phải một lời than

Tải lên một PDF ảnh quét thì nay hiện một khung màu cam:

- nói rõ tệp là ảnh quét và phần mềm đọc được;
- cho chọn **đọc từ trang mấy đến trang mấy** (tối đa 60 trang một lần — chọn
  đúng bài cần soạn thì nhanh hơn nhiều), kèm tổng số trang của tệp;
- thanh **tiến độ** và nút **Dừng** — một quyển 250 trang mà bấm nhầm rồi không
  dừng được thì thầy ngồi chờ mười lăm phút;
- đọc xong thì tệp vào thẳng danh sách tài liệu nguồn, tên ghi rõ
  `sgk.pdf (OCR trang 1–20)`, nội dung có đánh số trang để biết câu chữ lấy từ
  đâu.

### 12.3 Nói trước giới hạn, đừng để thầy tự phát hiện

Khung ấy ghi thẳng hai điều, và bộ kiểm thử **bắt buộc** hai câu đó phải có mặt:

1. **Chậm.** Đo thật: một trang A4 quét 200 dpi kín chữ tiếng Việt mất khoảng
   **7 giây** (kể cả lúc khởi động bộ nhận dạng), đọc ra chừng 2.400 ký tự. Nên
   con số nói với thầy là 5–10 giây mỗi trang, 20 trang chừng 2–3 phút — không
   phải "vài giây".
2. **Công thức Toán sẽ đọc sai.** Phân số, căn, chỉ số trên dưới, dấu tích phân
   đều hỏng. Đó là giới hạn của mọi bộ OCR chữ thường. Dùng để cho AI biết bài
   học nói về cái gì thì được; chép công thức từ đó thì không.

### 12.4 Phép kiểm chạy thật, không giả lập

`scripts/check-ocr.mjs` (mới) tự dựng một tệp PDF **chỉ gồm ảnh** — `pdftotext`
trên tệp ấy ra rỗng, script tự kiểm điều đó trước rồi mới đo — rồi mở nó trong
trình duyệt thật bằng đúng mã `lib/ocr.ts`, và đối chiếu chữ đọc được với chữ đã
in ra ảnh. 41 phép kiểm, gồm:

- từng câu phải nhận ra được ít nhất 80% số từ;
- **dấu tiếng Việt** phải đúng: "đồng biến", "đạo hàm", "giá trị lớn nhất",
  "bảng biến thiên", "định nghĩa";
- phần giao diện: tải tệp lên thì hiện khung, bấm nút thì có thanh tiến độ, đọc
  xong thì tệp vào danh sách, khung biến mất;
- và ứng dụng phải gọi **đúng ba địa chỉ CDN đã ghim**. Thư viện nạp lúc chạy
  thì không trình biên dịch nào soát hộ — sai một đường dẫn là thầy bấm nút và
  không có gì xảy ra. Phép kiểm chuyển hướng CDN về bản cục bộ nhưng **giữ
  nguyên địa chỉ ứng dụng gọi**, nên vẫn bắt được lỗi ghi sai đường dẫn.

Không cài bộ nhận dạng ở máy thì script báo **BỎ QUA**, không báo đạt — một phép
kiểm không chạy được phải nói rõ là nó không chạy.

### 12.5 Số phiên bản: một chỗ duy nhất

Trang chủ đang in "Phiên bản 11" trong khi phần mềm đã ở V12.2, nên trên máy
thầy dòng ấy **đã bị sửa tay** thành "LessonStudio V12.2". Sửa tay thì lần nâng
cấp sau bị ghi đè, và thầy nhìn thấy số cũ lại tưởng gói chưa lên.

Nay `lib/version.ts` giữ số phiên bản, `tests.mjs` đối chiếu nó với
`package.json` nên hai chỗ không thể lệch nhau âm thầm. Dòng chữ dưới tiêu đề
trang chủ vì thế cũng thành **cách kiểm nhanh nhất** xem gói mới đã lên chưa.

### 12.6 Tự chạy lại

```bash
npx tsc -p tsconfig.json
npm run build
node tests.mjs                                   # 205 kiểm thử
SAMPLES=hinh node scripts/measure-visuals.mjs    # 47 hình
node scripts/measure-visuals.mjs                 # 26 loại
node scripts/audit-samples.mjs
SAMPLES=mot node scripts/audit-samples.mjs
node scripts/shoot-editor.mjs                    # cần next start -p 3123

# OCR: cài bộ nhận dạng ra thư mục riêng (ĐỪNG thêm vào package.json)
mkdir -p /tmp/ocrtest && cd /tmp/ocrtest && npm init -y
npm i tesseract.js@6.0.1 @tesseract.js-data/vie
cd - && TESSDIR=/tmp/ocrtest/node_modules node scripts/check-ocr.mjs

LESSON=khaosat OUT=khaosat_V12_3 node scripts/build-sample-pptx.mjs
python3 scripts/check-pptx.py .measure/khaosat_V12_3.pptx
```

### 12.7 Còn lại, nói thẳng

- **Ảnh quét quá mờ hoặc nghiêng** thì OCR đọc ra chữ nhảm. Phần mềm kiểm rằng
  có đọc được ít nhất 25 ký tự và báo nếu không, nhưng nó **không** đánh giá
  được chữ đọc ra có đúng hay không — chỗ đó vẫn cần mắt của thầy.
- **Trang hai cột** bị đọc trộn dòng của hai cột vào nhau.
- **Máy phải vào được mạng** lần đầu để tải bộ nhận dạng (khoảng 15 MB). Mạng
  chặn cả hai CDN thì tính năng này không chạy được, và phần mềm nói rõ như vậy
  chứ không im lặng.

## 13. V12.4 — Nhờ AI khác soạn JSON, phần mềm chỉ dựng PowerPoint

Thầy Dũng đề nghị: nạp sách vào Claude / Gemini / ChatGPT / NotebookLM, lấy về
tệp JSON, phần mềm chỉ việc dựng PowerPoint. Cách này gỡ hai nút thắt cùng lúc —
không cần khoá API trong phần mềm, và NotebookLM đọc được cả PDF ảnh quét nên
khỏi chờ OCR chạy trong trình duyệt.

### 13.1 Prompt SINH RA TỪ MÃ NGUỒN, không chép tay

`promptChoAiNgoai()` trong `lib/prompt.ts` dùng lại **nguyên** `VISUAL_SPEC` và
bộ quy tắc mà phần mềm gửi cho AI của chính nó, chỉ thêm phần hướng dẫn riêng
cho việc dán vào AI ngoài. Vì sao không viết một tệp `.md` rời: prompt này mô tả
lược đồ dữ liệu của phần mềm, nên mỗi lần lược đồ đổi thì tệp rời sai đi **trong
im lặng** — và cái sai chỉ lộ ra khi giáo viên đã ngồi với AI xong xuôi, nạp tệp
vào rồi bị báo lỗi.

Trang chủ có nút **📋 Chép prompt** và **⇩ Tải về tệp .txt** (cho máy trường
chặn bộ nhớ tạm, và cho NotebookLM).

### 13.2 Phép kiểm đi trọn đường, không chỉ đọc prompt

`scripts/check-prompt-json.mjs` (mới) làm hai việc: soi prompt có mô tả đủ 16
loại hình và các quy tắc chặn xuất hay không; rồi lấy `scripts/mau-json-tu-ai.json`
— một bài giảng soạn **đúng theo prompt** — cho chạy qua **đúng những bước phần
mềm chạy khi thầy bấm "Mở tệp JSON"**: `JSON.parse` → `auditLesson` → `buildDeck`.
42 phép kiểm, gồm cả các điều kiện sư phạm mà prompt hứa hẹn (≥ 55% slide có
hình, ≥ 2 slide trắc nghiệm, đủ sáu pha hoạt động, mọi bảng biến thiên đều khai
`expression`).

**Chạy lần đầu là ra ngay hai lỗi thật**, cả hai đều của phần mềm chứ không phải
của prompt:

### 13.3 Lỗi 1 — phân số có ngoặc lồng in ra slide thành "frac36x²"

`latexToUnicode` bắt hai nhóm của `\frac` bằng `\{([^{}]*)\}` — nhóm **không
được chứa ngoặc nào nữa**. Gặp `\frac{36}{x^{2}}` thì không khớp, `\frac` rơi
xuống mục "lệnh lạ", và chữ in ra là `frac36x²`.

Đây là dạng phân số thường gặp bậc nhất của môn Toán — `\frac{ad-bc}{(cx+d)^{2}}`,
`\frac{-b}{3a}` — mà **chính prompt của phần mềm lại dạy giáo viên viết đúng như
vậy**. Phần mềm tự mâu thuẫn: bảo viết thế, rồi báo cách viết ấy là lệnh lạ.

Nay đếm ngoặc để lấy đúng nhóm cân bằng, lồng bao nhiêu tầng cũng được:

| Viết vào | V12.3 | V12.4 |
|---|---|---|
| `\frac{36}{x^{2}}` | `frac36x²` + báo lệnh lạ | `36/(x²)` |
| `\frac{ad - bc}{(cx + d)^{2}}` | hỏng | `(ad - bc)/((cx + d)²)` |
| `\frac{\frac{1}{2}}{x}` | hỏng | `(½)/x` |

### 13.4 Lỗi 2 — bảng biến thiên trên miền con bị thay bằng bảng trên cả ℝ

Bài thực tế hầu như luôn kèm điều kiện: số tạ tôm $x > 0$, cạnh hình vuông
$x > 0$. Giáo viên lập bảng trên đúng miền ấy là **đúng về sư phạm** — nhưng
phần mềm giải biểu thức trên cả ℝ, thấy bảng "không khớp" nên **thay bằng bảng
tự tính**, và slide "chi phí nuôi tôm" hiện ra cả nhánh $x < 0$ mà đề bài không
hề có. Không lỗi nào báo.

Nay `laThuHepMien()` nhận ra tình huống đó — mọi mốc của giáo viên đều là mốc có
thật của bảng tự tính nhưng ít mốc hơn — và phần mềm **giữ nguyên bảng**, kèm
một lời nhắc `BBT_MIEN_CON` nói thẳng: *chưa tự kiểm chứng được bảng trên miền
con, thầy cô soát lại dấu y′ giúp*.

Nói rõ giới hạn: phần mềm **chưa** kiểm chứng được bảng trên miền con; nó chỉ
biết **đứng yên thay vì làm sai**. Muốn kiểm được thì phải giải lại biểu thức có
kèm miền xác định — để bản sau.

### 13.5 Thêm một chỗ nhỏ: ký hiệu đạo hàm

Hàng đạo hàm ghép dấu phẩy vào tên hàm nên nhãn `f(x)` cho ra `f(x)′`. Dấu phẩy
đi liền **tên hàm**, không đi sau biến: `tenDaoHam()` nay cho `f′(x)`. Nhãn `y`
vẫn ra `y′` như cũ.

### 13.6 Tự chạy lại

```bash
npm run verify                    # typecheck + 222 kiểm thử + build
node scripts/check-prompt-json.mjs
node scripts/audit-samples.mjs && SAMPLES=mot node scripts/audit-samples.mjs
SAMPLES=hinh node scripts/measure-visuals.mjs && node scripts/measure-visuals.mjs
node scripts/shoot-editor.mjs     # cần next start -p 3123
TESSDIR=/tmp/ocrtest/node_modules node scripts/check-ocr.mjs
```

## 14. V12.5 — Chỗ cuối cùng còn ghi cứng số phiên bản

Thầy Dũng gửi ảnh màn trình chiếu: chân slide vẫn đề **"LessonStudio V11"** dù
phần mềm đã chạy bản mới, và hỏi lỗi ở đâu.

**Phần mềm chạy đúng bản mới. Lỗi nằm ở một dòng chữ.**

`components/SlideView.tsx` dòng 116 ghi **cứng** chuỗi `LessonStudio V11`. Bản
V12.2 đã đưa số phiên bản về `lib/version.ts` và nối vào bốn nơi — tiêu đề
trang, dòng dưới tiêu đề, chân slide PowerPoint, câu mở đầu prompt — nhưng
**sót đúng tệp này**. Mà tệp này lại vẽ:

- khung **xem trước** trong trình biên tập,
- màn **TRÌNH CHIẾU** toàn màn hình (đúng màn thầy chụp),
- **Trình chiếu HTML** xuất ra,
- **Ảnh PNG** xem trước.

Nghĩa là bốn chỗ thầy nhìn nhiều nhất đều đề số cũ, trong khi tệp PowerPoint
xuất ra thì đã đúng. Tôi bảo thầy kiểm phiên bản ở dòng dưới tiêu đề và ở chân
slide PowerPoint — hai chỗ ấy đúng, nên lỗi không lộ ra qua cách kiểm tôi đưa.

### 14.1 Sửa, và chặn đường tái phạm

Chỗ đó nay lấy `APP_LABEL`. Nhưng sửa một dòng thì lần sau vẫn có thể sót một
dòng khác, nên `tests.mjs` thêm một phép kiểm **quét toàn bộ mã nguồn**
(`app/`, `components/`, `lib/`) tìm mọi chuỗi dạng `LessonStudio V<số>` hay
`Phiên bản <số>`. Chỉ `lib/version.ts` được phép ghi số.

Phép kiểm **bỏ chú thích trước khi quét** — lời giải thích được phép nhắc lại
chuỗi cũ để kể vì sao từng sai; chỉ mã chạy thật mới bị cấm. (Bản đầu tôi quên
điều này và phép kiểm bắt lỗi ngay chính lời chú thích tôi vừa viết.)

### 14.2 Đã kiểm tận nơi, không suy đoán

Nạp bài mẫu vào bản dựng thật rồi đọc chữ ở chân khung bằng trình duyệt:

| Chỗ | V12.4 | V12.5 |
|---|---|---|
| Dòng dưới tiêu đề trang chủ | LessonStudio V12.4 | LessonStudio V12.5 |
| Chân khung xem trước | **LessonStudio V11** | LessonStudio V12.5 |
| Chân màn TRÌNH CHIẾU | **LessonStudio V11** | LessonStudio V12.5 |
| Chân slide PowerPoint xuất ra | LessonStudio V12.4 | LessonStudio V12.5 |

## 15. Việc nên làm tiếp (chưa nằm trong bản này)

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
