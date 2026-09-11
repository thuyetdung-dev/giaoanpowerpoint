import type { NextConfig } from "next";

/**
 * next.config.ts (V11)
 *
 * pptxgenjs và pdfjs tham chiếu một số module chỉ có trên Node (fs, https, ...).
 * Khi đóng gói cho trình duyệt phải vô hiệu hoá chúng — kể cả dạng có tiền tố
 * "node:" mà `resolve.fallback` không bắt được (phải dùng alias).
 */
const nodeOnlyModules = ["fs", "https", "http", "crypto", "stream", "path", "os", "zlib"];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        ...Object.fromEntries(nodeOnlyModules.map((m) => [m, false])),
      };
      // pptxgenjs có `import("node:fs")` để ghi tệp khi chạy trên Node. Webpack
      // không hiểu lược đồ "node:" nên phải bỏ tiền tố rồi để fallback:false
      // biến chúng thành module rỗng trong bản dựng cho trình duyệt.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
