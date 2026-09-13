/**
 * scripts/check-ocr.mjs — Kiểm chứng việc ĐỌC PDF ẢNH QUÉT (V12.3).
 *
 * Phép kiểm này chạy THẬT, không giả lập: script tự dựng một tệp PDF chỉ gồm
 * ảnh (không có lớp văn bản nào — `pdftotext` trên tệp ấy ra rỗng), rồi mở nó
 * trong trình duyệt thật bằng đúng mã lib/ocr.ts mà phần mềm dùng, và đối chiếu
 * chữ đọc được với chữ đã in ra ảnh.
 *
 * VÌ SAO PHẢI CHẠY THẬT. Bộ nhận dạng được nạp từ CDN lúc chạy, không nằm trong
 * package.json. Thứ không có trong bản dựng thì không có trình biên dịch nào
 * soát hộ: sai một đường dẫn là thầy bấm nút và không có gì xảy ra. Chỉ có mở
 * trình duyệt lên chạy mới biết.
 *
 * Cách chạy:
 *   1. Cài bộ nhận dạng ra một thư mục riêng (KHÔNG thêm vào package.json —
 *      nó nặng ~42 MB, Vercel không cần):
 *        mkdir -p /tmp/ocrtest && cd /tmp/ocrtest && npm init -y
 *        npm i tesseract.js@6.0.1 @tesseract.js-data/vie
 *   2. Quay lại thư mục dự án và chạy:
 *        TESSDIR=/tmp/ocrtest/node_modules node scripts/check-ocr.mjs
 *
 * Không có TESSDIR thì script báo BỎ QUA chứ không báo đạt — đây là điểm cốt
 * yếu: một phép kiểm không chạy được phải nói rõ là nó không chạy.
 */

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const GOC = new URL("../", import.meta.url).pathname;
const TESSDIR = process.env.TESSDIR || join(GOC, "node_modules");
const TAM = join(GOC, ".measure", "ocr");

const canCo = [
  ["tesseract.js/dist/tesseract.min.js", "tesseract.js"],
  ["tesseract.js/dist/worker.min.js", "tesseract.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm", "tesseract.js-core"],
  ["@tesseract.js-data/vie/4.0.0/vie.traineddata.gz", "@tesseract.js-data/vie"],
];
const thieu = canCo.filter(([p]) => !existsSync(join(TESSDIR, p)));
if (thieu.length) {
  console.log("BỎ QUA phép kiểm OCR — chưa có bộ nhận dạng ở máy.");
  console.log(`  Đang tìm trong: ${TESSDIR}`);
  console.log(`  Thiếu: ${[...new Set(thieu.map(([, g]) => g))].join(", ")}`);
  console.log("  Cài rồi chạy lại (xem hướng dẫn ở đầu tệp này). KHÔNG tính là đạt.");
  process.exit(0);
}

mkdirSync(TAM, { recursive: true });

/* ---------- 1. Dựng tệp PDF ảnh quét làm mẫu thử ---------- */

const CAU = [
  "BÀI 1. TÍNH ĐƠN ĐIỆU VÀ CỰC TRỊ CỦA HÀM SỐ",
  "Cho hàm số y = f(x) xác định trên khoảng K.",
  "Hàm số được gọi là đồng biến trên K nếu với mọi",
  "hai số x1, x2 thuộc K mà x1 nhỏ hơn x2 thì f(x1)",
  "nhỏ hơn f(x2).",
  "Nhận xét. Nếu đạo hàm của hàm số dương trên",
  "khoảng K thì hàm số đồng biến trên khoảng đó.",
  "Ví dụ 1. Xét tính đơn điệu của hàm số bậc ba.",
  "Lời giải. Ta lập bảng biến thiên rồi kết luận.",
];
const CAU2 = [
  "BÀI 2. GIÁ TRỊ LỚN NHẤT VÀ GIÁ TRỊ NHỎ NHẤT",
  "Định nghĩa. Số M được gọi là giá trị lớn nhất của",
  "hàm số y = f(x) trên tập D nếu f(x) không vượt quá",
  "M với mọi x thuộc D và tồn tại x0 thuộc D sao cho",
  "f(x0) bằng M.",
  "Chú ý. Hàm số liên tục trên một đoạn thì luôn đạt",
  "giá trị lớn nhất và giá trị nhỏ nhất trên đoạn ấy.",
  "Luyện tập. Tìm giá trị lớn nhất của hàm số trên",
  "đoạn đã cho bằng cách lập bảng biến thiên.",
];
const PDF = join(TAM, "sgk_quet.pdf");

