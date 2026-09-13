import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./key-panel.css";
import "./bbt.css";
import "./features.css";
import "./reference.css";
import "./v9-layout.css";
import "./v11.css";
import "./slide.css";
import { APP_LABEL } from "@/lib/version";

export const metadata: Metadata = {
  title: `Trợ lý soạn PowerPoint Toán THPT — ${APP_LABEL}`,
  description:
    "Soạn bài giảng PowerPoint môn Toán THPT theo Chương trình GDPT 2018: bảng biến thiên, bảng xét dấu, đồ thị, thống kê, xác suất, hình không gian, Oxyz và slide tương tác.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/**
 * suppressHydrationWarning trên thẻ <html>: một số tiện ích Chrome (ví dụ
 * Material Design Lite) chèn class "mdl-js" vào <html> TRƯỚC khi React gắn kết,
 * nên console báo lệch HTML giữa máy chủ và máy khách. Cảnh báo này vô hại
 * nhưng lấp mất các lỗi thật, nên tắt riêng ở đúng thẻ bị ảnh hưởng.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
