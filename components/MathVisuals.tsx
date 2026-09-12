"use client";
/**
 * components/MathVisuals.tsx — Bộ dựng hình Toán (V11)
 *
 * Ba lỗi toán học nghiêm trọng của V10 được sửa tại đây:
 *
 * 1. BẢNG BIẾN THIÊN VẼ MŨI TÊN THEO GIÁ TRỊ SỐ, KHÔNG THEO DẤU y'.
 *    V10: yOf() = sigmoid(giá trị y) => hai cực trị gần nhau (4 và 3,9) cho mũi
 *    tên gần như nằm ngang; giá trị dạng chữ ("m", "3a") rơi về 0.5 => sai chiều.
 *    V11: độ cao suy ra từ CHUỖI DẤU ĐẠO HÀM (đúng quy ước SGK), rồi ghim ±∞ ra biên.
 *
 * 2. ĐỒ THỊ CẮT SAI MIỀN.
 *    V10: `if (y < v.yMin*4 || y > v.yMax*4) bỏ điểm`. Với yMin = 1, yMax = 5 thì
 *    yMin*4 = 4 => mọi điểm có y < 4 bị vứt, đồ thị biến mất.
 *    V11: cắt theo biên độ miền vẽ + clipPath, và ngắt nét khi qua tiệm cận đứng.
 *
 * 3. KHÔNG VẼ ĐƯỢC sin, cos, ln, √ ...
 *    V10 chặn bằng một regex chỉ cho phép x, chữ số và các dấu + - nhân chia luỹ
 *    thừa ngoặc => toàn bộ hàm lượng giác, mũ, logarit, căn của lớp 11 bị loại.
 *    V11 dùng lib/mathexpr.ts (parser riêng, không eval).
 */

import { useId } from "react";
import { compileExpression, detectPoles } from "@/lib/mathexpr";
import type {
  GraphVisual,
  SignVisual,
  VariationVisual,
  Visual,
  FormulaVisual,
} from "@/lib/types";
import { ExtraVisual, isExtraVisual } from "./MathVisualsExtra";
import { computeLevels, isMinusInf, isPlusInf, plainMath, shortLabel, tableCaption } from "@/lib/bbt";
import { solveVariationTable, tableMatches } from "@/lib/bbtsolve";
import { GRAPH_H, GRAPH_W, SC_HEAD, SC_ROW_H, SC_W, VT_CAPTION_H, VT_H, VT_W, svgFontPx } from "@/lib/slides";

/* ------------------------------------------------------------------ */
/* Công thức                                                           */
/* ------------------------------------------------------------------ */

/* MathText và MixedMath chuyển sang components/MathText.tsx — dùng chung với
   MathVisualsExtra.tsx mà không tạo vòng lặp import. Vẫn xuất lại ở đây để mã
   cũ (SlideView, app/page.tsx) khỏi phải sửa. */
export { MathText, MixedMath } from "./MathText";
import { MathText, MixedMath } from "./MathText";