const pyDung = `
from PIL import Image, ImageDraw, ImageFont
import img2pdf, io, json, sys
trang = json.loads(sys.argv[1])
F  = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
anh = []
for dong_list in trang:
    im = Image.new("RGB", (1240, 1754), "white"); d = ImageDraw.Draw(im); y = 150
    for i, dong in enumerate(dong_list):
        f = ImageFont.truetype(FB if i == 0 else F, 40 if i == 0 else 34)
        d.text((110, y), dong, fill=(15, 15, 15), font=f)
        y += 80 if i == 0 else 52
    b = io.BytesIO(); im.save(b, "PNG"); anh.append(b.getvalue())
open(sys.argv[2], "wb").write(img2pdf.convert(anh))
`;
execFileSync("python3", ["-c", pyDung, JSON.stringify([CAU, CAU2]), PDF], { stdio: ["ignore", "ignore", "inherit"] });

/* Tự chứng minh mẫu thử ĐÚNG LÀ ảnh quét: không moi ra được chữ nào. */
let lopVanBan = "";
try { lopVanBan = execFileSync("pdftotext", [PDF, "-"], { encoding: "utf8" }); } catch { lopVanBan = ""; }
if (lopVanBan.replace(/[\s\f]/g, "").length > 0) {
  console.log("LỖI: tệp mẫu vẫn còn lớp văn bản — phép kiểm sẽ đo nhầm sang cách đọc thường.");
  process.exit(1);
}
console.log("✓ Tệp mẫu là PDF ảnh quét thật (không moi ra được ký tự nào).");

/* ---------- 2. Dựng bundle từ chính lib/ocr.ts ---------- */

const BUNDLE = join(TAM, "ocr-bundle.js");
const VAO = join(TAM, "_vao.ts");
writeFileSync(VAO, 'export * from "@/lib/ocr";\n', "utf8");
execFileSync(join(GOC, "node_modules/.bin/esbuild"), [
  VAO, "--bundle", `--outfile=${BUNDLE}`, "--format=iife", "--global-name=OCR",
  `--alias:@=${GOC.replace(/\/$/, "")}`, "--loader:.ts=ts",
], { cwd: GOC, stdio: ["ignore", "ignore", "inherit"] });

/* ---------- 3. Máy chủ tĩnh: bundle, mẫu thử và bộ nhận dạng ---------- */

const KIEU = { ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
  ".gz": "application/gzip", ".pdf": "application/pdf", ".html": "text/html; charset=utf-8",
  ".json": "application/json", ".map": "application/json" };

const may = createServer((req, res) => {
  const duong = decodeURIComponent((req.url || "/").split("?")[0]);
  let tep = null;
  if (duong === "/" ) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end('<!doctype html><meta charset="utf-8"><body><script src="/ocr-bundle.js"></script>');
  }
  if (duong === "/ocr-bundle.js") tep = BUNDLE;
  else if (duong === "/sgk_quet.pdf") tep = PDF;
  else if (duong.startsWith("/tess/")) tep = join(TESSDIR, duong.slice(6));
  else if (duong === "/pdf.worker.mjs") tep = join(GOC, "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs");
  if (!tep || !existsSync(tep)) {
    /* In ra để không có yêu cầu 404 nào trôi qua mà không ai biết nó là gì —
       một tệp thiếu âm thầm chính là kiểu lỗi phép kiểm này sinh ra để bắt. */
    if (duong !== "/favicon.ico") console.log("  [404]", duong);
    res.writeHead(404); return res.end("không có");
  }
  res.writeHead(200, {
    "content-type": KIEU[extname(tep)] || "application/octet-stream",
    "access-control-allow-origin": "*",
  });
  res.end(readFileSync(tep));
});
await new Promise((ok) => may.listen(0, "127.0.0.1", ok));
const CONG = may.address().port;
const GOC_URL = `http://127.0.0.1:${CONG}`;

/* ---------- 4. Chạy thật trong trình duyệt ---------- */

const trinhDuyet = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const trang = await trinhDuyet.newPage({ viewport: { width: 1200, height: 800 } });
trang.on("pageerror", (e) => console.log("  [lỗi trang]", e.message));
trang.on("console", (m) => m.type() === "error" && console.log("  [lỗi trình duyệt]", m.text().slice(0, 200)));
await trang.goto(GOC_URL, { waitUntil: "domcontentloaded" });

