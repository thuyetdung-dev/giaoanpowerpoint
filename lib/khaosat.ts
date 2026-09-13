/**
 * lib/khaosat.ts — Nút "Khảo sát hàm số" (V12.0)
 *
 * VÌ SAO PHẢI CÓ. Để có một bài khảo sát hàm số, trước V12 giáo viên phải: gõ
 * đề cho AI, chờ, rồi soi lại tập xác định, đạo hàm, bảng biến thiên, tiệm cận
 * và đồ thị — mỗi thứ AI đều có thể làm sai. Mà cả năm thứ đó đều TÍNH ĐƯỢC từ
 * đúng một dòng: biểu thức hàm số.
 *
 * Nhập một dòng, phần mềm dựng cả bộ slide: tập xác định, đạo hàm viết thành
 * công thức, nghiệm y′ = 0, bảng biến thiên, tiệm cận, đồ thị có điểm cực trị.
 * Không có bước nào do AI đoán, nên không có bước nào cần soi lại.
 *
 * Nguyên tắc vẫn như cũ: chỗ nào không tính chắc được thì NÓI RA, không đoán.
 */

import { daoHam, sangLatex } from "./deriv";
import { latexToUnicode } from "./latex";
import { compileExpression, evalAt } from "./mathexpr";
import { solveVariationTable, vietSo } from "./bbtsolve";
import type { GraphVisual, Section, VariationVisual } from "./types";

export type KhaoSatResult = {
  ok: boolean;
  error?: string;
  /** Các slide dựng sẵn, nối thẳng vào lesson.sections. */
  sections: Section[];
  /** Những gì phần mềm đã làm, để ghi vào bảng "Đã sửa" cho thầy đối chiếu. */
  notes: string[];
  /** Những gì phần mềm KHÔNG tính chắc được. */
  chuaChac: string[];
};

/** Số "đẹp" gần đúng: 0,4999999 → 0,5; 2,0000001 → 2. */
function lamDep(x: number, eps = 1e-7): number {
  if (!Number.isFinite(x)) return x;
  if (Math.abs(x - Math.round(x)) < eps) return Math.round(x);
  for (const q of [2, 3, 4, 5, 6, 8, 10]) {
    const t = Math.round(x * q) / q;
    if (Math.abs(x - t) < eps) return t;
  }
  return x;
}

/**
 * Tiệm cận ngang hoặc xiên, tìm bằng giới hạn số học.
 *
 * a = lim f(x)/x khi x → ±∞. a = 0 thì có tiệm cận ngang y = lim f(x); a hữu
 * hạn khác 0 thì có tiệm cận xiên y = ax + b với b = lim (f(x) − ax).
 */
function tiemCanXaVoCuc(expr: string, phia: 1 | -1): { kind: "horizontal" | "oblique"; a: number; b: number } | null {
  const c = compileExpression(expr);
  if (!c.ok) return null;
  const X = 1e5 * phia, X2 = 1e6 * phia;
  const a1 = c.eval(X) / X, a2 = c.eval(X2) / X2;
  if (!Number.isFinite(a1) || !Number.isFinite(a2)) return null;
  if (Math.abs(a1 - a2) > 1e-3) return null;   // không tiến tới giới hạn
  const a = lamDep(a2, 1e-4);
  const b1 = c.eval(X) - a * X, b2 = c.eval(X2) - a * X2;
  if (!Number.isFinite(b2) || Math.abs(b1 - b2) > 1e-2) return null;
  const b = lamDep(b2, 1e-4);
  return Math.abs(a) < 1e-9 ? { kind: "horizontal", a: 0, b } : { kind: "oblique", a, b };
}

/** "y = 2x − 3" viết bằng LaTeX, bỏ hệ số 1 và hạng tử 0. */
function duongThang(a: number, b: number): string {
  if (Math.abs(a) < 1e-12) return `y = ${vietSo(b)}`;
  const heSo = Math.abs(a - 1) < 1e-12 ? "" : Math.abs(a + 1) < 1e-12 ? "-" : vietSo(a);
  if (Math.abs(b) < 1e-12) return `y = ${heSo}x`;
  return `y = ${heSo}x ${b < 0 ? "-" : "+"} ${vietSo(Math.abs(b))}`;
}

