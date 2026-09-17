/**
 * lib/ocr.ts — ĐỌC PDF ẢNH QUÉT (V12.3)
 *
 * VÌ SAO CÓ TỆP NÀY. Thầy Dũng tải quyển SGK Toán 12 tập một lên và nhận về:
 * "12-sgk-toan-12-tap-mot.pdf không có văn bản có thể trích xuất. Nếu là PDF ảnh
 * quét, hãy dùng OCR trước." Câu ấy đúng về kỹ thuật nhưng vô dụng với người
 * dùng: phần mềm đẩy việc khó sang cho giáo viên rồi bỏ mặc. PDF ảnh quét là
 * dạng phổ biến nhất của sách giáo khoa scan, nên phần mềm phải tự đọc được.
 *
 * CÁCH LÀM. Mỗi trang PDF được pdf.js vẽ ra một tấm ảnh (canvas), rồi Tesseract
 * nhận dạng chữ trên tấm ảnh đó. Toàn bộ chạy TRONG TRÌNH DUYỆT của thầy:
 *  - không gửi sách lên máy chủ nào, kể cả máy chủ của phần mềm;
 *  - Vercel không phải cài thêm gì, nên bản dựng không nặng thêm một byte.
 *
 * VÌ SAO KHÔNG ĐƯA tesseract.js VÀO package.json. Thư viện này cùng phần lõi
 * WebAssembly của nó chiếm khoảng 42 MB khi cài. Dự án đã có quy tắc giữ
 * package.json gọn để Vercel dựng nhanh (playwright và esbuild cũng nằm ngoài vì
 * lý do đó). Nên bộ nhận dạng được nạp TỪ CDN ngay lúc thầy bấm nút, và chỉ nạp
 * khi thật sự cần. Chính lib/importer.ts đã nạp pdf.worker từ cùng CDN ấy và
 * chạy tốt trên máy thầy, nên đây không phải một phụ thuộc mới lạ.
 *
 * ĐO THẬT (scripts/check-ocr.mjs): một trang A4 quét 200 dpi kín chữ tiếng Việt
 * mất khoảng 7 giây kể cả lúc khởi động bộ nhận dạng, đọc ra chừng 2.400 ký tự.
 * Nên con số nói với giáo viên là 5–10 giây mỗi trang, không phải "vài giây".
 *
 * NÓI TRƯỚC CHO ĐÚNG SỰ THẬT: OCR đọc tốt phần LỜI VĂN (định nghĩa, đề bài, chú
 * ý) nhưng đọc rất tệ CÔNG THỨC TOÁN — phân số, căn, chỉ số trên dưới, ký hiệu
 * tích phân đều ra sai. Đó là giới hạn của mọi bộ OCR chữ thường, không riêng bộ
 * này. Dùng để cho AI biết bài học nói về cái gì thì được; chép công thức từ đó
 * thì không.
 */

/** Một trang đã đọc xong. */
export type TrangOCR = { trang: number; text: string };

export type TienDoOCR = {
  /** Trang đang xử lý (đánh số như trong tệp PDF). */
  trang: number;
  /** Tổng số trang sẽ đọc trong lần chạy này. */
  tong: number;
  /** Việc đang làm, viết sẵn bằng tiếng Việt để hiện thẳng lên màn hình. */
  viec: string;
  /** 0…1 cho cả lần chạy. */
  phan: number;
};

export type TuyChonOCR = {
  tuTrang?: number;
  denTrang?: number;
  onProgress?: (t: TienDoOCR) => void;
  signal?: AbortSignal;
  /** Chỉ dùng khi chạy kiểm thử: trỏ vào bản Tesseract đặt ở máy cục bộ. */
  nguon?: NguonTesseract;
  /** Chỉ dùng khi chạy kiểm thử: trỏ vào pdf.worker đặt ở máy cục bộ. */
  workerPdf?: string;
};

export type NguonTesseract = {
  ten: string;
  /** Tệp tesseract.min.js — nạp bằng thẻ <script>. */
  thuVien: string;
  /** Tệp worker.min.js. */
  worker: string;
  /** THƯ MỤC chứa tesseract-core*.wasm (không có dấu / ở cuối). */
  loi: string;
  /** THƯ MỤC chứa vie.traineddata.gz (không có dấu / ở cuối). */
  ngonNgu: string;
};