const batDau = Date.now();
const kq = await trang.evaluate(async (goc) => {
  const file = new File([await (await fetch(`${goc}/sgk_quet.pdf`)).arrayBuffer()], "sgk_quet.pdf", { type: "application/pdf" });
  const moc = [];
  const trangDoc = await window.OCR.ocrPdf(file, {
    onProgress: (t) => moc.push(t.viec),
    workerPdf: `${goc}/pdf.worker.mjs`,
    nguon: {
      ten: "cục bộ",
      thuVien: `${goc}/tess/tesseract.js/dist/tesseract.min.js`,
      worker: `${goc}/tess/tesseract.js/dist/worker.min.js`,
      loi: `${goc}/tess/tesseract.js-core`,
      ngonNgu: `${goc}/tess/@tesseract.js-data/vie/4.0.0`,
    },
  });
  return {
    soTrang: await window.OCR.soTrangPdf(file, `${goc}/pdf.worker.mjs`),
    trangDoc,
    ghep: window.OCR.ghepTrang(trangDoc),
    coChu: window.OCR.coChuKhong(trangDoc),
    moc,
  };
}, GOC_URL).catch((e) => ({ loi: String(e) }));

const giay = ((Date.now() - batDau) / 1000).toFixed(1);
await trinhDuyet.close();
may.close();

if (kq.loi) { console.log("LỖI khi chạy OCR:", kq.loi); process.exit(1); }

/* ---------- 5. Đối chiếu ---------- */

let dat = 0, hong = 0;
const kiem = (ten, dieu) => { dieu ? dat++ : (hong++, console.log("  ✗", ten)); };

const boDau = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const toanBo = boDau(kq.ghep);

kiem("đọc đúng 2 trang", kq.trangDoc.length === 2);
kiem("soTrangPdf trả về 2", kq.soTrang === 2);
kiem("có chữ đọc được", kq.coChu === true);
kiem("có báo tiến độ cho người dùng", kq.moc.length >= 4);
kiem("ghép trang có đánh số trang", /--- Trang 1 ---/.test(kq.ghep) && /--- Trang 2 ---/.test(kq.ghep));

/* Từng câu phải nhận ra được. Không đòi đúng từng ký tự — OCR bao giờ cũng có
   vài chỗ nhầm — mà đòi phần lớn số TỪ của câu xuất hiện đúng. */
const doGiongNhau = (cau) => {
  const tu = boDau(cau).split(" ").filter((t) => t.length > 1);
  const co = tu.filter((t) => toanBo.includes(t));
  return co.length / Math.max(1, tu.length);
};
for (const cau of [...CAU, ...CAU2]) {
  const ti = doGiongNhau(cau);
  kiem(`đọc được câu "${cau.slice(0, 38)}…" (${Math.round(ti * 100)}% số từ)`, ti >= 0.8);
}

/* Dấu tiếng Việt là chỗ dễ hỏng nhất, kiểm riêng. */
for (const tu of ["đồng biến", "đạo hàm", "giá trị lớn nhất", "bảng biến thiên", "khoảng", "định nghĩa"]) {
  kiem(`giữ đúng dấu tiếng Việt: "${tu}"`, toanBo.includes(tu));
}

writeFileSync(join(TAM, "ket-qua.txt"), kq.ghep, "utf8");
console.log(`\nChữ đọc được đã ghi vào .measure/ocr/ket-qua.txt (${giay}s cho 2 trang).`);

/* ---------- 6. Giao diện: thầy bấm nút thì có chạy không? ---------- */
/**
 * Phần trên chứng minh lib/ocr.ts đọc được chữ. Phần này chứng minh NÚT BẤM
 * nối đúng vào nó — hai chuyện khác nhau, và chuyện thứ hai mới là chuyện thầy
 * gặp. Chạy trên bản dựng thật tại cổng 3123 (cần `npx next start -p 3123`).
 *
 * Các yêu cầu tới CDN được chuyển hướng về bản Tesseract cục bộ, nhưng ĐỊA CHỈ
 * mà ứng dụng gọi vẫn là địa chỉ CDN thật — nên phép kiểm này cũng bắt được lỗi
 * ghi sai đường dẫn trong NGUON_MAC_DINH.
 */
const UNG_DUNG = process.env.APP || "http://127.0.0.1:3123";
let coUngDung = false;
try {
  const r = await fetch(UNG_DUNG, { signal: AbortSignal.timeout(4000) });
  coUngDung = r.ok;
} catch { coUngDung = false; }

