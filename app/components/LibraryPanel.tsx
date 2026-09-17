"use client";
/**
 * app/components/LibraryPanel.tsx — Danh sách bài giảng đã lưu
 *
 * DỜI NGUYÊN VĂN khỏi app/page.tsx ở V12.12, không sửa một dòng logic nào.
 * Trước đây nó nằm lọt ngay đầu page.tsx, phía trên component chính, nên ai mở
 * tệp ra cũng phải lướt qua 70 dòng không liên quan mới tới phần chính.
 *
 * Trạng thái của thư viện (library, activeId, confirmDelete) VẪN Ở LẠI
 * page.tsx, cố ý. Khác với nhóm OCR, chúng đan vào vòng đời trình biên tập:
 * setActiveId() được gọi từ bảy chỗ khác nhau — tự lưu, xoá trắng, sinh bài
 * mới, mở tệp JSON… Gỡ chúng ra là một việc riêng, cần làm cẩn thận và kiểm
 * thử riêng, không nên làm ké trong một đợt dọn dẹp.
 */

import type { LibraryMeta } from "@/lib/library";

/** "19/04 lúc 15:32" — đủ để phân biệt các lần sửa trong cùng một tuần. */
function whenLabel(ms: number): string {
  if (!ms) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    }).format(new Date(ms)).replace(", ", " lúc ");
  } catch {
    return "—";
  }
}

/**
 * Danh sách bài giảng đã lưu trong trình duyệt.
 *
 * Dùng ở hai chỗ với cùng một mã: bảng thả xuống trong trình biên tập và khối
 * "mở lại bài cũ" ở màn hình khởi đầu. Nhờ vậy hai nơi không bao giờ lệch nhau.
 */
export function LibraryPanel({
  items, activeId, confirmDelete, onOpen, onCopy, onAskDelete, onDelete, onCancelDelete, onClose,
}: {
  items: LibraryMeta[];
  activeId: string | null;
  confirmDelete: string | null;
  onOpen: (id: string) => void;
  onCopy: (id: string) => void;
  onAskDelete: (id: string) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="library-panel">
      <div className="library-head">
        <b>Thư viện bài giảng · {items.length} bài</b>
        {onClose && <button className="ghost" onClick={onClose}>Đóng</button>}
      </div>

      {!items.length ? (
        <p className="library-empty">
          Chưa có bài nào. Mỗi bài bạn tạo hoặc nạp từ JSON sẽ tự động vào đây, không cần bấm lưu.
        </p>
      ) : (
        <ul className="library-list">
          {items.map((m) => (
            <li key={m.id} className={m.id === activeId ? "active" : ""}>
              <div className="library-info">
                <b>{m.title}</b>
                <small>
                  {[m.grade, m.book].filter(Boolean).join(" · ")}
                  {m.grade || m.book ? " · " : ""}
                  {m.slides} slide · {m.visuals} hình · sửa {whenLabel(m.updatedAt)}
                </small>
              </div>
              <div className="library-actions">
                {m.id === activeId
                  ? <span className="library-now">● Đang mở</span>
                  : <button className="open" onClick={() => onOpen(m.id)}>Mở</button>}
                <button className="ghost" onClick={() => onCopy(m.id)}>Nhân bản</button>
                {confirmDelete === m.id ? (
                  <>
                    <button className="danger" onClick={() => onDelete(m.id)}>Xoá hẳn</button>
                    <button className="ghost" onClick={onCancelDelete}>Không</button>
                  </>
                ) : (
                  <button className="ghost" onClick={() => onAskDelete(m.id)}>Xoá</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="library-note">
        Thư viện nằm trong trình duyệt này, trên máy này — xoá dữ liệu duyệt web, dùng cửa sổ ẩn danh
        hoặc đổi sang máy khác là không còn. Bài nào cần giữ lâu dài, hãy bấm <b>Lưu JSON</b> để có
        tệp trên ổ đĩa.
      </p>
    </div>
  );
}