/**
 * Chọn khung nhìn cho đồ thị.
 *
 * Lấy các mốc của bảng biến thiên làm lõi rồi nới ra hai bên; chiều dọc lấy
 * theo giá trị THỰC của hàm trên khung đó, bỏ các điểm gần tiệm cận đứng —
 * không bỏ thì một điểm sát cực nên yMax thành 10⁶ và đồ thị hoá ra một đường
 * nằm bệt trên trục.
 */
function chonKhungNhin(expr: string, mocX: number[], poles: number[], mocY: number[]) {
  const co = mocX.filter(Number.isFinite);
  const lo = co.length ? Math.min(...co) : -3;
  const hi = co.length ? Math.max(...co) : 3;
  // Có tiệm cận đứng thì nới rộng hơn để THẤY ĐƯỢC CẢ HAI NHÁNH.
  const rong = Math.max(hi - lo, poles.length ? 4 : 2);
  const xMin = Math.floor(lo - rong * 0.6);
  const xMax = Math.ceil(hi + rong * 0.6);

  /**
   * Chiều dọc lấy theo CÁC MỐC THẬT của hàm (giá trị cực trị, tiệm cận ngang,
   * mức 0), không lấy theo toàn bộ giá trị trên khung.
   *
   * Bản đầu quét cả miền rồi cắt 4 % hai đầu: với y = x³ − 3x + 2 trên [-3; 3]
   * ra khung y từ -16 đến 20, nên hai điểm cực trị (giá trị 0 và 4) dồn vào một
   * dải hẹp giữa hình — đúng cái mà học sinh cần nhìn thì lại nhỏ nhất. SGK vẽ
   * hàm này với y khoảng -4 đến 8.
   */
  const ys = [...mocY.filter(Number.isFinite), 0];
  const duoi = Math.min(...ys), tren = Math.max(...ys);
  // Buộc tỉ lệ dọc theo bề ngang để hình không quá dẹt cũng không quá cao.
  const bien = Math.max(tren - duoi, (xMax - xMin) * 0.5) * 0.6;
  return {
    xMin, xMax,
    yMin: Math.floor(duoi - bien),
    yMax: Math.ceil(tren + bien),
  };
}

/** "x + 3", "2*x - 1", "-x" — dạng phẳng của một đường thẳng, bỏ hệ số 1. */
function bieuThucDuongThang(a: number, b: number): string {
  const he = Math.abs(a - 1) < 1e-12 ? "x" : Math.abs(a + 1) < 1e-12 ? "-x" : `${a}*x`;
  if (Math.abs(b) < 1e-12) return he;
  return `${he}${b < 0 ? "-" : "+"}${Math.abs(b)}`;
}

/**
 * Khảo sát hàm số từ một dòng biểu thức.
 *
 * @param bieuThuc  Viết như máy tính: x^3-3*x+2, (x^2+2*x-2)/(x-1), sqrt(x+1)…
 * @param tenBai    Tên hiện trên tiêu đề slide; để trống thì tự đặt.
 */
