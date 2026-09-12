/**
 * scripts/shoot-editor.mjs — Chụp ảnh TRÌNH BIÊN TẬP để kiểm tra bằng mắt.
 *
 * Vì sao cần: các thay đổi về giao diện (danh sách slide, ô sửa toàn màn hình,
 * ô hướng dẫn dữ liệu hình) không có cách nào kiểm bằng kiểu dữ liệu hay bằng
 * unit test. Cách duy nhất đáng tin là mở trang thật rồi xem ảnh.
 *
 * Chạy:
 *   npm run build && npx next start -p 3123 &
 *   node scripts/shoot-editor.mjs
 * Ảnh lưu vào .measure/ui-*.png
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { LESSON } from "./lesson-bai4.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:3123";
const OUT = new URL("../.measure/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on("console", (m) => m.type() === "error" && console.log("  [lỗi trình duyệt]", m.text()));
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

// Nạp bài mẫu qua localStorage, đúng như thư viện của ứng dụng ghi.
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.evaluate((lesson) => {
  const P = "lessonstudio.v11.";
  const id = "lsdemo";
  localStorage.setItem(`${P}lib.item.${id}`, JSON.stringify({ form: { teacher: "Hồ Thuyết Dũng", school: "THPT PHAN ĐĂNG LƯU" }, lesson }));
  localStorage.setItem(`${P}lib.index`, JSON.stringify([{ id, title: lesson.title, grade: "12", book: "Kết nối tri thức", slides: lesson.sections.length, visuals: 9, updatedAt: Date.now() }]));
  localStorage.setItem(`${P}lib.active`, id);
}, LESSON);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".editor-grid", { timeout: 15000 });
await page.waitForTimeout(600);

const shot = async (name, locator) => {
  const target = locator ? page.locator(locator).first() : page;
  await target.screenshot({ path: new URL(`ui-${name}.png`, OUT).pathname });
  console.log(`  đã chụp ui-${name}.png`);
};

/* 1. Toàn trang: danh sách từng slide + ô thống kê */
await shot("1-tong-quan");

const soDongDanhSach = await page.locator(".slide-list > button").count();
const soSlide = Number((await page.locator(".list-head h3").innerText()).replace(/\D+/g, ""));
console.log(`\nDanh sách bên trái: ${soDongDanhSach} dòng · tiêu đề ghi ${soSlide} slide`);
if (soDongDanhSach !== soSlide) throw new Error("Danh sách KHÔNG liệt kê đủ mọi slide của bản xuất.");
if (await page.locator("button", { hasText: "Xem thử 10 slide" }).count())
  throw new Error('Nút "Xem thử 10 slide" vẫn còn.');

/* 2. Danh sách theo mục */
await page.locator(".list-switch button", { hasText: "Theo mục" }).click();
await page.waitForTimeout(200);
await shot("2-theo-muc", ".slide-list");
await page.locator(".list-switch button", { hasText: "Từng slide" }).click();
await page.waitForTimeout(200);
await shot("3-tung-slide", ".slide-list");

/* 3. Bấm một slide "(tiếp)" — thứ V11.8 không mở ra được */
const cont = page.locator(".slide-list > button.cont").first();
if (!(await cont.count())) throw new Error("Bài mẫu không có slide (tiếp) nào để kiểm.");
await cont.click();
await page.waitForTimeout(400);
await shot("4-slide-tiep", ".slide-canvas");
console.log("  vị trí hiện:", (await page.locator(".canvas-head .pos").innerText()).replace(/\s+/g, " "));

/* 3b. Slide phần mềm tự dựng: bốn nút tác động lên cả mục phải bị chặn */
await page.locator(".slide-list > button.auto").first().click();
await page.waitForTimeout(300);
for (const chu of ["LÊN", "XUỐNG", "NHÂN BẢN", "XOÁ MỤC", "SỬA SLIDE"]) {
  const nut = page.locator(".canvas-head button", { hasText: chu }).first();
  if (!(await nut.isDisabled())) throw new Error(`Ở slide tự dựng, nút "${chu}" vẫn bấm được.`);
}
await shot("4b-slide-tu-dung", ".slide-canvas");
console.log("  slide tự dựng: bốn nút sửa mục và nút SỬA SLIDE đều bị chặn.");