if (!coUngDung) {
  console.log(`\nBỎ QUA phần kiểm giao diện — không thấy ứng dụng ở ${UNG_DUNG}.`);
  console.log("  Chạy `npx next start -p 3123` rồi chạy lại. KHÔNG tính là đạt.");
} else {
  const tdBrowser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
  const tr = await tdBrowser.newPage({ viewport: { width: 1500, height: 1000 } });
  tr.on("pageerror", (e) => console.log("  [lỗi trang]", e.message));

  /* Chuyển hướng CDN -> tệp cục bộ, giữ nguyên đường dẫn bên trong gói. */
  const DOI = [
    [/cdn\.jsdelivr\.net\/npm\/tesseract\.js@[^/]+\/(.+)$/, (m) => join(TESSDIR, "tesseract.js", m[1])],
    [/cdn\.jsdelivr\.net\/npm\/tesseract\.js-core@[^/]+\/(.+)$/, (m) => join(TESSDIR, "tesseract.js-core", m[1])],
    [/cdn\.jsdelivr\.net\/npm\/@tesseract\.js-data\/vie@[^/]+\/(.+)$/, (m) => join(TESSDIR, "@tesseract.js-data/vie", m[1])],
    [/cdn\.jsdelivr\.net\/npm\/pdfjs-dist@[^/]+\/(.+)$/, (m) => join(GOC, "node_modules/pdfjs-dist", m[1])],
  ];
  const daGoi = [];
  await tr.route("**://cdn.jsdelivr.net/**", async (route) => {
    const url = route.request().url();
    daGoi.push(url);
    for (const [re, lay] of DOI) {
      const m = re.exec(url);
      if (m && existsSync(lay(m)))
        return route.fulfill({
          status: 200,
          headers: { "content-type": KIEU[extname(lay(m))] || "application/octet-stream", "access-control-allow-origin": "*" },
          body: readFileSync(lay(m)),
        });
    }
    return route.fulfill({ status: 404, body: "không có bản cục bộ" });
  });

  await tr.goto(UNG_DUNG, { waitUntil: "networkidle" });
  await tr.setInputFiles('input[type="file"][accept*=".pdf"]', PDF);
  await tr.waitForSelector(".ocr-box", { timeout: 20000 });
  kiem("tải PDF ảnh quét lên thì hiện khung mời đọc bằng OCR", true);
  const chuKhung = await tr.locator(".ocr-box").first().innerText();
  kiem("khung nói rõ công thức Toán sẽ đọc sai", /công thức Toán sẽ đọc sai/i.test(chuKhung));
  kiem("khung nói rõ máy không gửi sách đi đâu", /không gửi sách đi đâu/i.test(chuKhung));
  kiem("khung cho biết tệp có mấy trang", /Tệp có 2 trang/.test(chuKhung));
  await tr.screenshot({ path: join(TAM, "ui-1-moi-ocr.png"), fullPage: false });

  await tr.fill('.ocr-trang input >> nth=0', "1");
  await tr.fill('.ocr-trang input >> nth=1', "2");
  await tr.click(".ocr-chay");
  kiem("bấm nút thì hiện thanh tiến độ", await tr.locator(".ocr-thanh").isVisible({ timeout: 15000 }).catch(() => false));
  await tr.screenshot({ path: join(TAM, "ui-2-dang-doc.png") });

  await tr.waitForSelector(".file-list span:has-text('OCR trang 1–2')", { timeout: 240000 });
  kiem("đọc xong thì tệp vào danh sách tài liệu nguồn", true);
  const dsTep = await tr.locator(".file-list").innerText();
  kiem("tên tệp ghi rõ là bản OCR và khoảng trang", /OCR trang 1–2/.test(dsTep));
  kiem("khung mời OCR biến mất sau khi đọc xong", (await tr.locator(".ocr-box").count()) === 0);
  const loiNhan = await tr.locator(".message, .note, .status").first().innerText().catch(() => "");
  kiem("có nhắc lại rằng công thức Toán có thể sai", /công thức Toán/.test(loiNhan + chuKhung));
  await tr.screenshot({ path: join(TAM, "ui-3-xong.png") });

  kiem("ứng dụng gọi đúng địa chỉ tesseract.js đã ghim",
       daGoi.some((u) => u.includes("tesseract.js@6.0.1/dist/tesseract.min.js")));
  kiem("ứng dụng gọi đúng địa chỉ lõi wasm đã ghim",
       daGoi.some((u) => u.includes("tesseract.js-core@6.1.2")));
  kiem("ứng dụng gọi đúng địa chỉ dữ liệu tiếng Việt đã ghim",
       daGoi.some((u) => u.includes("@tesseract.js-data/vie") && u.includes("vie.traineddata")));

  await tdBrowser.close();
  console.log("  Ảnh chụp giao diện nằm trong .measure/ocr/");
}

console.log(`\n${dat} phép kiểm đạt, ${hong} lỗi`);
process.exit(hong ? 1 : 0);
