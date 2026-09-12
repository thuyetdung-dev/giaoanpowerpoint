#!/usr/bin/env python3
"""scripts/check-pptx.py — Mở tệp .pptx và kiểm tra cỡ chữ từng slide.

Đây là bước nghiệm thu cuối cùng của V11.6. Quy tắc:
  * Chữ NỘI DUNG (những gì học sinh phải đọc) phải từ 32 pt trở lên.
  * Chữ TRANG TRÍ (chân slide, số trang, nhãn hình, chữ nhỏ trên bìa) được phép
    nhỏ hơn — liệt kê riêng ở cuối để đối chiếu, không tính là lỗi.
  * Không khối chữ nào được tràn ra ngoài khung của nó.

Chạy:  python3 scripts/check-pptx.py .measure/bai_giang_V11_6.pptx
"""

import sys
from collections import Counter

from pptx import Presentation
from pptx.util import Emu

NGUONG = 32.0

# Những chuỗi này là chữ trang trí: không phải nội dung bài học.
TRANG_TRI_CHINH_XAC = {
    "LessonStudio V11",
    "BÀI GIẢNG MÔN TOÁN · THPT",
    "NỘI DUNG TRỌNG TÂM",
    "Tiếp theo phần trước",
}
TRANG_TRI_BAT_DAU = (
    "Toán · Lớp",
    "Toán  |  Lớp",
    "Giáo viên:",
    "THPT ",
    "Từ khoá:",
)
# Nhãn loại hình ("BẢNG BIẾN THIÊN", "ĐỒ THỊ HÀM SỐ"…) và pha hoạt động in hoa
# trong ô nhỏ ở góc phải cũng là chữ trang trí.
NHAN_HINH = {
    "CÔNG THỨC", "BẢNG BIẾN THIÊN", "BẢNG XÉT DẤU", "ĐỒ THỊ HÀM SỐ", "BIỂU ĐỒ THỐNG KÊ",
    "BIỂU ĐỒ HỘP", "SƠ ĐỒ CÂY XÁC SUẤT", "ĐƯỜNG TRÒN LƯỢNG GIÁC", "TRỤC SỐ",
    "MIỀN NGHIỆM", "HÌNH KHÔNG GIAN", "HỆ TRỤC OXYZ", "VECTƠ", "BIỂU ĐỒ VEN",
    "BẢNG SỐ LIỆU", "CÂU HỎI TƯƠNG TÁC", "HÌNH MINH HOẠ",
    "KHỞI ĐỘNG", "KHÁM PHÁ", "KIẾN THỨC MỚI", "VÍ DỤ MẪU", "LUYỆN TẬP",
    "VẬN DỤNG", "CỦNG CỐ",
}


def la_trang_tri(text: str, shape) -> bool:
    t = text.strip()
    if t in TRANG_TRI_CHINH_XAC or t in NHAN_HINH:
        return True
    if any(t.startswith(p) for p in TRANG_TRI_BAT_DAU):
        return True
    # Số trang "01".."99"
    if len(t) <= 2 and t.isdigit():
        return True
    # Ô rất thấp (< 0,3 in) chỉ chứa chữ trang trí
    if shape.height is not None and Emu(shape.height).inches < 0.3:
        return True
    return False


def main(path: str) -> int:
    prs = Presentation(path)
    loi = []
    trang_tri = Counter()
    noi_dung = Counter()
    tran_khung = []

    for i, slide in enumerate(prs.slides, 1):
        for sh in slide.shapes:
            if not sh.has_text_frame:
                continue
            text = sh.text_frame.text.strip()
            if not text:
                continue
            sizes = [r.font.size.pt for p in sh.text_frame.paragraphs for r in p.runs if r.font.size]
            if not sizes:
                continue
            nho_nhat = min(sizes)
            if la_trang_tri(text, sh):
                trang_tri[nho_nhat] += 1
                continue
            noi_dung[nho_nhat] += 1
            if nho_nhat < NGUONG - 0.01:
                loi.append((i, nho_nhat, text[:60].replace("\n", " / ")))

            # tràn khung: ước lượng số dòng so với chiều cao ô
            w_in = Emu(sh.width).inches
            h_in = Emu(sh.height).inches
            n_para = len([p for p in sh.text_frame.paragraphs if p.text.strip()])
            per_line = max(6, int(w_in * 72 / (nho_nhat * 0.52)))
            lines = sum(max(1, -(-len(p.text) // per_line)) for p in sh.text_frame.paragraphs if p.text.strip())
            can = (lines * nho_nhat * 1.38 + (n_para - 1) * 10) / 72
            if can > h_in * 1.02:
                tran_khung.append((i, text[:40].replace("\n", " / "), round(can, 2), round(h_in, 2)))

    print(f"\nTỆP: {path}")
    print(f"Tổng số slide: {len(prs.slides)}\n")

    print("CỠ CHỮ NỘI DUNG (phần học sinh phải đọc)")
    for pt in sorted(noi_dung):
        dat = "ĐẠT" if pt >= NGUONG - 0.01 else "CHƯA ĐẠT"
        print(f"  {pt:>5.1f} pt  ×{noi_dung[pt]:>3}   {dat}")

    print("\nCỠ CHỮ TRANG TRÍ (chân slide, số trang, nhãn hình — không tính)")
    for pt in sorted(trang_tri):
        print(f"  {pt:>5.1f} pt  ×{trang_tri[pt]:>3}")

    if loi:
        print(f"\n✗ {len(loi)} khối chữ nội dung dưới {NGUONG:.0f} pt:")
        for s, pt, t in loi:
            print(f"   slide {s:>2}  {pt:>5.1f} pt  “{t}”")
    else:
        print(f"\n✓ Mọi chữ nội dung đều từ {NGUONG:.0f} pt trở lên.")

    if tran_khung:
        print(f"\n✗ {len(tran_khung)} khối chữ có nguy cơ tràn khung:")
        for s, t, can, co in tran_khung:
            print(f"   slide {s:>2}  cần {can} in, khung cao {co} in  “{t}”")
    else:
        print("✓ Không khối chữ nào tràn khung.")

    return 1 if (loi or tran_khung) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else ".measure/bai_giang_V11_6.pptx"))
