"use client";
/**
 * app/components/KhungOcr.tsx — Khung "PDF ảnh quét" (tách khỏi app/page.tsx ở V12.12)
 *
 * Đi kèm app/hooks/useOcr.ts. Tách CẢ giao diện chứ không chỉ phần logic: để
 * sửa tính năng OCR chỉ phải mở hai tệp nhỏ này, không phải cuộn qua 1600 dòng
 * của trang chính. Đây là phần khó đọc nhất của page.tsx cũ — nó nằm lọt giữa
 * phần nhập tài liệu và phần mở tệp JSON, chẳng liên quan gì tới hai phần đó.
 *
 * Component này KHÔNG giữ trạng thái nào: mọi thứ do useOcr() cấp. Nhờ vậy
 * không thể có chuyện hai nơi cùng nhớ một việc rồi lệch nhau.
 */

import type { useOcr } from "../hooks/useOcr";

export function KhungOcr({ ocr, busy }: { ocr: ReturnType<typeof useOcr>; busy: boolean }) {
  return (
    <>

          {/* PDF ẢNH QUÉT — V12.3.
              Sách giáo khoa scan không có sẵn chữ để lấy. Trước đây phần mềm
              chỉ báo "hãy dùng OCR trước" rồi bỏ đấy; nay mời thầy đọc ngay
              tại chỗ. Toàn bộ chạy trong trình duyệt, sách không rời máy. */}
          {ocr.choOcr.map((muc, i) => (
            <div className="ocr-box" key={`${muc.file.name}-${i}`}>
              <strong>📄 {muc.file.name} là PDF ảnh quét</strong>
              <p>
                Tệp này là ảnh chụp/scan nên không có sẵn chữ để lấy. Phần mềm đọc được bằng{" "}
                <b>OCR</b> — nhận dạng chữ trên ảnh — <b>ngay trong máy thầy</b>, không gửi sách đi đâu cả.
              </p>
              <p className="ocr-chu-y">
                Hai điều cần biết trước: đọc <b>chậm</b> — một trang sách kín chữ mất khoảng{" "}
                <b>5–10 giây</b>, tức 20 trang chừng 2–3 phút; và <b>công thức Toán sẽ đọc sai</b> —
                phân số, căn, chỉ số trên dưới đều hỏng. Phần lời văn (định nghĩa, đề bài, chú ý) thì
                đọc tốt, đủ để AI biết bài học nói về cái gì.
              </p>
              {ocr.tienDo ? (
                <div className="ocr-tiendo">
                  <div className="ocr-thanh"><i style={{ width: `${Math.round(ocr.tienDo.phan * 100)}%` }} /></div>
                  <span>{ocr.tienDo.viec}</span>
                  <button type="button" className="ocr-dung" onClick={ocr.dungLai}>
                    ✕ Dừng
                  </button>
                </div>
              ) : (
                <>
                  <div className="ocr-trang">
                    <label>
                      Đọc từ trang
                      <input type="number" min={1} max={muc.soTrang || undefined} value={ocr.tuTrang}
                             onChange={(e) => ocr.setTuTrang(Math.max(1, Number(e.target.value) || 1))} />
                    </label>
                    <label>
                      đến trang
                      <input type="number" min={1} max={muc.soTrang || undefined} value={ocr.denTrang}
                             onChange={(e) => ocr.setDenTrang(Math.max(1, Number(e.target.value) || 1))} />
                    </label>
                    <span className="ocr-ghi">
                      {muc.soTrang ? `Tệp có ${muc.soTrang} trang. ` : ""}
                      Mỗi lần đọc tối đa {ocr.toiDaTrang} trang — chọn đúng bài cần soạn thì nhanh hơn nhiều.
                    </span>
                  </div>
                  <div className="ocr-nut">
                    <button type="button" className="ocr-chay" onClick={() => ocr.chay(muc)} disabled={busy}>
                      🔍 Đọc bằng OCR
                    </button>
                    <button type="button" className="ocr-bo"
                            onClick={() => ocr.boQua(muc.file)}>
                      Bỏ qua tệp này
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}


    </>
  );
}
