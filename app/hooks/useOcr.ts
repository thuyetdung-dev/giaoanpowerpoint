"use client";
/**
 * app/hooks/useOcr.ts — Đọc PDF ảnh quét bằng OCR (tách khỏi app/page.tsx ở V12.12)
 *
 * VÌ SAO TÁCH. app/page.tsx đang 1630 dòng và 51 hook trong MỘT component. Mỗi
 * lần sửa một tính năng nhỏ đều phải cuộn qua toàn bộ phần còn lại, và không ai
 * kiểm thử được riêng phần nào. Nhóm OCR là chỗ dễ tách nhất: bốn ô trạng thái
 * của nó chỉ liên quan với nhau, không dính vào phần biên tập slide.
 *
 * CÁCH NÓ NỐI VỚI PHẦN CÒN LẠI. Hook này KHÔNG tự biết gì về `documents` hay
 * `message` của trang — nó nhận hai hàm gọi ngược. Nhờ vậy nó không kéo theo
 * phần còn lại của trang vào, và sau này kiểm thử được mà không cần dựng cả
 * giao diện.
 *
 * KHÔNG ĐỔI HÀNH VI. Đây là một lần dọn dẹp thuần tuý: từng dòng logic được
 * bê nguyên từ page.tsx sang, kể cả lời văn các thông báo. Nếu có gì đó chạy
 * khác đi so với trước, đó là LỖI của lần tách này chứ không phải cải tiến.
 */

import { useRef, useState } from "react";
import { docTuOCR, type SourceDoc } from "@/lib/importer";
import { coChuKhong, ghepTrang, ocrPdf, TOI_DA_TRANG, type TienDoOCR } from "@/lib/ocr";

export type MucCanOcr = { file: File; soTrang: number };

export function useOcr(opts: {
  /** Hiện một dòng thông báo cho giáo viên (trang sở hữu ô thông báo này). */
  baoTin: (s: string) => void;
  /** Giao tài liệu vừa đọc xong về cho trang, để nhập vào danh sách nguồn. */
  nhanTaiLieu: (doc: SourceDoc) => void;
}) {
  const [choOcr, setChoOcr] = useState<MucCanOcr[]>([]);
  const [tuTrang, setTuTrang] = useState(1);
  const [denTrang, setDenTrang] = useState(20);
  const [tienDo, setTienDo] = useState<TienDoOCR | null>(null);
  /* Giữ trong ref chứ không phải state: bấm Dừng phải có tác dụng NGAY, không
     đợi vòng dựng lại giao diện kế tiếp. */
  const dieuKhienDung = useRef<AbortController | null>(null);

  /** Nhận thêm các tệp PDF ảnh quét mà bước nhập tài liệu không đọc được. */
  function themCanOcr(ds: MucCanOcr[]) {
    if (!ds.length) return;
    setChoOcr((x) => [...x, ...ds]);
    setDenTrang(Math.min(20, ds[0].soTrang || 20));
  }

  function dungLai() {
    dieuKhienDung.current?.abort();
  }

  /** Thầy quyết định không đọc tệp này nữa — bỏ khỏi danh sách chờ. */
  function boQua(file: File) {
    setChoOcr((x) => x.filter((m) => m.file !== file));
  }

  /**
   * Chạy hẳn trong trình duyệt của thầy: sách không rời khỏi máy. Chậm, nên có
   * thanh tiến độ và nút Dừng — một quyển SGK 250 trang mà không dừng được thì
   * bấm nhầm là ngồi chờ mười lăm phút.
   */
  async function chay(muc: MucCanOcr) {
    const tu = Math.max(1, Math.min(tuTrang, muc.soTrang || tuTrang));
    const den = Math.max(tu, Math.min(denTrang, muc.soTrang || denTrang, tu + TOI_DA_TRANG - 1));
    const dieuKhien = new AbortController();
    dieuKhienDung.current = dieuKhien;
    setTienDo({ trang: 0, tong: den - tu + 1, viec: "Đang chuẩn bị…", phan: 0 });
    try {
      const trangDoc = await ocrPdf(muc.file, {
        tuTrang: tu, denTrang: den, signal: dieuKhien.signal,
        onProgress: (t) => setTienDo(t),
      });
      if (!coChuKhong(trangDoc)) {
        opts.baoTin(
          `Đọc xong nhưng không thấy chữ nào trong trang ${tu}–${den} của ${muc.file.name}. ` +
            "Thường là do trang ảnh quá mờ, hoặc đoạn đó chỉ có hình. Thử chọn khoảng trang khác.",
        );
        return;
      }
      const doc = docTuOCR(muc.file, ghepTrang(trangDoc), tu, den);
      opts.nhanTaiLieu(doc);
      setChoOcr((x) => x.filter((m) => m.file !== muc.file));
      opts.baoTin(
        `Đã đọc ${trangDoc.length} trang của ${muc.file.name} bằng OCR ` +
          `(${doc.text.length.toLocaleString("vi-VN")} ký tự). Nhớ rằng công thức Toán trong đó có thể sai.`,
      );
    } catch (e) {
      opts.baoTin(
        dieuKhien.signal.aborted
          ? "Đã dừng đọc OCR. Phần đã đọc không được giữ lại."
          : `Không đọc được bằng OCR: ${e instanceof Error ? e.message : "lỗi không xác định"}`,
      );
    } finally {
      dieuKhienDung.current = null;
      setTienDo(null);
    }
  }

  /* Trả kèm TOI_DA_TRANG để giao diện khỏi phải tự import lib/ocr: cả nhóm OCR
     chỉ còn MỘT cửa nối với trang, muốn đổi trần số trang chỉ sửa một nơi. */
  return {
    choOcr, themCanOcr, boQua,
    tuTrang, setTuTrang, denTrang, setDenTrang,
    tienDo, chay, dungLai,
    toiDaTrang: TOI_DA_TRANG,
  };
}
