"use client";
/**
 * components/AccountBadge.tsx — Ai đang đăng nhập + nút Đăng xuất (V12.11)
 *
 * VÌ SAO LÀ MỘT COMPONENT NHỎ GẮN Ở LAYOUT, KHÔNG SỬA app/page.tsx.
 * app/page.tsx đã 1630 dòng và 51 hook. Chèn thêm trạng thái vào đó là làm cho
 * tệp khó nhất trong dự án khó thêm một chút nữa, đổi lấy một cái nhãn. Gắn ở
 * layout thì trang soạn bài không phải biết gì về đăng nhập, và sau này tách
 * page.tsx ra cũng không vướng.
 *
 * Trên /login và /tao-tai-khoan, tuyến session trả 401 nên component tự ẩn —
 * không cần layout biết mình đang ở trang nào.
 */

import { useEffect, useState } from "react";

export function AccountBadge() {
  const [who, setWho] = useState<{ user: string; role: string } | null>(null);
  const [dangThoat, setDangThoat] = useState(false);

  useEffect(() => {
    let huy = false;
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!huy && d?.authenticated) setWho({ user: d.user, role: d.role });
      })
      .catch(() => {});
    return () => {
      huy = true;
    };
  }, []);

  if (!who) return null;

  async function thoat() {
    setDangThoat(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    /* Dùng location thay router: buộc tải lại hoàn toàn để middleware chạy lại
       và không còn mảnh nào của trang soạn bài nằm trong bộ nhớ trình duyệt. */
    window.location.href = "/login";
  }

  return (
    <div className="tk-nhan">
      <span title={who.role === "admin" ? "Quản trị" : "Giáo viên"}>
        {who.role === "admin" ? "🧑‍💼" : "👩‍🏫"} {who.user}
      </span>
      <button type="button" onClick={thoat} disabled={dangThoat}>
        {dangThoat ? "…" : "Đăng xuất"}
      </button>
    </div>
  );
}