/* 4. Ô thống kê bấm được */
for (const [ten, chu] of [["5-chi-tiet-goi-y", "gợi ý sư phạm"], ["6-chi-tiet-slide", "slide khi xuất"], ["7-chi-tiet-hinh", "hình Toán"]]) {
  const chip = page.locator(".quality-summary .chip", { hasText: chu }).first();
  if (!(await chip.count())) { console.log(`  (không có ô "${chu}" trong bài mẫu)`); continue; }
  await chip.click();
  await page.waitForSelector(".detail-panel", { timeout: 3000 });
  await page.waitForTimeout(200);
  await shot(ten, ".detail-panel");
  await chip.click();
}

/* 5. Ô sửa toàn màn hình */
await page.locator(".slide-list > button:not(.auto)").first().click();
await page.waitForTimeout(300);
await page.locator(".canvas-head button.edit").click();
await page.waitForSelector(".edit-full", { timeout: 3000 });
await page.waitForTimeout(400);
await shot("8-sua-toan-man-hinh");

/* 6. Ô dữ liệu hình + ô hướng dẫn */
const suaDuLieu = page.locator(".ef-visuals .visual-row button", { hasText: "SỬA DỮ LIỆU" }).first();
if (await suaDuLieu.count()) {
  await suaDuLieu.click();
  await page.waitForSelector(".ve-guide", { timeout: 3000 });
  await page.waitForTimeout(300);
  await shot("9-huong-dan-du-lieu", ".visual-editor");

  /* 7. Gõ sai JSON thì phải báo bằng tiếng Việt và chặn nút Áp dụng */
  const o = page.locator(".ve-body textarea");
  await o.fill('{\n  "type": "graph",\n  "expression": "x^2",\n}');
  await page.waitForTimeout(300);
  const loi = await page.locator(".ve-error").innerText();
  const chan = await page.locator(".ve-actions .done").isDisabled();
  console.log(`\nJSON sai -> báo: ${loi}`);
  console.log(`Nút "Áp dụng" bị chặn: ${chan}`);
  if (!chan) throw new Error("JSON sai mà nút Áp dụng vẫn bấm được.");
  await shot("10-bao-loi-json", ".visual-editor");

  /* 8. Nút chèn mẫu phải cho ra dữ liệu đọc được */
  await page.locator(".ve-actions button", { hasText: "Chèn mẫu" }).click();
  await page.waitForTimeout(300);
  const okLai = await page.locator(".ve-actions .done").isDisabled();
  if (okLai) throw new Error("Chèn mẫu xong mà dữ liệu vẫn báo sai.");
  console.log("Chèn mẫu -> dữ liệu đọc được, nút Áp dụng mở lại.");
}

/* 9. Esc đóng ô sửa */
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
if (await page.locator(".edit-full").count()) throw new Error("Esc không đóng được ô sửa toàn màn hình.");
console.log("Esc đóng được ô sửa toàn màn hình.");

/* 10. V12.0 — Nút "Khảo sát hàm số": nhập một dòng, ra đủ ba slide */
await page.locator(".export-actions .khaosat-btn").click();
await page.waitForSelector(".khaosat-box", { timeout: 3000 });
const truocKS = await page.locator(".slide-list > button").count();
await page.locator(".khaosat-box input").fill("(x^2+2*x-2)/(x-1)");
await shot("11-o-khao-sat", ".detail-panel");
await page.locator(".khaosat-box .khaosat").click();
await page.waitForTimeout(900);
const sauKS = await page.locator(".slide-list > button").count();
console.log(`\nKhảo sát hàm số: danh sách từ ${truocKS} lên ${sauKS} slide`);
if (sauKS <= truocKS) throw new Error("Bấm Khảo sát hàm số mà không thêm được slide nào.");
await shot("12-khao-sat-ket-qua");
/* Ba slide vừa dựng: xem lần lượt để chắc chắn hình vẽ ra đúng */
const dsSlide = page.locator(".slide-list > button:not(.auto)");
const tong = await dsSlide.count();
for (const [ten, lui] of [["13-ks-dao-ham", 3], ["14-ks-bang-bien-thien", 2], ["15-ks-do-thi", 1]]) {
  await dsSlide.nth(tong - lui).click();
  await page.waitForTimeout(400);
  await shot(ten, ".slide-canvas");
}

await browser.close();
console.log("\n✓ Mọi phép kiểm giao diện đều đạt. Ảnh nằm trong .measure/");
