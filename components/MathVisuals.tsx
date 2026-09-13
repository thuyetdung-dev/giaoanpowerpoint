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

import { useId, type CSSProperties } from "react";
import { compileExpression, detectHorizontalAsymptote, detectPoles } from "@/lib/mathexpr";
import { graphPointsToDisplay } from "@/lib/graphpoints";
import { soVN } from "@/lib/plot";
import type {
  GraphVisual,
  SignVisual,
  VariationVisual,
  Visual,
  FormulaVisual,
} from "@/lib/types";
import { ExtraVisual, isExtraVisual } from "./MathVisualsExtra";
import { computeLevels, isMinusInf, isPlusInf, plainMath, shortLabel, tableCaption, tableCaptionLatex, tenDaoHam } from "@/lib/bbt";
import { needsRichMath } from "@/lib/latex";
import { laThuHepMien, solveVariationTable, tableMatches } from "@/lib/bbtsolve";
import { GRAPH_H, GRAPH_W, SC_HEAD, SC_ROW_H, SC_W, VT_CAPTION_H, VT_H, VT_W, formulaComplexity, svgFontPx } from "@/lib/slides";

/* ------------------------------------------------------------------ */
/* Công thức                                                           */
/* ------------------------------------------------------------------ */

/* MathText và MixedMath chuyển sang components/MathText.tsx — dùng chung với
   MathVisualsExtra.tsx mà không tạo vòng lặp import. Vẫn xuất lại ở đây để mã
   cũ (SlideView, app/page.tsx) khỏi phải sửa. */
export { MathText, MixedMath } from "./MathText";
import { MathText, MixedMath } from "./MathText";

function Formula({ v }: { v: FormulaVisual }) {
  const complexity = formulaComplexity(v.latex);
  const lengthScale = Math.min(1, 82 / Math.max(82, String(v.latex ?? "").length));
  const fit = Math.max(0.76, lengthScale - complexity * 0.018);
  return (
    <div className={`formula-block${v.highlight ? " highlight" : ""}`}
         style={{ "--formula-fit": fit } as CSSProperties}>
      <MathText value={v.latex} display={v.display ?? true} />
      {v.caption ? <small className="visual-caption"><MixedMath value={v.caption} /></small> : null}
    </div>
  );
}

