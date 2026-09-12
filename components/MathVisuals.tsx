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
  const caption = tableCaption(v);
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

  const n = Math.max(2, v.x.length);
  // Chừa lề sau vạch dọc: V10 đặt mốc đầu tiên ngay trên vạch nên "-∞" bị vạch cắt đôi.
  const padIn = 44;
  const step = (W - L - padIn - 30) / (n - 1);
  const xs = Array.from({ length: n }, (_, i) => L + padIn + i * step);
  const dis = new Map((v.discontinuities ?? []).map((d) => [d.index, d]));

  const { left, right } = computeLevels(v);
  const all = [...left, ...right];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = Math.max(1, hi - lo);
  const yOfLevel = (lv: number) => yBottom - ((lv - lo) / span) * (yBottom - yTop);
  const yOfNode = (i: number, side: "l" | "r", raw: string) => {
    if (isPlusInf(raw)) return yTop;
    if (isMinusInf(raw)) return yBottom;
    return yOfLevel(side === "l" ? left[i] : right[i]);
  };

  const der = v.derivative ?? [];
  const full = der.length >= 2 * n - 3;
  const intervalSign = (i: number) => (full ? der[i * 2] : der[i]) ?? "";
  const nodeSign = (i: number) => (full ? der[i * 2 + 1] : "0") ?? "0";
  const vals = Array.from({ length: n }, (_, i) => v.values?.[i] ?? "");

  return (
    <svg className="variation-svg" viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label={`Bảng biến thiên${v.label ? " của " + v.label : ""}`}>
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
        <text key={`x${i}`} x={x} y={xRow - 18} className="bbt-text" style={{ fontSize: fs }}>{plainMath(v.x[i] ?? "")}</text>
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
        const y1 = yOfNode(i, "r", vals[i]);
        const y2 = yOfNode(i + 1, "l", vals[i + 1]);
        const x1 = xs[i] + fs;
        const x2 = xs[i + 1] - fs;
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
              <text x={xs[i] - 16} y={yOfNode(i, "l", d.leftValue)} textAnchor="end" className="bbt-value" style={{ fontSize: fs }}>
                {plainMath(d.leftValue)}
              </text>
              <text x={xs[i] + 16} y={yOfNode(i, "r", d.rightValue)} textAnchor="start" className="bbt-value" style={{ fontSize: fs }}>
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
                {plainMath((full ? signs[i * 2 + 1] : "0") ?? "0")}
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
  const p = 84;
  const xMin = v.xMin, xMax = v.xMax, yMin = v.yMin, yMax = v.yMax;
  const sx = (x: number) => p + ((x - xMin) * (W - 2 * p)) / (xMax - xMin);
  const sy = (y: number) => H - p - ((y - yMin) * (H - 2 * p)) / (yMax - yMin);

  const curves = v.expressions?.length
    ? v.expressions
    : [{ expression: v.expression, label: undefined as string | undefined, color: undefined as string | undefined, dashed: false }];

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
      {v.asymptotes?.map((a, i) => {
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
      {v.points?.map((q, i) => {
        /**
         * Nhãn điểm đặt THẲNG TRÊN hoặc THẲNG DƯỚI chấm, không đặt chéo sang
         * phải như V11.5. Ở cỡ chữ 34 px, nhãn "CĐ(-1; 3)" dài gần 200 px —
         * đặt chéo là đè lên trục Oy và nuốt mất số trên trục.
         * Cực tiểu ghi xuống dưới, còn lại ghi lên trên: đó là phía luôn trống.
         */
        const label = q.label || `(${q.x}; ${q.y})`;
        const below = q.kind === "min";
        const half = (label.length * fs * 0.54) / 2;
        let cx = Math.min(Math.max(sx(q.x), p + half), W - p - half);

        /**
         * Hai chỗ nhãn hay đè lên số trên trục, đều chỉ lộ ra khi chữ to:
         *  - điểm nằm sát trục Ox (cực trị có tung độ 0): nhãn ghi xuống dưới sẽ
         *    rơi đúng vào hàng số của trục hoành -> đẩy xuống thêm một dòng;
         *  - điểm nằm sát trục Oy (hoành độ 0): nhãn canh giữa sẽ phủ lên số
         *    trên trục tung -> lệch hẳn sang một bên.
         */
        const axisY = yMin <= 0 && yMax >= 0 ? sy(0) : H - p;
        const axisX = xMin <= 0 && xMax >= 0 ? sx(0) : p;
        const chamTrucNgang = Math.abs(sy(q.y) - axisY) < fs * 1.2;
        if (Math.abs(sx(q.x) - axisX) < half) {
          const sangPhai = sx(q.x) + half * 2 + fs * 0.5 < W - p;
          cx = sangPhai ? axisX + half + fs * 0.6 : axisX - half - fs * 0.6;
        }
        return (
          <g key={i}>
            <circle cx={sx(q.x)} cy={sy(q.y)} r="8" fill={pointFill[q.kind || "plain"]} stroke="#fff" strokeWidth="2" />
            <text
              x={cx}
              y={sy(q.y) + (below ? fs * (chamTrucNgang ? 2.35 : 1.2) : -fs * 0.55)}
              textAnchor="middle"
              className="graph-point-label svg-halo"
              style={{ fontSize: fs }}
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* chú giải nhiều đồ thị */}
      {rendered.length > 1 && (
        <g className="graph-legend svg-halo" style={{ fontSize: fs }}>
          {rendered.map((r, i) => (
            <g key={i} transform={`translate(${p + 10}, ${p + fs + i * (fs + 10)})`}>
              <line x1="0" x2="34" y1="0" y2="0" stroke={r.color} strokeWidth="4"
                    strokeDasharray={r.dashed ? "8 5" : undefined} />
              <text x="42" y={fs / 3}>{r.label || r.expression}</text>
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
