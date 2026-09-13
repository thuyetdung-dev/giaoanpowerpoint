export type SourceDoc = { name: string; size: number; text: string; kind: string };

/**
 * PDF ẢNH QUÉT — báo riêng, không lẫn vào lỗi thường (V12.3).
 *
 * Trước V12.3, gặp sách giáo khoa scan thì phần mềm chỉ nói "không có văn bản
 * có thể trích xuất, nếu là PDF ảnh quét hãy dùng OCR trước" rồi bỏ đấy — tức
 * là đẩy việc khó sang cho giáo viên. Nay đây là một tình huống CÓ LỐI ĐI:
 * giao diện bắt được lỗi này thì mời thầy đọc tệp bằng OCR ngay tại chỗ
 * (lib/ocr.ts). Vì vậy nó phải là một loại lỗi phân biệt được, chứ không phải
 * một câu chữ để so bằng regex.
 */
export class LoiCanOCR extends Error {
  readonly file: File;
  readonly soTrang: number;
  constructor(file: File, soTrang: number) {
    super(`${file.name} là PDF ảnh quét (không có sẵn chữ để lấy).`);
    this.name = "LoiCanOCR";
    this.file = file;
    this.soTrang = soTrang;
  }
}

/** Ngưỡng coi là "có chữ". Vài ký tự lạc trong 80 trang thì vẫn là ảnh quét. */
const IT_NHAT = 60;

export async function readSource(file: File): Promise<SourceDoc> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} vượt quá 20 MB.`);
  let text = "";
  let soTrang = 0;

  try {
    if (["txt", "md", "json"].includes(ext)) {
      text = await file.text();
      if (ext === "json") JSON.parse(text.replace(/^﻿/, ""));
    } else if (ext === "docx") {
      const mammoth = await import("mammoth/mammoth.browser");
      text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    } else if (ext === "pdf") {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      soTrang = pdf.numPages;
      const pages: string[] = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 80); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      }
      text = pages.join("\n");
      await pdf.destroy();
    } else {
      throw new Error(`Chưa hỗ trợ tệp .${ext}`);
    }
  } catch (error) {
    throw new Error(`Không đọc được ${file.name}: ${error instanceof Error ? error.message : "lỗi không xác định"}`);
  }

  if (ext === "pdf" && text.replace(/\s/g, "").length < IT_NHAT) throw new LoiCanOCR(file, soTrang);
  if (!text.trim()) throw new Error(`${file.name} không có văn bản nào để lấy.`);
  return { name: file.name, size: file.size, text: text.slice(0, 120000), kind: ext };
}

/** Dựng một tài liệu nguồn từ chữ đã nhận dạng được bằng OCR. */
export function docTuOCR(file: File, text: string, tuTrang: number, denTrang: number): SourceDoc {
  return {
    name: `${file.name} (OCR trang ${tuTrang}–${denTrang})`,
    size: file.size,
    text: text.slice(0, 120000),
    kind: "pdf-ocr",
  };
}