/**
 * Hai nguồn, thử lần lượt. Mạng nhà trường chặn một CDN là chuyện có thật, nên
 * không đặt hết trứng vào một giỏ. Số phiên bản ghim cứng: tôi đã tải đúng các
 * gói này về và kiểm rằng ĐƯỜNG DẪN BÊN TRONG GÓI là có thật, còn CDN thì phục
 * vụ nguyên trạng nội dung gói npm.
 */
export const NGUON_MAC_DINH: NguonTesseract[] = [
  {
    ten: "jsDelivr",
    thuVien: "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js",
    worker: "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js",
    loi: "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.1.2",
    ngonNgu: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/vie@1.0.0/4.0.0",
  },
  {
    ten: "unpkg",
    thuVien: "https://unpkg.com/tesseract.js@6.0.1/dist/tesseract.min.js",
    worker: "https://unpkg.com/tesseract.js@6.0.1/dist/worker.min.js",
    loi: "https://unpkg.com/tesseract.js-core@6.1.2",
    ngonNgu: "https://unpkg.com/@tesseract.js-data/vie@1.0.0/4.0.0",
  },
];

/** Độ phóng khi vẽ trang PDF ra ảnh. 2,0 ≈ 144 dpi — đủ cho chữ sách giáo khoa. */
const PHONG = 2.0;
/** Chặn trên để một lần chạy không kéo dài vô tận. */
export const TOI_DA_TRANG = 60;

function huy(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Đã dừng theo yêu cầu.");
}

/** Nạp một tệp .js bằng thẻ <script>, trả về khi nạp xong. */
function napScript(url: string): Promise<void> {
  return new Promise((ok, hong) => {
    const co = document.querySelector<HTMLScriptElement>(`script[data-ocr="${url}"]`);
    if (co && co.dataset.xong === "1") return ok();
    const s = co ?? document.createElement("script");
    s.dataset.ocr = url;
    s.addEventListener("load", () => { s.dataset.xong = "1"; ok(); }, { once: true });
    s.addEventListener("error", () => hong(new Error(`không nạp được ${url}`)), { once: true });
    if (!co) { s.src = url; document.head.appendChild(s); }
  });
}

/**
 * Nạp Tesseract, thử lần lượt từng nguồn. Trả về nguồn nào dùng được để các
 * đường dẫn worker / lõi / ngôn ngữ lấy cùng một nơi — trộn hai CDN dễ lệch
 * phiên bản.
 */
async function napTesseract(ds: NguonTesseract[]): Promise<{ T: any; nguon: NguonTesseract }> {
  const loi: string[] = [];
  for (const n of ds) {
    try {
      await napScript(n.thuVien);
      const T = (globalThis as any).Tesseract;
      if (T?.createWorker) return { T, nguon: n };
      loi.push(`${n.ten}: nạp xong nhưng không thấy Tesseract`);
    } catch (e) {
      loi.push(`${n.ten}: ${e instanceof Error ? e.message : "lỗi"}`);
    }
  }
  throw new Error(
    "Không tải được bộ nhận dạng chữ. Máy cần vào mạng để tải nó về lần đầu " +
      `(sau đó trình duyệt nhớ lại). Chi tiết: ${loi.join("; ")}`,
  );
}

