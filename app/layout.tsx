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

export const metadata: Metadata = {
  title: "Trợ lý soạn PowerPoint Toán THPT — LessonStudio V11",
  description:
    "Soạn bài giảng PowerPoint môn Toán THPT theo Chương trình GDPT 2018: bảng biến thiên, bảng xét dấu, đồ thị, thống kê, xác suất, hình không gian, Oxyz và slide tương tác.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
