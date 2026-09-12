/**
 * lib/plot.ts — Những thứ MỌI hình vẽ đều cần (V12.0)
 *
 * VÌ SAO PHẢI CÓ. Trước V12 mỗi loại hình tự lo phần trục của mình, nên chất
 * lượng chênh nhau rất xa: đồ thị hàm số có vạch chia, số trên trục, mũi tên
 * trục và nhãn O; còn miền nghiệm, vectơ mặt phẳng, Oxyz thì KHÔNG CÓ SỐ NÀO
 * trên trục. Một hình vectơ không có số trên trục thì không kiểm được
 * u = (3; 2) — nhìn vào chỉ thấy một mũi tên chéo.
 *
 * Gộp về một chỗ để sửa một lần là mọi hình tốt lên, và để không còn hình nào
 * bị bỏ lại phía sau.
 */

/**
 * Bước chia "đẹp" cho một khoảng: luôn là 1, 2 hoặc 5 nhân với luỹ thừa của 10.
 * Nhờ vậy dãy vạch chia luôn đọc được (0; 2; 4; 6) chứ không ra 0; 2,857; 5,714.
 */
export function niceStep(range: number, target = 8): number {
  if (!(range > 0) || !Number.isFinite(range)) return 1;
  const raw = range / Math.max(2, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
}

/**
 * Dãy vạch chia VỪA VỚI CHỖ CÓ THẬT.
 *
 * `ticksFor` chỉ biết khoảng giá trị, không biết trên hình còn bao nhiêu pixel.
 * Với miền [-3; 5] nó chọn bước 0,5 — ra 17 nhãn chen chúc thành một dãy chữ
 * "-3-2,5-2-1,5-1-0" không đọc được (đúng lỗi của hình vectơ bản đầu V12).
 * Hàm này nới bước chia lên (×2, ×2,5, ×2 …) cho tới khi các nhãn không chạm
 * nhau nữa, tính theo bề ngang chữ thật sự cần.
 */
export function ticksFit(min: number, max: number, pixels: number, fs: number, sole = true): number[] {
  let step = niceStep(max - min, 8);
  for (let lan = 0; lan < 8; lan++) {
    const n = Math.floor((max - min) / step) + 1;
    // Nhãn dài nhất trong dãy, cộng một khoảng trống bằng nửa chữ.
    const rongNhat = Math.max(
      beRongChu(soVN(min), fs), beRongChu(soVN(max), fs), beRongChu(soVN(step), fs),
    ) + fs * 0.5;
    if (n * rongNhat <= pixels || n <= 3) break;
    // Nhân luân phiên 2 rồi 2,5 để bước chia luôn còn là 1 / 2 / 5 × 10^k.
    const mag = Math.pow(10, Math.floor(Math.log10(step) + 1e-9));
    const norm = Math.round(step / mag);
    step = norm === 1 ? 2 * mag : norm === 2 ? 5 * mag : 10 * mag;
  }
  const out: number[] = [];
  for (let t = Math.ceil(min / step - 1e-9) * step; t <= max + 1e-9; t += step) {
    const val = Number(t.toFixed(6));
    if (sole || Math.abs(val) > 1e-9) out.push(val);
  }
  return out;
}

/**
 * Dãy vạch chia cho trục ĐỨNG: ở đây cái chen nhau là CHIỀU CAO dòng chữ, không
 * phải bề ngang. Truyền bề ngang vào `ticksFit` cho trục tung là so sai đại
 * lượng — miền [-1; 8] cao 340 px ra đúng một vạch duy nhất.
 */
export function ticksFitDoc(min: number, max: number, pixels: number, fs: number): number[] {
  let step = niceStep(max - min, 8);
  for (let lan = 0; lan < 8; lan++) {
    const n = Math.floor((max - min) / step) + 1;
    if (n * fs * 1.35 <= pixels || n <= 3) break;
    const mag = Math.pow(10, Math.floor(Math.log10(step) + 1e-9));
    const norm = Math.round(step / mag);
    step = norm === 1 ? 2 * mag : norm === 2 ? 5 * mag : 10 * mag;
  }
  const out: number[] = [];
  for (let t = Math.ceil(min / step - 1e-9) * step; t <= max + 1e-9; t += step) out.push(Number(t.toFixed(6)));
  return out;
}

/** Dãy vạch chia từ min đến max theo bước đẹp. */
export function ticksFor(min: number, max: number, target = 8): number[] {
  const step = niceStep(max - min, target);
  const out: number[] = [];
  for (let t = Math.ceil(min / step - 1e-9) * step; t <= max + 1e-9; t += step) {
    out.push(Number(t.toFixed(6)));
  }
  return out;
}

/**
 * Số viết theo cách Việt Nam: dấu PHẨY thập phân.
 *
 * Bản V11 in "5.5" và "8.5" lên biểu đồ hộp. Học sinh Việt Nam đọc dấu chấm là
 * dấu phân nhóm nghìn, nên "5.5" nhìn ra "năm nghìn năm" — sai ngay ở chỗ
 * không đáng sai. Tối đa 3 chữ số thập phân, và bỏ mọi số 0 vô nghĩa ở cuối.
 */
export function soVN(x: number, chuSoThapPhan = 3): string {
  if (!Number.isFinite(x)) return x > 0 ? "+∞" : x < 0 ? "-∞" : "";
  const s = Number(x.toFixed(chuSoThapPhan)).toString();
  return s.replace(".", ",");
}

/**
 * Bề ngang ƯỚC LƯỢNG của một chuỗi, tính theo cỡ chữ.
 *
 * Không đo được bề ngang thật trong lúc dựng SVG (chưa có trong trang), mà vẫn
 * cần biết để tránh chữ đè nhau. 0,54 là tỉ lệ trung bình của Times New Roman
 * đo trên chữ Việt có dấu; ước hơi thừa thì thà chừa rộng một chút.
 */
export function beRongChu(s: unknown, fs: number, heSo = 0.54): number {
  return String(s ?? "").length * fs * heSo;
}

/** Một ô chữ đã chiếm chỗ trên hình. Dùng để xếp nhãn tránh nhau. */
export type OChu = { x0: number; x1: number; y: number };

/** Hai ô chữ có chạm nhau không (theo chiều ngang và một dòng chữ theo chiều dọc). */
export function chamNhau(a: OChu, b: OChu, fs: number, heSoDoc = 1.05): boolean {
  return !(a.x1 < b.x0 || a.x0 > b.x1) && Math.abs(a.y - b.y) < fs * heSoDoc;
}

/**
 * Tìm chỗ đặt nhãn không chạm vào thứ gì đã có.
 *
 * Thử lần lượt các vị trí trong `thu` (theo đúng thứ tự ưu tiên), lấy vị trí
 * đầu tiên vừa nằm trong khung vừa không chạm ô nào trong `vatCan`. Hết cách
 * thì trả về vị trí đầu tiên — thà lệch một chút còn hơn không có nhãn.
 */
export function chonChoDat(
  thu: number[],
  o: { x0: number; x1: number },
  vatCan: OChu[],
  fs: number,
  trong: (y: number) => boolean,
): number {
  const found = thu.find((y) => trong(y) && !vatCan.some((c) => chamNhau({ ...o, y }, c, fs)));
  return found ?? thu[0];
}

/**
 * Mũi VECTƠ trên đầu tên: u⃗, AB⃗.
 *
 * Ký tự Unicode U+20D7 ghép sau chữ cái cho ra kết quả rất khác nhau tuỳ phông,
 * và phông Times New Roman dùng trong hình Toán thì vẽ lệch hẳn sang phải. Nên
 * ở đây tự vẽ một đoạn có mũi nhọn phía trên chữ, tính bề ngang theo số ký tự.
 * Trả về toạ độ đoạn thẳng để nơi gọi vẽ, chứ không trả về JSX — lib/ không
 * dùng React, và giữ như vậy thì bộ kiểm thử chạy được trong Node.
 */
export function neVecto(x: number, y: number, ten: string, fs: number, anchor: "start" | "middle" | "end" = "start") {
  const w = Math.max(fs * 0.5, beRongChu(ten, fs, 0.5));
  const x0 = anchor === "start" ? x : anchor === "middle" ? x - w / 2 : x - w;
  return { x1: x0, x2: x0 + w, y: y - fs * 0.92 };
}