/** Dựng công thức KaTeX hai tầng ngay bên trong hình SVG. */
function MathSvg({ value, x, y, width, height, fontSize, align = "center" }: {
  value: string; x: number; y: number; width: number; height: number;
  fontSize: number; align?: "left" | "center" | "right";
}) {
  const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  return (
    <foreignObject x={x} y={y} width={width} height={height}>
      <div className="svg-math"
           style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: justify,
                    fontSize, color: "#182735", overflow: "visible" }}>
        <MathText value={value} />
      </div>
    </foreignObject>
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
   * THẨM ĐỊNH BẢNG NGAY LÚC DỰNG HÌNH (V12.1).
   *
   * V12.0 chỉ dựng lại bảng khi giáo viên bấm "Tự sửa" (lib/audit.ts). Nhưng
   * repairLesson chỉ chạy sau khi sinh bài và khi bấm nút — bài nạp từ tệp JSON,
   * bài mở lại từ thư viện, hay bảng vừa sửa tay đều KHÔNG qua đó. Hậu quả:
   * khung xem trước và cả tệp PowerPoint vẫn có thể mang một bảng sai.
   *
   * Nay hình tự đối chiếu: có `expression` thì tính lại và dùng bảng đã thẩm
   * định. Bảng KHÔNG có `expression` (bảng tham số, bảng đề bài cho sẵn) vẫn
   * giữ nguyên — không có gì để đối chiếu thì không được đoán.
   */
  const daGiai = v.expression ? solveVariationTable(v.expression) : null;
  /* Bảng thu hẹp trên một miền con (bài thực tế có điều kiện x > 0) thì GIỮ
     NGUYÊN — thay bằng bảng trên cả ℝ là vẽ ra nhánh mà đề bài không có. */
  const thuHep = !!daGiai && laThuHepMien(v, daGiai);
  const dungBanGiai = !!daGiai?.ok && !thuHep && (!v.x?.length || !tableMatches(v, daGiai));
  const vv: VariationVisual = dungBanGiai
    ? { ...v, x: daGiai!.x, derivative: daGiai!.derivative, values: daGiai!.values, discontinuities: daGiai!.discontinuities }
    : v;

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
  const caption = tableCaption(vv);
  const captionLatex = tableCaptionLatex(vv);
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

  const n = Math.max(2, vv.x.length);
  // Chừa lề sau vạch dọc: V10 đặt mốc đầu tiên ngay trên vạch nên "-∞" bị vạch cắt đôi.
  const padIn = 44;
  const step = (W - L - padIn - 30) / (n - 1);
  const xs = Array.from({ length: n }, (_, i) => L + padIn + i * step);
  const dis = new Map((vv.discontinuities ?? []).map((d) => [d.index, d]));

  const { left, right } = computeLevels(vv);
  // computeLevels đã trả về bậc chuẩn hoá 0..1 cho TỪNG NHÁNH (xem lib/bbt.ts),
  // nên ở đây chỉ việc trải thẳng lên chiều cao ô.
  const yOfLevel = (lv: number) => yBottom - lv * (yBottom - yTop);
  const yOfNode = (i: number, side: "l" | "r", raw: string) => {
    if (isPlusInf(raw)) return yTop;
    if (isMinusInf(raw)) return yBottom;
    return yOfLevel(side === "l" ? left[i] : right[i]);
  };

  const der = vv.derivative ?? [];
  const full = der.length >= 2 * n - 3;
  const intervalSign = (i: number) => (full ? der[i * 2] : der[i]) ?? "";
  /**
   * KHÔNG BỊA SỐ 0 (V12.1).
   *
   * V12.0 viết `full ? der[i*2+1] : "0"` — nghĩa là khi mảng y′ chỉ có dấu trên
   * từng khoảng (n−1 ô), phần mềm tự ghi số 0 vào MỌI mốc. Với hàm phân thức
   * thì mốc giữa là điểm KHÔNG XÁC ĐỊNH, không phải nghiệm; ghi 0 ở đó là dạy
   * sai. Thiếu dữ liệu thì để trống, và bộ kiểm định đã có phép báo thiếu.
   */
  const nodeSign = (i: number) => (full ? der[i * 2 + 1] ?? "" : "");
  const vals = Array.from({ length: n }, (_, i) => vv.values?.[i] ?? "");

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
    <div className="variation-render" data-export-html={needsRichMath(captionLatex) ? "true" : undefined}>
    <svg className="variation-svg" viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label={`Bảng biến thiên${v.label ? " của " + v.label : ""}`}>
      <defs>
        <marker id={arrowId} markerWidth="11" markerHeight="11" refX="10" refY="5.5" orient="auto">
          <path d="M0,0 L11,5.5 L0,11 Z" fill="#263746" />
        </marker>
      </defs>

      <rect width={W} height={H} fill="#fff" />
      {caption && (needsRichMath(captionLatex)
        ? <MathSvg value={captionLatex} x={2} y={0} width={W - 4} height={capH} fontSize={fs + 2} align="left" />
        : <text x="2" y={fs} className="bbt-caption" style={{ fontSize: fs }}>{caption}</text>
      )}
      <rect x="1" y={capH + 1} width={W - 2} height={H - capH - 2} fill="#fff" stroke="#263746" strokeWidth="1.6" />
      <line x1={L} x2={L} y1={capH + 1} y2={H - 1} stroke="#263746" strokeWidth="1.6" />
      <line x1="1" x2={W - 1} y1={xRow} y2={xRow} stroke="#263746" />
      <line x1="1" x2={W - 1} y1={dRow} y2={dRow} stroke="#263746" />

      <text x={L / 2} y={xRow - 18} className="bbt-label" style={{ fontSize: fs + 1 }}>x</text>
      <text x={L / 2} y={dRow - 22} className="bbt-label" style={{ fontSize: fs + 1 }}>{tenDaoHam(name)}</text>
      <text x={L / 2} y={(yTop + yBottom) / 2 + fs / 3} className="bbt-label" style={{ fontSize: fs + 1 }}>{name}</text>

      {/* hàng x */}
      {xs.map((x, i) => (
        <text key={`x${i}`} x={x} y={xRow - 18} className="bbt-text" style={{ fontSize: fs }}>{plainMath(vv.x[i] ?? "")}</text>
      ))}

      {/* dấu trên từng khoảng */}
      {Array.from({ length: n - 1 }, (_, i) => (
        <text key={`s${i}`} x={(xs[i] + xs[i + 1]) / 2} y={dRow - 22} className="bbt-sign" style={{ fontSize: fs + 3 }}>
          {plainMath(intervalSign(i))}
        </text>
      ))}

      {/* giá trị y' tại điểm tới hạn.
          Mốc gián đoạn thì KHÔNG ghi gì: vạch đôi đã được vẽ bằng NÉT xuyên
          suốt bảng ở đúng cột ấy. V12.0 còn ghi thêm chữ "‖" vào giữa hai nét
          đó — một hàng kẻ mảnh như sợi tóc kẹp giữa hai vạch đậm, chỉ làm bẩn
          chỗ cần sạch. */}
      {Array.from({ length: Math.max(0, n - 2) }, (_, i) =>
        dis.has(i + 1) ? null : (
          <text key={`z${i}`} x={xs[i + 1]} y={dRow - 22} className="bbt-text" style={{ fontSize: fs }}>
            {plainMath(nodeSign(i))}
          </text>
        ),
      )}

      {/* mũi tên biến thiên — chiều lấy từ dấu y', không lấy từ độ lớn giá trị */}
      {Array.from({ length: n - 1 }, (_, i) => {
        // Dấu y′ trống hoặc không phải + / − thì KHÔNG vẽ mũi tên: vẽ ra là
        // khẳng định một chiều biến thiên mà dữ liệu không hề nói.
        const dau = plainMath(intervalSign(i));
        if (dau !== "+" && dau !== "-" && dau !== "−") return null;
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
    </div>
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
      {/* Đường dẫn cột mảnh: theo một mốc x qua cả các hàng tử, mẫu, thương.
          Bảng ba hàng mà không có nó thì mắt phải tự dóng, rất dễ đọc lệch cột. */}
      {xs.map((x, i) => (
        <line key={`guide${i}`} x1={x} x2={x} y1={SC_HEAD} y2={H - 1}
              stroke="#E2EAF1" strokeWidth="1.4" />
      ))}
      <text x={L / 2} y={SC_HEAD - 20} className="bbt-label" style={{ fontSize: fs + 1 }}>x</text>
      {xs.map((x, i) => (
        <text key={i} x={x} y={SC_HEAD - 20} className="bbt-text" style={{ fontSize: fs }}>{plainMath(v.x[i] ?? "")}</text>
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
            {Array.from({ length: Math.max(0, n - 2) }, (_, i) => {
              /* Thiếu ô giá trị tại mốc thì để TRỐNG. V12.0 tự ghi "0" cho
                 mọi hàng ở mọi mốc — bảng xét dấu tích (x-1)(x+2) hoá ra
                 hàng "x - 1" cũng bằng 0 tại x = -2, tức là dạy sai. */
              const o = plainMath((full ? signs[i * 2 + 1] ?? "" : "") ?? "");
              /**
               * Dấu "|" và "||" vẽ bằng NÉT, không bằng chữ.
               *
               * Chữ "|" của phông Times chỉ dày khoảng 2 px trong khung vẽ; thu
               * xuống cỡ slide rồi chiếu lên tường thì gần như mất hẳn, mà đúng
               * chỗ đó lại là chỗ cần thấy rõ nhất: nó phân biệt "không phải
               * nghiệm của dòng này" với "bằng 0". Vẽ bằng nét thì bề dày do ta
               * quy định.
               */
              if (o === "|" || o === "||" || o === "‖") {
                const day = 3.6;
                const yA = yBase - rowH + 12, yB = yBase - 10;
                const offs = o === "|" ? [0] : [-4.5, 4.5];
                return (
                  <g key={`z${i}`}>
                    {offs.map((d, k) => (
                      <line key={k} x1={xs[i + 1] + d} x2={xs[i + 1] + d} y1={yA} y2={yB}
                            stroke="#263746" strokeWidth={day} />
                    ))}
                  </g>
                );
              }
              return (
                <text key={`z${i}`} x={xs[i + 1]} y={yBase - 16} className="bbt-text" style={{ fontSize: fs }}>{o}</text>
              );
            })}
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
  const p = 84;
  const xMin = v.xMin, xMax = v.xMax, yMin = v.yMin, yMax = v.yMax;
  const sx = (x: number) => p + ((x - xMin) * (W - 2 * p)) / (xMax - xMin);
  const sy = (y: number) => H - p - ((y - yMin) * (H - 2 * p)) / (yMax - yMin);
  // Cực đại, cực tiểu và tâm đối xứng đã có trong nội dung/bảng biến thiên.
  // Không vẽ lại chúng trên đồ thị vì chấm và nhãn che đường cong, trục, tiệm cận.
  const visiblePoints = graphPointsToDisplay(v.points);

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
  let shadeLabel: { text: string; x: number; y: number } | null = null;
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
      /**
       * Tên vùng tô ("S") — lib/types.ts cho khai báo `shade.label` từ V11 mà
       * bộ dựng hình CHƯA BAO GIỜ vẽ nó ra. Khai báo rồi bị bỏ im lặng đúng
       * như lỗi `showParallelogram` của hình vectơ. Bài diện tích hình phẳng
       * không có chữ S thì không chỉ được vào đâu mà nói.
       * Đặt ở giữa bề ngang vùng, nửa chiều cao đường cong — tức là trong lòng
       * vùng tô, không đè lên đường cong.
       */
      const giua = (a + b) / 2;
      const yGiua = c.eval(giua);
      if (v.shade.label && Number.isFinite(yGiua)) {
        const yNhan = Math.max(yMin, Math.min(yMax, yGiua / 2));
        /* Vùng tô hay đối xứng quanh Oy (bài ∫₋₂² (4 − x²)dx), khi ấy chữ S
           rơi đúng vào trục tung và vào dãy số của nó. Dịch sang phải một
           quãng bằng cỡ chữ là thoát, mà vẫn nằm trong lòng vùng. */
        const xNhan = sx(giua);
        const lech = Math.abs(xNhan - (xMin <= 0 && xMax >= 0 ? sx(0) : p)) < fs * 1.2 ? fs * 1.1 : 0;
        shadeLabel = { text: v.shade.label, x: xNhan + lech, y: sy(yNhan) };
      }
    }
  }

  const pointFill: Record<string, string> = {
    max: "#B91C1C", min: "#1D4ED8", inflection: "#7C3AED", root: "#0F766E", plain: "#EF8354",
    center: "#263746",
  };

  /**
   * TỰ DÒ TIỆM CẬN ĐỨNG TỪ BIỂU THỨC (V12.1).
   *
   * Tiệm cận đứng suy ra được CHẮC CHẮN từ hàm số, nên không có lý gì bắt bộ
   * sinh nội dung phải khai đúng mới vẽ. V12.0 chỉ vẽ những đường đã khai: AI
   * quên khai là đồ thị hàm phân thức hiện ra không có đường nét đứt nào, học
   * sinh không thấy được chỗ hàm số không xác định.
   *
   * Đường nào đã khai rồi thì KHÔNG vẽ lại — vẽ hai lần lên cùng một chỗ làm
   * nét đậm gấp đôi, nhìn ra một đường liền.
   */
  const tcDaKhai = v.asymptotes ?? [];
  const tcTuDo = v.expression
    ? detectPoles(v.expression, xMin, xMax, 1800)
        .filter((value) => !tcDaKhai.some((a) => a.kind === "vertical" && a.value !== undefined && Math.abs(a.value - value) < 1e-4))
        .map((value) => ({ kind: "vertical" as const, value }))
    : [];
  /**
   * Tiệm cận NGANG cũng tự dò. Dò được tiệm cận đứng mà bỏ tiệm cận ngang thì
   * đồ thị hàm nhất biến vẫn thiếu một nửa cách trình bày của SGK.
   * Chỉ vẽ khi đường đó nằm trong khung nhìn, và khi chưa khai báo sẵn tiệm
   * cận ngang hay tiệm cận xiên (xiên rồi thì không thể có ngang).
   */
  const daCoNgangHoacXien = tcDaKhai.some((a) => a.kind === "horizontal" || a.kind === "oblique");
  const tcNgang = v.expression && !daCoNgangHoacXien ? detectHorizontalAsymptote(v.expression) : null;
  const tcTuDoNgang =
    tcNgang !== null && tcNgang > yMin && tcNgang < yMax
      ? [{ kind: "horizontal" as const, value: tcNgang }]
      : [];
  const tiemCan = [...tcDaKhai, ...tcTuDo, ...tcTuDoNgang];

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
  const beRong = (s: unknown, co = fs) =>
    (typeof s === "number" ? soVN(s) : String(s)).length * co * 0.54;

  /**
   * SỐ TRÊN TRỤC HOÀNH BỊ CHẤM ĐÈ thì hạ xuống một dòng.
   *
   * Đồ thị y = x³ − 3x + 1 với khung [−4; 4]: cực tiểu (1; −1) rơi đúng vào
   * hàng số của trục hoành, chấm xanh trùm mất số "1" — mà "1" chính là hoành
   * độ cần đọc. Hạ riêng số đó xuống một dòng thì nó vẫn nằm dưới đúng đường
   * lưới của mình nên không thể đọc lệch, lại không bị che.
   */
  const yHangSoX = (yMin <= 0 && yMax >= 0 ? sy(0) : H - p) + fs + 6;
  const yCuaSoX = (t: number) => {
    const cx = sx(t), nua = beRong(t) / 2, giua = yHangSoX - fs * 0.36;
    const biDe = visiblePoints.some(
      (q) => Math.abs(sx(q.x) - cx) < nua + 9 && Math.abs(sy(q.y) - giua) < fs * 0.5 + 9,
    );
    if (!biDe) return yHangSoX;
    const duoi = yHangSoX + fs * 0.95;
    return duoi <= H - 4 ? duoi : yHangSoX;
  };

  tickX.forEach((t) => {
    const w = beRong(t);
    vatCan.push({ x0: sx(t) - w / 2, x1: sx(t) + w / 2, y: yCuaSoX(t) });
  });
  tickY.forEach((t) => {
    vatCan.push({ x0: axisXpx - 12 - beRong(t), x1: axisXpx - 12, y: sy(t) + fs / 3 });
  });
  vatCan.push({ x0: W - 8 - beRong(v.xLabel || "x", fs + 2), x1: W - 8, y: axisYpx - 14 });
  const xTenTrucY = Math.min(axisXpx + 14, W - 8);
  vatCan.push({ x0: xTenTrucY, x1: xTenTrucY + beRong(v.yLabel || "y", fs + 2), y: Math.max(fs + 4, p - 14) });

  const placedPoints = visiblePoints.map((q) => {
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
    const x0 = anchor === "middle" ? tx - w / 2 : anchor === "start" ? tx : tx - w;
    // Điểm sát trục Ox: nhãn ghi xuống dưới rơi đúng hàng số của trục hoành.
    const chamTrucNgang = Math.abs(py - axisYpx) < fs * 1.2;
    const buoc1 = below ? fs * (chamTrucNgang ? 2.35 : 1.2) : fs * 0.55;
    return { label, below, px, py, tx, ty: py + (below ? buoc1 : -buoc1), x0, x1: x0 + w,
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
  /**
   * Trục Ox cũng là một vật cản.
   *
   * Bản đầu của V12.1 xếp chỗ theo khoảng cách nên nhãn "CT(1; 0)" của hàm
   * x³−3x+2 nhảy sang NGANG chấm — mà chấm (1; 0) nằm ngay trên trục hoành,
   * nên đường trục kẻ ngang giữa dòng chữ, gạch đôi cả nhãn. Cũng chính vì thế
   * mà điểm sát trục mới được đẩy xa 2,35 lần cỡ chữ (buoc1) chứ không phải
   * 1,2 lần: để chữ xuống hẳn dưới cả hàng số của trục.
   *
   * Thân chữ chiếm khoảng [ty − 0,72·fs ; ty]. Chặn đúng dải đó (nới một chút)
   * thay vì chặn đối xứng, để nhãn vẫn được đứng SÁT phía trên trục — chỗ đó
   * hợp lệ và thường là chỗ đẹp nhất.
   */
  const deTrucNgang = (ty: number) => axisYpx > ty - fs * 0.85 && axisYpx < ty + fs * 0.12;
  /**
   * Nhãn phải ở CÙNG PHÍA trục hoành với chấm của nó.
   *
   * Lỗi thật: cực tiểu (1; −1) của y = x³ − 3x + 1 nằm dưới trục, nhưng nhãn
   * "CT(1; −1)" lại được đặt phía TRÊN trục — giữa nhãn và chấm có cả một đường
   * trục kẻ ngang chắn qua, mà lại còn gần nên không kẻ nét dẫn. Nhìn vào
   * tưởng nhãn của một điểm khác nằm trên trục.
   * Chấm nằm ngay trên trục (|py − trục| nhỏ) thì không xét, vì khi ấy "phía"
   * không có nghĩa.
   */
  /**
   * NHÃN KHÔNG ĐÈ LÊN ĐƯỜNG CONG.
   *
   * Đây là tiêu chuẩn thật, hơn mọi quy ước trên/dưới: đồ thị y = x⁴ − 2x² + 1
   * có hai cực tiểu nằm ngay trên trục hoành, xếp nhãn lên phía trên thì nhãn
   * "CT(1; 0)" nằm đúng trên nhánh đi lên của đường cong. Chữ có viền trắng nên
   * vẫn đọc được, nhưng đường cong bị chữ cắt mất một khúc — mà đường cong là
   * thứ chính của hình.
   * Thử 11 điểm dọc bề ngang nhãn; đường cong chạm dải chữ là chỗ đó bị loại.
   */
  const xTuPx = (px2: number) => xMin + ((px2 - p) * (xMax - xMin)) / (W - 2 * p);
  const hamDaBien = curves.map((c) => compileExpression(c.expression)).filter((c) => c.ok);
  const deDuongCong = (c: { ty: number; x0: number; x1: number }) => {
    const yA = c.ty - fs * 0.72, yB = c.ty + fs * 0.12;
    for (const ham of hamDaBien)
      for (let k = 0; k <= 10; k++) {
        const yv = ham.eval(xTuPx(c.x0 + ((c.x1 - c.x0) * k) / 10));
        if (!Number.isFinite(yv)) continue;
        const py2 = sy(yv);
        if (py2 > yA && py2 < yB) return true;
      }
    return false;
  };

  const khacPhiaTruc = (ty: number, py: number) => {
    if (Math.abs(py - axisYpx) <= fs * 0.3) return false;
    return py > axisYpx ? ty <= axisYpx : ty - fs * 0.72 >= axisYpx;
  };
  placedPoints.forEach((q, i) => {
    const wNhan = q.x1 - q.x0;
    const uu = q.below ? 1 : -1;
    /**
     * Thử lên/xuống trước, HẾT CHỖ THÌ SANG TRÁI / SANG PHẢI (V12.1).
     *
     * V12.0 chỉ đẩy theo chiều dọc. Với đồ thị phân thức có ba nhãn gần nhau
     * (CĐ, CT và tâm đối xứng I) thì cả ba xếp thành một cột dài, nhãn cuối bị
     * đẩy ra sát mép và đè lên đường cong.
     */
    type ChoDat = { tx: number; ty: number; anchor: "start" | "middle" | "end"; x0: number; x1: number; gia: number };
    const hopO = (tx2: number, an: "start" | "middle" | "end") => {
      const x0 = an === "middle" ? tx2 - wNhan / 2 : an === "start" ? tx2 : tx2 - wNhan;
      return { x0, x1: x0 + wNhan };
    };
    /**
     * Xếp chỗ đặt theo GIÁ = khoảng cách tới chấm + tiền phạt cho chỗ trái quy
     * ước, rồi chọn chỗ rẻ nhất còn trống.
     *
     * Vì sao phải xếp theo giá: bản đầu của V12.1 thử hết TÁM bậc theo chiều
     * dọc trước khi mới thử sang bên. Với đồ thị (x²+2x−2)/(x−1) — ba nhãn CĐ,
     * CT và tâm I gần nhau — nhãn "CĐ(0; 2)" bị đẩy lên ba dòng, đứng ngay
     * cạnh CHẤM cực tiểu (2; 6); ai đọc cũng tưởng chấm xanh là CĐ(0; 2). Nhãn
     * đứng sát chấm của mình mới là nhãn đúng, nên chỗ sát chấm phải được thử
     * TRƯỚC chỗ xa, kể cả khi nó nằm ngang thay vì nằm trên.
     */
    const thu: ChoDat[] = [];
    const them = (tx2: number, ty2: number, an: "start" | "middle" | "end", phat: number) =>
      thu.push({ tx: tx2, ty: ty2, anchor: an, ...hopO(tx2, an),
                 gia: Math.hypot(tx2 - q.px, ty2 - q.py) + phat });
    for (let k = 0; k < 4; k++) {
      them(q.tx, q.py + uu * (q.buoc1 + k * fs * 1.25), q.anchor, 0);
      them(q.tx, q.py - uu * (fs * 1.2 + k * fs * 1.25), q.anchor, fs * 0.7);
    }
    for (const dy of [fs * 0.33, -fs * 0.9, fs * 1.45]) {
      them(q.px + fs * 0.5, q.py + dy, "start", fs * 0.9);
      them(q.px - fs * 0.5, q.py + dy, "end", fs * 0.9);
    }
    /* Đè đường cong là một khoản TIỀN PHẠT, không phải một lệnh cấm.
       Lần đầu tôi cấm hẳn: nhãn "CĐ(0; 2)" của hàm (x²+2x−2)/(x−1) liền bị đẩy
       lên sát mép trên, còn "CT(2; 6)" thì rơi xuống cạnh vòng tròn tâm đối
       xứng — đọc vào tưởng tên của vòng tròn ấy. Nhãn đứng xa chấm của mình là
       lỗi NẶNG HƠN nhãn chạm đường cong, nên phải cân hai cái trên cùng một
       bàn cân chứ không xếp cái nào lên trước. */
    thu.forEach((c) => { if (deDuongCong(c)) c.gia += fs * 1.0; });
    thu.sort((a, b) => a.gia - b.gia);

    const hopLe = (c: ChoDat) => {
      if (c.x0 < 6 || c.x1 > W - 6) return false;
      if (!tronKhung(c.ty)) return false;
      if (deTrucNgang(c.ty)) return false;
      if (khacPhiaTruc(c.ty, q.py)) return false;
      const chongChu = vatCan.some((o) => !(o.x1 < c.x0 || o.x0 > c.x1) && Math.abs(o.y - c.ty) < fs * 1.05);
      if (chongChu) return false;
      return !placedPoints.some((o, j) => {
        if (j === i) return false;
        const chongNhan = j < i && !(o.x1 < c.x0 || o.x0 > c.x1) && Math.abs(o.ty - c.ty) < fs * 1.15;
        const phuCham = o.px > c.x0 - 10 && o.px < c.x1 + 10 && Math.abs(o.py - c.ty) < fs * 0.85;
        return chongNhan || phuCham;
      });
    };
    /* Lượt một đòi tránh cả đường cong; hết chỗ thì lượt hai bỏ đòi hỏi đó —
       thà chữ chạm đường cong (vẫn đọc được nhờ viền trắng) còn hơn nhãn bị
       đẩy ra chỗ không rõ của điểm nào. */
    const dat = thu.find(hopLe) ?? { ...thu[0], ty: Math.min(Math.max(thu[0].ty, fs * 0.9), H - 8) };
    q.tx = dat.tx; q.ty = dat.ty; q.anchor = dat.anchor; q.x0 = dat.x0; q.x1 = dat.x1;
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
      {shadeLabel && (
        <text x={shadeLabel.x} y={shadeLabel.y} className="graph-point-label svg-halo"
              style={{ fontSize: fs + 4, textAnchor: "middle" }}>{shadeLabel.text}</text>
      )}

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
          /* soVN: dấu thập phân là DẤU PHẨY theo chuẩn Việt Nam. Dãy vạch
             của đồ thị ∫ (4 − x²) đang in "4.5" và "1.5" kiểu Anh — trong khi
             biểu đồ hộp, biểu đồ cột đã ghi đúng "5,5" từ V12.0. */
          <text key={`tx${i}`} x={sx(t)} y={yCuaSoX(t)} textAnchor="middle">{soVN(t)}</text>
        ))}
        {tickY.map((t, i) => (
          <text key={`ty${i}`} x={(xMin <= 0 && xMax >= 0 ? sx(0) : p) - 12} y={sy(t) + fs / 3} textAnchor="end">{soVN(t)}</text>
        ))}
      </g>
      {/* Tên trục căn theo MÉP KHUNG, không theo mũi tên. V11.6 đặt tên trục
          hoành ở x = W - p + 6 với lối canh trái, nên nhãn dài như "x (sản
          phẩm)" chạy thẳng ra ngoài slide và bị cắt cụt. */}
      <text x={W - 8} y={(yMin <= 0 && yMax >= 0 ? sy(0) : H - p) - 14} textAnchor="end"
            className="axis-name svg-halo" style={{ fontSize: fs + 2 }}>{v.xLabel || "x"}</text>
      <text x={Math.min((xMin <= 0 && xMax >= 0 ? sx(0) : p) + 14, W - 8)} y={Math.max(fs + 4, p - 14)}
            textAnchor="start" className="axis-name svg-halo" style={{ fontSize: fs + 2 }}>{v.yLabel || "y"}</text>

      {/* tiệm cận — gồm cả đường tự dò được từ biểu thức */}
      {tiemCan.map((a, i) => {
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
      {placedPoints.map((q, i) => (
        <g key={i}>
          {/* Nhãn phải lệch khỏi chấm thì kẻ một nét mảnh nối lại, nếu không
              học sinh không biết nhãn nào của điểm nào — đúng lỗi hai nhãn
              CĐ/CT dính vào nhau ở bản V11.7. */}
          {q.leader && (
            <line x1={q.px} y1={q.py}
                  x2={Math.min(Math.max(q.px, q.x0), q.x1)} y2={q.ty + (q.below ? -fs * 0.32 : fs * 0.28)}
                  stroke="#8b9aa8" strokeWidth="1.6" strokeDasharray="4 3" />
          )}
          {/* Tâm đối xứng vẽ vòng tròn RỖNG: nó KHÔNG thuộc đồ thị (hàm phân
              thức không xác định tại hoành độ đó). Chấm đặc là nói sai. */}
          <circle cx={q.px} cy={q.py} r="8"
                  fill={q.kind === "center" ? "#fff" : pointFill[q.kind || "plain"]}
                  stroke={q.kind === "center" ? "#263746" : "#fff"} strokeWidth="2.4" />
          <text x={q.tx} y={q.ty} className="graph-point-label svg-halo"
                style={{ fontSize: fs, textAnchor: q.anchor }}>
            {q.label}
          </text>
        </g>
      ))}

      {/* chú giải nhiều đồ thị */}
      {rendered.length > 1 && (
        /* Chú giải xếp thành MỘT HÀNG ở lề trên, ngoài vùng vẽ. V12.0 đặt nó
           trong khung ở góc trên trái nên nó che đường cong, lưới và nhãn
           điểm — đúng lỗi mà miền nghiệm đã phải sửa. */
        <g className="graph-legend svg-halo" style={{ fontSize: fs }}>
          {rendered.map((r, i) => (
            <g key={i} transform={`translate(${p + i * ((W - 2 * p) / rendered.length)}, ${Math.max(fs * 0.95, p * 0.5)})`}>
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
  let content = null;
  switch (visual.type) {
    case "formula": content = <Formula v={visual} />; break;
    case "variation_table": content = <VariationTable v={visual} />; break;
    case "sign_chart": content = <SignChart v={visual} />; break;
    case "graph": content = <Graph v={visual} />; break;
    default: content = isExtraVisual(visual) ? <ExtraVisual visual={visual} /> : null;
  }
  const size = Math.max(20, Math.min(48, visual.fontSize ?? 32));
  return <div className="math-visual-size" style={{ "--visual-font-scale": size / 32 } as CSSProperties}>{content}</div>;
}

export { VISUAL_LABEL } from "@/lib/themes";