function Formula({ v }: { v: FormulaVisual }) {
  return (
    <div className={`formula-block${v.highlight ? " highlight" : ""}`}>
      <MathText value={v.latex} display={v.display ?? true} />
      {v.caption ? <small className="visual-caption"><MixedMath value={v.caption} /></small> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bảng biến thiên                                                     */
/* ------------------------------------------------------------------ */

function VariationTable({ v }: { v: VariationVisual }) {
  // useId: mỗi bảng có mã marker riêng. Nếu dùng chung id "bbtArrow" như V10 thì
  // trình duyệt chỉ giải quyết theo phần tử ĐẦU TIÊN trong tài liệu — khi bảng đó
  // nằm trong nhánh display:none (ví dụ đang xem tab khác) thì TOÀN BỘ mũi tên
  // biến thiên trên mọi bảng còn lại biến mất.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const arrowId = `bbtArrow${uid}`;
  /**
   * V11.5 vẽ khung 860×300 rồi để bộ xuất nhét vào ô rộng 7,3 in bên phải khối
   * chữ. Hệ số thu còn 0,61 nên nhãn 22 px chỉ ra 13 pt trên slide — học sinh
   * bàn ba đã chịu. V11.6 giữ khung do lib/slides.ts quy định (hình chiếm trọn
   * bề ngang slide) và tính NGƯỢC cỡ chữ từ ô chứa bằng svgFontPx().
   */
  const W = VT_W;
  /**
   * Dòng nhãn "y = x² - 4x + 3" đặt PHÍA TRÊN bảng, đúng cách trình bày của sách
   * giáo khoa. Bộ sinh nội dung hay nhét cả biểu thức vào cột trái; ở cỡ chữ mới
   * nó tràn qua vạch dọc và đè lên cột giá trị (xem bài giảng Bài 4, slide 07).
   */
  /*
   * Nếu JSON có expression, ưu tiên dữ liệu được máy thẩm định. V11.9 chỉ sửa
   * bảng sau khi giáo viên bấm "Tự sửa", nên bản xem trước và PowerPoint vẫn
   * có thể xuất một bảng sai. Bản này dựng lại ngay khi bảng thiếu hoặc lệch;
   * JSON không có expression vẫn được giữ nguyên để hỗ trợ bảng tham số.
   */
  const solved = v.expression ? solveVariationTable(v.expression) : null;
  const useSolved = !!solved?.ok && (!v.x?.length || !tableMatches(v, solved));
  const data = useSolved
    ? ({ ...v, x: solved!.x, derivative: solved!.derivative,
         values: solved!.values, discontinuities: solved!.discontinuities } as VariationVisual)
    : v;
  const caption = tableCaption(data);
  const capH = caption ? VT_CAPTION_H : 0;
  const H = VT_H + capH;
  const fs = svgFontPx(W, H);
  const name = shortLabel(v.label, "y");
  const L = 120;
  const xRow = capH + 62;
  const dRow = capH + 132;
  // yBottom phải chừa đủ một dòng chữ phía dưới, nếu không giá trị ở đáy bảng
  // (thường là -∞) bị mép khung cắt mất — lỗi này chỉ lộ ra khi chữ to lên.
  const yTop = capH + 176;
  const yBottom = H - 46;

  const n = Math.max(2, data.x.length);
  // Chừa lề sau vạch dọc: V10 đặt mốc đầu tiên ngay trên vạch nên "-∞" bị vạch cắt đôi.
  const padIn = 44;
  const step = (W - L - padIn - 30) / (n - 1);
  const xs = Array.from({ length: n }, (_, i) => L + padIn + i * step);
  const dis = new Map((data.discontinuities ?? []).map((d) => [d.index, d]));

  const { left, right } = computeLevels(data);
  // computeLevels đã trả về bậc chuẩn hoá 0..1 cho TỪNG NHÁNH (xem lib/bbt.ts),
  // nên ở đây chỉ việc trải thẳng lên chiều cao ô.
  const yOfLevel = (lv: number) => yBottom - lv * (yBottom - yTop);
  const yOfNode = (i: number, side: "l" | "r", raw: string) => {
    if (isPlusInf(raw)) return yTop;
    if (isMinusInf(raw)) return yBottom;
    return yOfLevel(side === "l" ? left[i] : right[i]);
  };

  const der = data.derivative ?? [];
  const full = der.length >= 2 * n - 3;
  const intervalSign = (i: number) => (full ? der[i * 2] : der[i]) ?? "";
  const nodeSign = (i: number) => (full ? der[i * 2 + 1] : "0") ?? "0";
  const vals = Array.from({ length: n }, (_, i) => data.values?.[i] ?? "");

  /**
   * MŨI TÊN PHẢI DỪNG TRƯỚC CHỮ (V11.8).
   *
   * Ở mốc gián đoạn, hai giới hạn một phía được viết sát hai bên vạch đôi. Bản
   * cũ luôn lùi đúng `fs` nên mũi tên đâm thẳng vào chữ "-∞": đầu mũi tên đè
   * lên dấu trừ, học sinh đọc thành một ký hiệu lạ. Lùi thêm bề ngang chữ.
   * 0,56 là bề ngang trung bình một ký tự Times New Roman so với cỡ chữ.
   */
  const GAP = Math.round(6 + fs * 0.25);
  const inset = (i: number, side: "l" | "r") => {
    const d = dis.get(i);
    if (!d) return fs;
    const raw = side === "l" ? d.leftValue : d.rightValue;
    return GAP + Math.round(plainMath(raw).length * fs * 0.56 + fs * 0.45);
  };

  return (
    <svg className="variation-svg" viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label={`Bảng biến thiên${data.label ? " của " + data.label : ""}`}>
      <defs>
        <marker id={arrowId} markerWidth="11" markerHeight="11" refX="10" refY="5.5" orient="auto">
          <path d="M0,0 L11,5.5 L0,11 Z" fill="#263746" />
        </marker>
      </defs>

      <rect width={W} height={H} fill="#fff" />
      {caption && (
        <text x="2" y={fs} className="bbt-caption" style={{ fontSize: fs }}>{caption}</text>
      )}
      <rect x="1" y={capH + 1} width={W - 2} height={H - capH - 2} fill="#fff" stroke="#263746" strokeWidth="1.6" />
      <line x1={L} x2={L} y1={capH + 1} y2={H - 1} stroke="#263746" strokeWidth="1.6" />
      <line x1="1" x2={W - 1} y1={xRow} y2={xRow} stroke="#263746" />
      <line x1="1" x2={W - 1} y1={dRow} y2={dRow} stroke="#263746" />

      <text x={L / 2} y={xRow - 18} className="bbt-label" style={{ fontSize: fs + 1 }}>x</text>
      <text x={L / 2} y={dRow - 22} className="bbt-label" style={{ fontSize: fs + 1 }}>{`${name}′`}</text>
      <text x={L / 2} y={(yTop + yBottom) / 2 + fs / 3} className="bbt-label" style={{ fontSize: fs + 1 }}>{name}</text>

      {/* hàng x */}
      {xs.map((x, i) => (
        <text key={`x${i}`} x={x} y={xRow - 18} className="bbt-text" style={{ fontSize: fs }}>{plainMath(data.x[i] ?? "")}</text>
      ))}

      {/* dấu trên từng khoảng */}
      {Array.from({ length: n - 1 }, (_, i) => (
        <text key={`s${i}`} x={(xs[i] + xs[i + 1]) / 2} y={dRow - 22} className="bbt-sign" style={{ fontSize: fs + 3 }}>
          {plainMath(intervalSign(i))}
        </text>
      ))}

      {/* giá trị y' tại điểm tới hạn (0 hoặc || nếu không xác định) */}
      {Array.from({ length: Math.max(0, n - 2) }, (_, i) => (
        <text key={`z${i}`} x={xs[i + 1]} y={dRow - 22} className="bbt-text" style={{ fontSize: fs }}>
          {dis.has(i + 1) ? "‖" : plainMath(nodeSign(i))}
        </text>
      ))}

      {/* mũi tên biến thiên — chiều lấy từ dấu y', không lấy từ độ lớn giá trị */}
      {Array.from({ length: n - 1 }, (_, i) => {
        const sign = plainMath(intervalSign(i));
        if (sign !== "+" && sign !== "-") return null;
        const y1 = yOfNode(i, "r", vals[i]);
        const y2 = yOfNode(i + 1, "l", vals[i + 1]);
        const x1 = xs[i] + inset(i, "r");
        const x2 = xs[i + 1] - inset(i + 1, "l");
        if (x2 <= x1) return null;
        return (
          <line key={`a${i}`} x1={x1} y1={y1 + (y2 > y1 ? 14 : -14)} x2={x2} y2={y2 + (y2 > y1 ? -14 : 14)}
                stroke="#263746" strokeWidth="3" markerEnd={`url(#${arrowId})`} />
        );
      })}

      {/* giá trị y tại các mốc */}
      {vals.map((value, i) => {
        const d = dis.get(i);
        if (d) {
          return (
            <g key={`v${i}`}>
              <line x1={xs[i] - 4} x2={xs[i] - 4} y1={xRow} y2={H - 1} stroke="#263746" />
              <line x1={xs[i] + 4} x2={xs[i] + 4} y1={xRow} y2={H - 1} stroke="#263746" />
              {/* textAnchor phải đặt trong style, KHÔNG đặt làm thuộc tính:
                  .bbt-value trong app/bbt.css đã khai text-anchor:middle, mà CSS
                  thắng thuộc tính trình bày của SVG. Bản V11.7 đặt ở thuộc tính
                  nên hai giới hạn một phía đều bị căn giữa và cưỡi lên vạch đôi. */}
              <text x={xs[i] - GAP} y={yOfNode(i, "l", d.leftValue)} className="bbt-value"
                    style={{ fontSize: fs, textAnchor: "end" }}>
                {plainMath(d.leftValue)}
              </text>
              <text x={xs[i] + GAP} y={yOfNode(i, "r", d.rightValue)} className="bbt-value"
                    style={{ fontSize: fs, textAnchor: "start" }}>
                {plainMath(d.rightValue)}
              </text>
            </g>
          );
        }
        const y = yOfNode(i, "r", value);
        const atTop = y < (yTop + yBottom) / 2;
        return (
          <text key={`v${i}`} x={xs[i]} y={atTop ? y - 10 : y + fs} className="bbt-value" style={{ fontSize: fs }}>
            {plainMath(value)}
          </text>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Bảng xét dấu                                                        */
/* ------------------------------------------------------------------ */

function SignChart({ v }: { v: SignVisual }) {
  const n = Math.max(2, v.x.length);
  const rows = v.rows?.length ? v.rows : [{ label: v.label || "f(x)", signs: v.signs ?? [] }];
  const W = SC_W;
  const rowH = SC_ROW_H;
  const H = SC_HEAD + rows.length * rowH;
  const fs = svgFontPx(W, H);
  /**
   * Nhãn hàng trong bảng xét dấu CHÍNH LÀ biểu thức ("x - 1", "x + 2", "f(x)") —
   * đó là cách trình bày của SGK, không được rút gọn. Nhưng ở cỡ chữ mới chúng
   * dài gấp 2,5 lần, nên cột trái phải TỰ GIÃN theo nhãn dài nhất, nếu không chữ
   * đè lên vạch dọc ngăn cột.
   */
  const longest = Math.max(1, ...rows.map((r) => plainMath(r.label || "").length), 1);
  const L = Math.min(W * 0.42, Math.max(186, longest * fs * 0.58 + 36));
  const padIn = 48;
  const step = (W - L - padIn - 62) / (n - 1);
  const xs = Array.from({ length: n }, (_, i) => L + padIn + i * step);

  return (
    <svg className="sign-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bảng xét dấu">
      <rect x="1" y="1" width={W - 2} height={H - 2} fill="#fff" stroke="#263746" strokeWidth="1.6" />
      <line x1={L} x2={L} y1="1" y2={H - 1} stroke="#263746" strokeWidth="1.6" />
      <line x1="1" x2={W - 1} y1={SC_HEAD} y2={SC_HEAD} stroke="#263746" />
      <text x={L / 2} y={SC_HEAD - 20} className="bbt-label" style={{ fontSize: fs + 1 }}>x</text>
      {xs.map((x, i) => (
        <text key={i} x={x} y={SC_HEAD - 20} className="bbt-text" style={{ fontSize: fs }}>{plainMath(v.x[i] ?? "")}</text>
      ))}
      {/* Các cột mốc giúp mắt theo đúng một nghiệm từ hàng x xuống các hàng.
          Chỉ kẻ rất nhạt; mốc không xác định sẽ được hàng dữ liệu ghi bằng ‖. */}
      {xs.slice(1, -1).map((x, i) => (
        <line key={`guide${i}`} x1={x} x2={x} y1={SC_HEAD} y2={H - 1}
              stroke="#D9E2EA" strokeWidth="1" />
      ))}
      {rows.map((row, r) => {
        const yBase = SC_HEAD + (r + 1) * rowH;
        const signs = row.signs ?? [];
        const full = signs.length >= 2 * n - 3;
        return (
          <g key={r}>
            {r < rows.length - 1 && <line x1="1" x2={W - 1} y1={yBase} y2={yBase} stroke="#263746" />}
            <text x={L / 2} y={yBase - 18} className="bbt-label" style={{ fontSize: fs + 1 }}>{plainMath(row.label)}</text>
            {Array.from({ length: n - 1 }, (_, i) => (
              <text key={`s${i}`} x={(xs[i] + xs[i + 1]) / 2} y={yBase - 16} className="bbt-sign" style={{ fontSize: fs + 3 }}>
                {plainMath((full ? signs[i * 2] : signs[i]) ?? "")}
              </text>
            ))}
            {Array.from({ length: Math.max(0, n - 2) }, (_, i) => (
              <text key={`z${i}`} x={xs[i + 1]} y={yBase - 16} className="bbt-text" style={{ fontSize: fs }}>
                {/* Không được tự đoán mọi mốc là nghiệm. Với bảng nhiều hàng,
                    một mốc có thể là nghiệm của hàng khác hoặc điểm loại. */}
                {plainMath((full ? signs[i * 2 + 1] : "") ?? "")}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Đồ thị                                                              */
/* ------------------------------------------------------------------ */

const CURVE_COLORS = ["#0F766E", "#B91C1C", "#1D4ED8", "#B45309", "#6D28D9"];

function buildPath(
  expr: string,
  xMin: number, xMax: number, yMin: number, yMax: number,
  sx: (x: number) => number, sy: (y: number) => number,
): { paths: string[]; error?: string } {
  const compiled = compileExpression(expr);
  if (!compiled.ok) return { paths: [], error: compiled.error };

  const poles = detectPoles(expr, xMin, xMax);
  const SAMPLES = 1400;
  const yRange = yMax - yMin;
  const guard = yRange * 3; // biên cắt thật sự, không phải yMin*4 như V10
  const paths: string[] = [];
  let current = "";
  let prevY: number | null = null;
  let prevX: number | null = null;

  const flush = () => { if (current.length > 3) paths.push(current); current = ""; prevY = null; prevX = null; };

  for (let i = 0; i <= SAMPLES; i++) {
    const x = xMin + ((xMax - xMin) * i) / SAMPLES;
    // ngắt nét khi đi qua tiệm cận đứng
    if (prevX !== null && poles.some((p) => p > prevX! && p <= x)) flush();

    const y = compiled.eval(x);
    if (!Number.isFinite(y) || y < yMin - guard || y > yMax + guard) { flush(); continue; }
    // ngắt khi nhảy quá lớn (hàm phần nguyên, tan x...)
    if (prevY !== null && Math.abs(y - prevY) > yRange * 1.5) flush();

    current += (current ? " L " : "M ") + `${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`;
    prevY = y;
    prevX = x;
  }
  flush();
  return { paths };
}

function niceStep(range: number): number {
  const raw = range / 8;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  return (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
}

function Graph({ v }: { v: GraphVisual }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clipId = `graphClip${uid}`;
  const axisId = `axisArrow${uid}`;
  /**
   * Khung 900×405 gần đúng tỉ lệ ô chứa trên slide (11,8 × 5,26 in), nên đồ thị
   * dùng hết chỗ và hệ số thu xấp xỉ 0,94 — nhờ vậy chữ 34 px trong hình ra
   * đúng 32 pt trên slide. V11.5 để 12 px, tức chỉ 10 pt: nhìn từ bàn hai đã mờ.
   */
  const W = GRAPH_W;
  const H = GRAPH_H;
  const fs = svgFontPx(W, H);
  // Lề trên dành riêng cho chú giải; không đặt công thức đè lên vùng đồ thị.
  const p = 84;
  const xMin = v.xMin, xMax = v.xMax, yMin = v.yMin, yMax = v.yMax;
  const sx = (x: number) => p + ((x - xMin) * (W - 2 * p)) / (xMax - xMin);
  const sy = (y: number) => H - p - ((y - yMin) * (H - 2 * p)) / (yMax - yMin);

  /**
   * V11.6 viết `v.expressions?.length ? v.expressions : [v.expression]` — tức là
   * HỄ CÓ mảng `expressions` thì trường `expression` bị BỎ QUA HOÀN TOÀN.
   *
   * Bộ sinh nội dung hay điền tiệm cận xiên vào `expressions` để vẽ nét đứt kèm
   * theo. Hậu quả: hàm số chính biến mất khỏi slide, học sinh chỉ còn thấy đúng
   * một đường thẳng chéo — xem bài giảng Bài 4, slide 52 và 57.
   *
   * Nay `expression` LUÔN được vẽ, `expressions` chỉ là các đường vẽ THÊM.
   */
  const goc = (s: unknown) => String(s ?? "").replace(/\s/g, "");
  const extra = (v.expressions ?? []).filter((e) => e?.expression && goc(e.expression) !== goc(v.expression));
  // Nếu hàm chính CŨNG có trong `expressions` thì lấy luôn nhãn/màu/nét đứt của
  // nó, đừng vẽ lại bằng nhãn rỗng — bản đầu V11.8 làm mất chú giải "y = 2ˣ".
  const cungTen = (v.expressions ?? []).find((e) => goc(e?.expression) === goc(v.expression));
  const curves = [
    ...(v.expression
      ? [{
          expression: v.expression,
          label: cungTen?.label as string | undefined,
          color: cungTen?.color as string | undefined,
          dashed: !!cungTen?.dashed,
        }]
      : []),
    ...extra,
  ];

  const rendered = curves.map((c, i) => ({
    ...c,
    color: c.color || CURVE_COLORS[i % CURVE_COLORS.length],
    ...buildPath(c.expression, xMin, xMax, yMin, yMax, sx, sy),
  }));

  // Tiệm cận đứng có thể suy ra chắc chắn từ biểu thức. JSON vẫn có quyền
  // khai báo thêm tiệm cận ngang/xiên; các đường trùng nhau được gộp lại.
  const declaredAsymptotes = v.asymptotes ?? [];
  const autoVertical = v.expression
    ? detectPoles(v.expression, xMin, xMax, 1800)
        .filter((value) => !declaredAsymptotes.some((a) => a.kind === "vertical" && a.value !== undefined && Math.abs(a.value - value) < 1e-4))
        .map((value) => ({ kind: "vertical" as const, value }))
    : [];
  const asymptotes = [...declaredAsymptotes, ...autoVertical];

  const errors = rendered.filter((r) => r.error);
  const stepX = niceStep(xMax - xMin);
  const stepY = niceStep(yMax - yMin);
  const gridX: number[] = [];
  for (let t = Math.ceil(xMin / stepX) * stepX; t <= xMax + 1e-9; t += stepX) gridX.push(Number(t.toFixed(6)));
  const gridY: number[] = [];
  for (let t = Math.ceil(yMin / stepY) * stepY; t <= yMax + 1e-9; t += stepY) gridY.push(Number(t.toFixed(6)));

  /**
   * Chữ trên trục nay to gấp gần ba lần, các nhãn sẽ chồng lên nhau. Giữ nguyên
   * vạch lưới (để học sinh vẫn đọc được toạ độ) nhưng chỉ GHI SỐ ở một phần
   * các vạch.
   *
   * Điều kiện: chỉ ghi ở những vạch là bội của bước × k. Nếu chỉ lấy cách một
   * vạch theo chỉ số thì gặp trường hợp bước 0,5 sẽ ra dãy 0,5 / 1,5 / 2,5 —
   * đúng về khoảng cách nhưng không ai dạy Toán lại chia trục như thế.
   */
  const keepEvery = (list: number[], step: number, need: number, span: number) => {
    const room = Math.max(1, Math.floor(span / Math.max(1, need)));
    let k = 1;
    while (list.filter((t) => Math.abs(t / (step * k) - Math.round(t / (step * k))) < 1e-6).length > room) k++;
    return list.filter((t) => Math.abs(t / (step * k) - Math.round(t / (step * k))) < 1e-6);
  };
  const labelledX = gridX.filter((t) => Math.abs(t) > 1e-9);
  const labelledY = gridY.filter((t) => Math.abs(t) > 1e-9);
  const widestX = Math.max(2, ...labelledX.map((t) => String(t).length));
  const tickX = keepEvery(labelledX, stepX, widestX * fs * 0.62 + 12, W - 2 * p);
  const tickY = keepEvery(labelledY, stepY, fs * 1.6, H - 2 * p);

  // vùng tô (dạy diện tích hình phẳng / tích phân)
  let shadePath = "";
  if (v.shade) {
    const c = compileExpression(v.expression);
    if (c.ok) {
      const a = Math.max(xMin, v.shade.from), b = Math.min(xMax, v.shade.to);
      const pts: string[] = [`M ${sx(a).toFixed(2)} ${sy(0).toFixed(2)}`];
      for (let i = 0; i <= 200; i++) {
        const x = a + ((b - a) * i) / 200;
        const y = Math.max(yMin, Math.min(yMax, c.eval(x)));
        if (Number.isFinite(y)) pts.push(`L ${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`);
      }
      pts.push(`L ${sx(b).toFixed(2)} ${sy(0).toFixed(2)} Z`);
      shadePath = pts.join(" ");
    }
  }

  const pointFill: Record<string, string> = {
    max: "#B91C1C", min: "#1D4ED8", inflection: "#7C3AED", root: "#0F766E", plain: "#EF8354",
  };

  /**
   * ĐẶT NHÃN ĐIỂM ĐẶC BIỆT — tính trước cho CẢ BỘ, không tính rời từng điểm.
   *
   * Bản V11.7 xếp từng nhãn độc lập nên với hàm y = (x²+2x-2)/(x-1): nhãn
   * "CĐ(0; 2)" bị đẩy sang phải vì điểm nằm trên trục Oy, rơi đúng chỗ nhãn
   * "CT(2; 6)" — hai nhãn dính vào nhau thành một khối chữ không đọc được.
   * Muốn tránh thì phải biết vị trí các nhãn khác, tức là phải xếp một lượt.
   *
   * Quy tắc: cực tiểu ghi xuống dưới, còn lại ghi lên trên (phía luôn trống);
   * nhãn nào vẫn chạm nhãn đã xếp thì đẩy thêm từng dòng ra xa chấm.
   */
  const axisYpx = yMin <= 0 && yMax >= 0 ? sy(0) : H - p;
  const axisXpx = xMin <= 0 && xMax >= 0 ? sx(0) : p;

  /**
   * Chữ ĐÃ CÓ trên hình, coi như chỗ đã chiếm: dãy số trên hai trục và tên
   * trục. Nhãn điểm phải tránh, nếu không nó đè lên số "2" của trục hoành hoặc
   * trèo lên chữ "y" ở đầu trục tung — hai lỗi đúng như ảnh thầy gửi.
   */
  const vatCan: { x0: number; x1: number; y: number }[] = [];
  const beRong = (s: unknown, co = fs) => String(s).length * co * 0.54;
  tickX.forEach((t) => {
    const w = beRong(t);
    vatCan.push({ x0: sx(t) - w / 2, x1: sx(t) + w / 2, y: axisYpx + fs + 6 });
  });
  tickY.forEach((t) => {
    vatCan.push({ x0: axisXpx - 12 - beRong(t), x1: axisXpx - 12, y: sy(t) + fs / 3 });
  });
  vatCan.push({ x0: W - 8 - beRong(v.xLabel || "x", fs + 2), x1: W - 8, y: axisYpx - 14 });
  const xTenTrucY = Math.min(axisXpx + 14, W - 8);
  vatCan.push({ x0: xTenTrucY, x1: xTenTrucY + beRong(v.yLabel || "y", fs + 2), y: Math.max(fs + 4, p - 14) });

  const placedPoints = (v.points ?? []).map((q) => {
    const label = q.label || `(${q.x}; ${q.y})`;
    const below = q.kind === "min";
    const w = label.length * fs * 0.54;
    const px = sx(q.x), py = sy(q.y);
    /**
     * Điểm nằm trên trục Oy: nhãn canh giữa sẽ trùm lên dãy số của trục tung
     * (dãy số đó viết bên TRÁI trục). Khi ấy viết nhãn bắt đầu ngay cạnh chấm
     * — vẫn dính liền với chấm, mà chừa nguyên dãy số. Bản V11.7 đẩy nhãn đi
     * nửa bề ngang nên nhãn rời hẳn khỏi chấm, nhìn tưởng của điểm khác.
     */
    let anchor: "middle" | "start" | "end" = "middle";
    let tx = Math.min(Math.max(px, p + w / 2), W - p - w / 2);
    if (Math.abs(px - axisXpx) < w / 2 + 12) {
      const vuaBenPhai = px + 12 + w < W - p;
      anchor = vuaBenPhai ? "start" : "end";
      tx = vuaBenPhai ? px + 12 : px - 12;
    }
    let x0 = anchor === "middle" ? tx - w / 2 : anchor === "start" ? tx : tx - w;
    // Điểm sát trục Ox: nhãn ghi xuống dưới rơi đúng hàng số của trục hoành.
    const chamTrucNgang = Math.abs(py - axisYpx) < fs * 1.2;
    const buoc1 = below ? fs * (chamTrucNgang ? 2.35 : 1.2) : fs * 0.55;
    return { label, below, px, py, tx, ty: py + (below ? buoc1 : -buoc1), x0, x1: x0 + w, w,
             anchor, kind: q.kind, buoc1, leader: false };
  });
  /**
   * Gỡ chồng một lượt cho CẢ BỘ nhãn. Ba điều kiện, thiếu cái nào cũng ra lỗi
   * đã gặp thật:
   *  - nhãn không đè nhãn khác (hai nhãn CĐ/CT dính thành một khối chữ);
   *  - nhãn không phủ CHẤM của điểm khác (nhãn "CĐ(0; 2)" đứng đúng chỗ chấm
   *    cực tiểu (2; 6) — đọc ra toạ độ sai hoàn toàn);
   *  - nhãn nằm trong khung vẽ, chừa hàng trên cho tên trục (nhãn trèo lên chữ
   *    "y" ở đầu trục tung).
   * Thử lần lượt: đẩy xa dần về phía quy ước, hết chỗ thì đổi sang phía kia.
   */
  // Chỉ cần nằm trong khung ẢNH; lề p phía trên vốn để dành cho nhãn của điểm
  // sát đỉnh. Chặn ở p sẽ đẩy nhãn cực đại xuống dưới, đè lên đúng đường cong.
  const tronKhung = (ty: number) => ty >= fs * 0.9 && ty <= H - 8;
  placedPoints.forEach((q, i) => {
    const vuong = (ty: number) => {
      const chongChu = vatCan.some((o) => !(o.x1 < q.x0 || o.x0 > q.x1) && Math.abs(o.y - ty) < fs * 1.05);
      if (chongChu) return false;
      return !placedPoints.some((o, j) => {
        if (j === i) return false;
        const chongNhan = j < i && !(o.x1 < q.x0 || o.x0 > q.x1) && Math.abs(o.ty - ty) < fs * 1.15;
        const phuCham = o.px > q.x0 - 10 && o.px < q.x1 + 10 && Math.abs(o.py - ty) < fs * 0.85;
        return chongNhan || phuCham;
      });
    };
    const uu = q.below ? 1 : -1;
    const thu: { tx: number; ty: number; anchor: "middle" | "start" | "end" }[] = [];
    // Thử lên/xuống trước, sau đó mới đặt sang trái/phải. Đây là phần V11.9
    // còn thiếu nên nhãn I, CĐ, CT có thể xếp thành một cột và đè lên đường.
    for (const chieu of [uu, -uu])
      for (let k = 0; k < 4; k++)
        thu.push({ tx: q.tx, ty: q.py + chieu * ((chieu === uu ? q.buoc1 : fs * 1.2) + k * fs * 1.25), anchor: q.anchor });
    thu.push({ tx: q.px + 16, ty: q.py - 8, anchor: "start" });
    thu.push({ tx: q.px - 16, ty: q.py - 8, anchor: "end" });
    const dat = thu.find((c) => {
      const x0 = c.anchor === "middle" ? c.tx - q.w / 2 : c.anchor === "start" ? c.tx : c.tx - q.w;
      q.x0 = x0; q.x1 = x0 + q.w;
      return x0 >= 6 && x0 + q.w <= W - 6 && tronKhung(c.ty) && vuong(c.ty);
    });
    if (dat) { q.tx = dat.tx; q.ty = dat.ty; q.anchor = dat.anchor; }
    else q.ty = Math.min(Math.max(thu[0].ty, fs * 0.9), H - 8);
    // Nhãn đã rời xa chấm thì kẻ nét mảnh nối lại cho biết của điểm nào.
    if (Math.abs(q.ty - q.py) > fs * 1.6 || Math.abs((q.x0 + q.x1) / 2 - q.px) > fs) q.leader = true;
  });

  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label={`Đồ thị hàm số ${curves.map((c) => c.expression).join(", ")}`}>
      <defs>
        <clipPath id={clipId}>
          <rect x={p} y={p} width={W - 2 * p} height={H - 2 * p} />
        </clipPath>
        <marker id={axisId} markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="#263746" />
        </marker>
      </defs>

      <rect width={W} height={H} rx="12" fill="#fff" />
      <g stroke="#E2EAF1" strokeWidth="1">
        {gridX.map((t, i) => <line key={`gx${i}`} x1={sx(t)} x2={sx(t)} y1={p} y2={H - p} />)}
        {gridY.map((t, i) => <line key={`gy${i}`} y1={sy(t)} y2={sy(t)} x1={p} x2={W - p} />)}
      </g>

      {shadePath && <path d={shadePath} fill="#0F766E22" stroke="none" clipPath={`url(#${clipId})`} />}

      {/* trục */}
      <g stroke="#263746" strokeWidth="2.2">
        {yMin <= 0 && yMax >= 0 && (
          <line x1={p} x2={W - p + 6} y1={sy(0)} y2={sy(0)} markerEnd={`url(#${axisId})`} />
        )}
        {xMin <= 0 && xMax >= 0 && (
          <line y1={H - p} y2={p - 6} x1={sx(0)} x2={sx(0)} markerEnd={`url(#${axisId})`} />
        )}
      </g>
      <g className="graph-tick svg-halo" style={{ fontSize: fs }}>
        {tickX.map((t, i) => (
          <text key={`tx${i}`} x={sx(t)} y={(yMin <= 0 && yMax >= 0 ? sy(0) : H - p) + fs + 6} textAnchor="middle">{t}</text>
        ))}
        {tickY.map((t, i) => (
          <text key={`ty${i}`} x={(xMin <= 0 && xMax >= 0 ? sx(0) : p) - 12} y={sy(t) + fs / 3} textAnchor="end">{t}</text>
        ))}
      </g>
      {/* Tên trục căn theo MÉP KHUNG, không theo mũi tên. V11.6 đặt tên trục
          hoành ở x = W - p + 6 với lối canh trái, nên nhãn dài như "x (sản
          phẩm)" chạy thẳng ra ngoài slide và bị cắt cụt. */}
      <text x={W - 8} y={(yMin <= 0 && yMax >= 0 ? sy(0) : H - p) - 14} textAnchor="end"
            className="axis-name svg-halo" style={{ fontSize: fs + 2 }}>{v.xLabel || "x"}</text>
      <text x={Math.min((xMin <= 0 && xMax >= 0 ? sx(0) : p) + 14, W - 8)} y={Math.max(fs + 4, p - 14)}
            textAnchor="start" className="axis-name svg-halo" style={{ fontSize: fs + 2 }}>{v.yLabel || "y"}</text>

      {/* tiệm cận */}
      {asymptotes.map((a, i) => {
        if (a.kind === "vertical" && a.value !== undefined)
          return <line key={i} stroke="#D1495B" strokeDasharray="8 6" x1={sx(a.value)} x2={sx(a.value)} y1={p} y2={H - p} />;
        if (a.kind === "horizontal" && a.value !== undefined)
          return <line key={i} stroke="#D1495B" strokeDasharray="8 6" y1={sy(a.value)} y2={sy(a.value)} x1={p} x2={W - p} />;
        if (a.kind === "oblique" && a.expression) {
          const c = compileExpression(a.expression);
          if (!c.ok) return null;
          return <line key={i} stroke="#D1495B" strokeDasharray="8 6" clipPath={`url(#${clipId})`}
                       x1={sx(xMin)} y1={sy(c.eval(xMin))} x2={sx(xMax)} y2={sy(c.eval(xMax))} />;
        }
        return null;
      })}

      {/* đường cong */}
      <g clipPath={`url(#${clipId})`}>
        {rendered.map((r, i) =>
          r.paths.map((d, j) => (
            <path key={`${i}-${j}`} d={d} fill="none" stroke={r.color} strokeWidth="4"
                  strokeDasharray={r.dashed ? "10 7" : undefined} strokeLinecap="round" />
          )),
        )}
      </g>

      {/* điểm đặc biệt */}
      {placedPoints.map((q, i) => {
        const isCenter = String(q.kind ?? "") === "center";
        return (
        <g key={i}>
          {/* Nhãn phải lệch khỏi chấm thì kẻ một nét mảnh nối lại, nếu không
              học sinh không biết nhãn nào của điểm nào — đúng lỗi hai nhãn
              CĐ/CT dính vào nhau ở bản V11.7. */}
          {q.leader && (
            <line x1={q.px} y1={q.py}
                  x2={Math.min(Math.max(q.px, q.x0), q.x1)} y2={q.ty + (q.below ? -fs * 0.32 : fs * 0.28)}
                  stroke="#8b9aa8" strokeWidth="1.6" strokeDasharray="4 3" />
          )}
          <circle cx={q.px} cy={q.py} r="8"
                  fill={isCenter ? "#fff" : pointFill[q.kind || "plain"]}
                  stroke={isCenter ? "#263746" : "#fff"} strokeWidth="2" />
          <text x={q.tx} y={q.ty} className="graph-point-label svg-halo"
                style={{ fontSize: fs, textAnchor: q.anchor }}>
            {q.label}
          </text>
        </g>
      )})}

      {/* chú giải nhiều đồ thị */}
      {rendered.length > 1 && (
        <g className="graph-legend svg-halo" style={{ fontSize: Math.max(18, fs * 0.72) }}>
          {rendered.map((r, i) => (
            <g key={i} transform={`translate(${p + i * ((W - 2 * p) / rendered.length)}, ${Math.max(24, p * 0.48)})`}>
              <line x1="0" x2="34" y1="0" y2="0" stroke={r.color} strokeWidth="4"
                    strokeDasharray={r.dashed ? "8 5" : undefined} />
              {/* Không có nhãn thì viết "y = …" bằng ký hiệu Toán, đừng in
                  nguyên chuỗi thô "2^x" lên màn chiếu. */}
              <text x="42" y={fs / 3}>{r.label || `y = ${plainMath(r.expression)}`}</text>
            </g>
          ))}
        </g>
      )}

      {errors.length > 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" className="graph-error" style={{ fontSize: fs }}>
          ⚠ Không đọc được biểu thức: {errors[0].error}
        </text>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */

export function MathVisual({ visual }: { visual: Visual }) {
  switch (visual.type) {
    case "formula": return <Formula v={visual} />;
    case "variation_table": return <VariationTable v={visual} />;
    case "sign_chart": return <SignChart v={visual} />;
    case "graph": return <Graph v={visual} />;
    default:
      return isExtraVisual(visual) ? <ExtraVisual visual={visual} /> : null;
  }
}

export { VISUAL_LABEL } from "@/lib/themes";