/** Nạp pdf.js và chỉ cho nó chỗ lấy worker (mặc định: cùng CDN mà lib/importer.ts đang dùng). */
async function napPdfjs(workerPdf?: string) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc =
    workerPdf || `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
  return pdfjs;
}

/** Số trang của một tệp PDF — để giao diện biết mà hỏi thầy đọc từ trang nào. */
export async function soTrangPdf(file: File, workerPdf?: string): Promise<number> {
  const pdfjs = await napPdfjs(workerPdf);
  /* destroy() nằm ở TÁC VỤ NẠP, không ở tài liệu: pdf.js v6 đã gỡ
     PDFDocumentProxy.destroy(). Xem ghi chú dài hơn ở lib/importer.ts. */
  const tacVuNap = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await tacVuNap.promise;
    return pdf.numPages;
  } finally {
    await tacVuNap.destroy();
  }
}

/**
 * Đọc chữ trên các trang ảnh của một tệp PDF.
 *
 * Trả về từng trang riêng để giao diện ghép lại có đánh số trang — giáo viên
 * cần biết câu chữ lấy từ trang nào của sách.
 */
export async function ocrPdf(file: File, opt: TuyChonOCR = {}): Promise<TrangOCR[]> {
  const bao = opt.onProgress ?? (() => {});
  const ds = opt.nguon ? [opt.nguon] : NGUON_MAC_DINH;

  bao({ trang: 0, tong: 0, viec: "Đang mở tệp PDF…", phan: 0 });
  const pdfjs = await napPdfjs(opt.workerPdf);
  const tacVuNap = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await tacVuNap.promise;

  const tu = Math.max(1, Math.min(opt.tuTrang ?? 1, pdf.numPages));
  const den = Math.max(tu, Math.min(opt.denTrang ?? pdf.numPages, pdf.numPages, tu + TOI_DA_TRANG - 1));
  const tong = den - tu + 1;

  bao({ trang: 0, tong, viec: "Đang tải bộ nhận dạng chữ tiếng Việt…", phan: 0 });
  const { T, nguon } = await napTesseract(ds);
  huy(opt.signal);

  /* vie.traineddata đã gồm đủ chữ cái Latin và chữ số, nên một ngôn ngữ là đủ;
     thêm "eng" chỉ tải thêm vài MB mà không đọc đúng hơn tiếng Việt. */
  const worker = await T.createWorker("vie", 1, {
    workerPath: nguon.worker,
    corePath: nguon.loi,
    langPath: nguon.ngonNgu,
    /* Trình duyệt nhớ lại tệp ngôn ngữ trong IndexedDB, nên lần sau nhanh hơn
       hẳn. Đây là mặc định của thư viện, ghi ra cho rõ ý. */
    cacheMethod: "write",
  });

  const ketQua: TrangOCR[] = [];
  try {
    for (let i = tu; i <= den; i++) {
      huy(opt.signal);
      const daXong = i - tu;
      bao({ trang: i, tong, viec: `Đang vẽ trang ${i} thành ảnh…`, phan: daXong / tong });

      const page = await pdf.getPage(i);
      const view = page.getViewport({ scale: PHONG });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(view.width);
      canvas.height = Math.ceil(view.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Trình duyệt không cho vẽ ảnh (canvas).");
      /* Nền TRẮNG: trang PDF vốn trong suốt, để nguyên thì canvas nền đen và
         Tesseract đọc ra một trang trắng tinh không chữ nào. */
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      /* Bỏ được `as any` từ v6: `canvas` nay là trường chính thức của
         RenderParameters (v5 chưa có nên phải ép kiểu). Bỏ ép kiểu đi thì
         TypeScript mới thật sự kiểm được lời gọi này ở những lần nâng cấp sau. */
      await page.render({ canvasContext: ctx, viewport: view, canvas }).promise;
      page.cleanup();

      huy(opt.signal);
      bao({ trang: i, tong, viec: `Đang nhận dạng chữ trang ${i}…`, phan: (daXong + 0.45) / tong });
      const kq = await worker.recognize(canvas);
      ketQua.push({ trang: i, text: String(kq?.data?.text ?? "").trim() });

      canvas.width = 0;
      canvas.height = 0;
      bao({ trang: i, tong, viec: `Xong trang ${i}/${den}.`, phan: (daXong + 1) / tong });
    }
  } finally {
    try { await worker.terminate(); } catch { /* đóng được thì tốt, không thì thôi */ }
    try { await tacVuNap.destroy(); } catch { /* nt */ }
  }
  return ketQua;
}

/** Ghép các trang thành một khối văn bản có đánh số trang. */
export function ghepTrang(ds: TrangOCR[]): string {
  return ds
    .filter((t) => t.text.trim())
    .map((t) => `--- Trang ${t.trang} ---\n${t.text.trim()}`)
    .join("\n\n");
}

/**
 * OCR có đọc ra gì không? Dưới ngưỡng này coi như trang trắng / ảnh mờ quá.
 *
 * 25 ký tự (không tính dấu cách): trang trắng thường chỉ cho ra vài ký tự nhiễu,
 * còn MỘT dòng đề bài đã vượt xa. Ban đầu tôi để 40 và chính câu "Cho hàm số
 * y = f(x) xác định trên khoảng K." — 34 ký tự — bị coi là không đọc được.
 */
export function coChuKhong(ds: TrangOCR[]): boolean {
  return ds.reduce((n, t) => n + t.text.replace(/\s/g, "").length, 0) >= 25;
}