export function khaoSatHamSo(bieuThuc: string, tenBai = ""): KhaoSatResult {
  const rong = String(bieuThuc ?? "").trim();
  const notes: string[] = [];
  const chuaChac: string[] = [];
  if (!rong) return { ok: false, error: "Chưa nhập hàm số.", sections: [], notes, chuaChac };

  const c = compileExpression(rong);
  if (!c.ok) return { ok: false, error: `Không đọc được hàm số: ${c.error}`, sections: [], notes, chuaChac };

  const yLatex = sangLatex(rong) ?? rong;
  /**
   * TIÊU ĐỀ SLIDE VIẾT MỘT DÒNG, không dùng phân số hai tầng.
   *
   * Bản đầu V12 đặt `$y = \dfrac{x^2+2x-2}{x-1}$` vào tiêu đề: ô tiêu đề chỉ
   * cao hai dòng chữ, mà một phân số cỡ đầy đủ cao bằng 2,4 dòng — nó tràn
   * xuống, đè lên đường kẻ và đẩy nội dung sang slide "(tiếp)". Hàm số đầy đủ
   * đã có ngay dòng đầu phần nội dung và trên nhãn của bảng biến thiên.
   */
  // Lấy từ biểu thức GỐC (vốn đã một dòng) chứ không từ bản LaTeX: latexToUnicode
  // không biết lệnh \dfrac nên "dfracx² + 2x - 2x - 1" là thứ nó trả về.
  const tenMotDong = latexToUnicode(rong.replace(/\*/g, "")).text.replace(/\s+/g, " ").trim();
  const ten = tenBai.trim() || `Khảo sát hàm số y = ${tenMotDong}`;

  /* ---------- Bảng biến thiên (nguồn của mọi thứ còn lại) ---------- */
  const bang = solveVariationTable(rong);
  if (!bang.ok) {
    return { ok: false, error: `Không lập được bảng biến thiên: ${bang.error}`, sections: [], notes, chuaChac };
  }
  notes.push(...bang.notes);

  const poles = bang.discontinuities.map((d) => {
    const t = bang.x[d.index];
    const cc = compileExpression(String(t).replace(/\\infty/g, "Inf"));
    return cc.ok ? cc.eval(0) : NaN;
  }).filter(Number.isFinite);

  /* ---------- Tập xác định ---------- */
  const txd = poles.length
    ? `D = \\mathbb{R} \\setminus \\{${poles.map((p) => vietSo(p)).join("; ")}\\}`
    : "D = \\mathbb{R}";

  /* ---------- Đạo hàm ---------- */
  const dh = daoHam(rong);
  if (!dh.ok) chuaChac.push(`Đạo hàm: ${dh.error} Bảng biến thiên vẫn đúng vì được tính bằng số.`);

  /* ---------- Nghiệm y' = 0 ---------- */
  const mocTrong = bang.x
    .map((t, i) => ({ t, i }))
    .filter(({ i }) => i > 0 && i < bang.x.length - 1 && !bang.discontinuities.some((d) => d.index === i));
  const cucTri = mocTrong.map(({ t, i }) => {
    const cc = compileExpression(String(t));
    const x = cc.ok ? cc.eval(0) : NaN;
    const truoc = bang.derivative[2 * i - 2], sau = bang.derivative[2 * i];
    return {
      xLatex: t, x,
      giaTri: bang.values[i],
      loai: truoc === "+" && sau === "-" ? "max" as const : truoc === "-" && sau === "+" ? "min" as const : "plain" as const,
    };
  });

  /* ---------- Tiệm cận ---------- */
  const tcDung = poles.map((p) => `x = ${vietSo(p)}`);
  const xa = tiemCanXaVoCuc(rong, 1) ?? tiemCanXaVoCuc(rong, -1);
  const tcXa = xa ? duongThang(xa.a, xa.b) : null;

  /**
   * TÂM ĐỐI XỨNG (V12.1).
   *
   * Hàm phân thức nào cũng có tâm đối xứng I, và SGK luôn đánh dấu nó trên đồ
   * thị — bài khảo sát thiếu I là thiếu một phần của đáp án. I là GIAO ĐIỂM của
   * tiệm cận đứng với tiệm cận ngang hoặc tiệm cận xiên, nên có sẵn cả hai rồi
   * là tính ra ngay. Đúng một tiệm cận đứng thì mới có một tâm; hàm có hai cực
   * (ví dụ 1/(x²-1)) thì không có tâm đối xứng theo nghĩa này.
   */
  const tamPhanThuc = poles.length === 1 && xa
    ? { x: lamDep(poles[0], 1e-6), y: lamDep(xa.a * poles[0] + xa.b, 1e-6) }
    : null;

  /**
   * ĐA THỨC BẬC BA CŨNG CÓ TÂM ĐỐI XỨNG: chính là ĐIỂM UỐN, nơi y″ = 0.
   * SGK luôn ghi điều này khi khảo sát hàm bậc ba, nên thiếu nó là thiếu một
   * phần đáp án. Nhận ra bằng cách lấy đạo hàm hai lần: y″ của hàm bậc ba là
   * một hàm BẬC NHẤT, và hàm bậc nhất thì nghiệm tính được bằng một phép chia.
   */
  const tamBacBa = (() => {
    if (poles.length) return null;               // có tiệm cận đứng thì đã xử lý ở trên
    const d1 = daoHam(rong);
    if (!d1.ok || !d1.expr) return null;
    const d2 = daoHam(d1.expr);
    if (!d2.ok || !d2.expr) return null;
    const c2 = compileExpression(d2.expr);
    if (!c2.ok) return null;
    const a0 = c2.eval(0), a1 = c2.eval(1), a2 = c2.eval(2);
    if (![a0, a1, a2].every(Number.isFinite)) return null;
    const he = a1 - a0;
    // Bậc nhất thật sự: hai bước liên tiếp phải bằng nhau, và hệ số khác 0.
    if (Math.abs((a2 - a1) - he) > 1e-9 || Math.abs(he) < 1e-12) return null;
    const xu = lamDep(-a0 / he, 1e-6);
    const yu = lamDep(evalAt(rong, xu), 1e-6);
    return Number.isFinite(yu) ? { x: xu, y: yu } : null;
  })();

  const tam = tamPhanThuc ?? tamBacBa;
  const tamLaDiemUon = !tamPhanThuc && !!tamBacBa;

  /* ---------- Dựng các slide ---------- */
  const dongNoiDung: string[] = [`Hàm số: $y = ${yLatex}$.`, `Tập xác định: $${txd}$.`];
  if (dh.ok) dongNoiDung.push(`Đạo hàm: $y' = ${dh.latex}$.`);
  if (cucTri.length) {
    dongNoiDung.push(`$y' = 0 \\Leftrightarrow x = ${cucTri.map((e) => e.xLatex).join("$ hoặc $x = ")}$.`);
    cucTri.forEach((e) => {
      if (e.loai === "max") dongNoiDung.push(`Cực đại: $x = ${e.xLatex}$, $y_{CĐ} = ${e.giaTri}$.`);
      if (e.loai === "min") dongNoiDung.push(`Cực tiểu: $x = ${e.xLatex}$, $y_{CT} = ${e.giaTri}$.`);
    });
  } else {
    dongNoiDung.push(poles.length
      ? "$y'$ không đổi dấu trên từng khoảng xác định nên hàm số không có cực trị."
      : "$y'$ không có nghiệm nên hàm số không có cực trị.");
  }

  const bbt: VariationVisual = {
    type: "variation_table", label: "y", expression: rong,
    x: bang.x, derivative: bang.derivative, values: bang.values,
    discontinuities: bang.discontinuities,
  };

  const khung = chonKhungNhin(
    rong,
    bang.x.map((t) => {
      const cc = compileExpression(String(t));
      return cc.ok ? cc.eval(0) : NaN;
    }),
    poles,
    // Mốc theo chiều dọc: giá trị cực trị và mức tiệm cận ngang.
    [
      ...cucTri.filter((e) => Number.isFinite(e.x)).map((e) => evalAt(rong, e.x)),
      ...(xa && xa.kind === "horizontal" ? [xa.b] : []),
      ...(tam ? [tam.y] : []),
    ],
  );

  const doThi: GraphVisual = {
    type: "graph", expression: rong,
    ...khung,
    asymptotes: [
      ...poles.map((p) => ({ kind: "vertical" as const, value: p })),
      ...(xa
        ? [xa.kind === "horizontal"
            ? { kind: "horizontal" as const, value: xa.b }
            : { kind: "oblique" as const, expression: bieuThucDuongThang(xa.a, xa.b) }]
        : []),
    ],
    /**
     * ĐỒ THỊ KHÔNG ĐÁNH DẤU ĐIỂM (V12.2) — theo yêu cầu của thầy Dũng.
     *
     * V12.1 chấm và ghi nhãn cả ba điểm CĐ, CT và tâm đối xứng I. Tôi đã đo
     * lại: ba chấm nằm ĐÚNG toạ độ, sai số 0,0000 px. Nhưng đúng toạ độ không
     * có nghĩa là hình dễ nhìn. Khung nhìn của hàm này cao 14 đơn vị trên một
     * khung vẽ 333 px, tức 1 đơn vị ≈ 17 px — trong khi cỡ chữ sàn là 36 px.
     * Mỗi nhãn vì thế CAO HƠN HAI ĐƠN VỊ. Ba nhãn nằm trong vùng cao 4 đơn vị
     * thì dù xếp cách nào cũng phải chen nhau, và nhãn lệch khỏi chấm bao nhiêu
     * cũng thành "chấm sai vị trí" dưới mắt người đọc.
     *
     * Cách chữa đúng là bỏ hẳn chúng khỏi hình, vì các con số ấy KHÔNG MẤT ĐI:
     * toạ độ cực trị đã có ở slide 1 và trong bảng biến thiên ở slide 2, còn
     * tâm đối xứng ghi thành một dòng chữ ngay dưới đồ thị. Hình chỉ còn đường
     * cong và hai đường tiệm cận — đúng thứ cần nhìn.
     *
     * Trường `points` vẫn còn trong lib/types.ts: thầy nào muốn đánh dấu một
     * điểm cụ thể thì tự khai trong ô dữ liệu hình, phần mềm vẫn vẽ.
     */
  };

  const dongTiemCan: string[] = [];
  /* Toạ độ cực trị chuyển từ HÌNH sang CHỮ: hình không còn chấm nào, nên slide
     đồ thị phải tự nói ra hai điểm ấy, đừng bắt thầy lật lại slide 1. */
  const dsCucTri = cucTri
    .filter((e) => e.loai !== "plain" && Number.isFinite(e.x))
    .map((e) => ({ x: lamDep(e.x, 1e-6), y: lamDep(evalAt(rong, e.x), 1e-6), loai: e.loai }))
    .filter((e) => Number.isFinite(e.y));
  if (dsCucTri.length) {
    const cum = dsCucTri.map(
      (e) => `${e.loai === "max" ? "điểm cực đại" : "điểm cực tiểu"} $(${vietSo(e.x)}; ${vietSo(e.y)})$`,
    );
    /* Nối kiểu tiếng Việt: "A và B", "A, B và C" — không phải "A và B và C". */
    const noi = cum.length <= 1 ? cum[0] : `${cum.slice(0, -1).join(", ")} và ${cum[cum.length - 1]}`;
    dongTiemCan.push(`Đồ thị đi qua ${noi}.`);
  }
  if (tcDung.length) dongTiemCan.push(`Tiệm cận đứng: $${tcDung.join("$ và $")}$.`);
  if (tcXa) dongTiemCan.push(`Tiệm cận ${xa!.kind === "horizontal" ? "ngang" : "xiên"}: $${tcXa}$.`);
  if (tam)
    dongTiemCan.push(tamLaDiemUon
      ? `Điểm uốn $I(${vietSo(tam.x)}; ${vietSo(tam.y)})$ là tâm đối xứng của đồ thị.`
      : `Tâm đối xứng: $I(${vietSo(tam.x)}; ${vietSo(tam.y)})$ — giao của hai đường tiệm cận.`);
  if (!dongTiemCan.length) dongTiemCan.push("Hàm số không có tiệm cận.");

  const sections: Section[] = [
    {
      heading: ten,
      phase: "vi_du",
      level: "TH",
      minutes: 8,
      content: dongNoiDung.join("\n"),
      notes: "Phần này do phần mềm tính trực tiếp từ biểu thức hàm số, không qua AI.",
    },
    {
      heading: `Bảng biến thiên của y = ${tenMotDong}`,
      phase: "vi_du",
      level: "TH",
      minutes: 7,
      content: "Từ dấu của $y'$, lập bảng biến thiên và đọc ra chiều biến thiên cùng các điểm cực trị.",
      visuals: [bbt],
    },
    {
      heading: `Tiệm cận và đồ thị của y = ${tenMotDong}`,
      phase: "vi_du",
      level: "VD",
      minutes: 10,
      content: dongTiemCan.join("\n"),
      visuals: [doThi],
    },
  ];

  notes.push(`Khung nhìn đồ thị: x từ ${khung.xMin} đến ${khung.xMax}, y từ ${khung.yMin} đến ${khung.yMax}.`);
  return { ok: true, sections, notes, chuaChac };
}
