"use client";
/**
 * components/MathVisualsExtra.tsx — Các loại hình bổ sung cho Chương trình GDPT 2018 (V11)
 *
 * V10 chỉ dựng được 4 loại hình phục vụ chương "Khảo sát hàm số" (lớp 12).
 * Toàn bộ mạch Thống kê - Xác suất (có ở cả ba khối), Hình học không gian (11, 12),
 * Vectơ (10, 12), Lượng giác (11), Bất phương trình bậc nhất hai ẩn (10)
 * đều không có hình minh hoạ. Tệp này bù đắp phần đó.
 */

import { useId, useState } from "react";
import { compileExpression } from "@/lib/mathexpr";
import type {
  Visual, StatChartVisual, BoxPlotVisual, ProbTreeVisual, UnitCircleVisual,
  NumberLineVisual, RegionVisual, Solid3DVisual, OxyzVisual, VectorVisual,
  VennVisual, TableVisual, QuizVisual,
} from "@/lib/types";
import { NL_HEAD, NL_ROW_H, NL_W, svgFontPx } from "@/lib/slides";
import { beRongChu, chamNhau, chonChoDat, gocChuan, gocRadian, soVN, ticksFit, ticksFitDoc, type OChu } from "@/lib/plot";
import { MixedMath } from "./MathText";

const PALETTE = ["#17324D", "#E4572E", "#0E8A72", "#F2A541", "#6C63A6", "#3C8DAD", "#B91C1C", "#1D4ED8"];

const EXTRA_TYPES = new Set([
  "stat_chart", "box_plot", "prob_tree", "unit_circle", "number_line",
  "inequality_region", "solid_3d", "oxyz", "vector_2d", "venn", "data_table", "quiz",
]);

export function isExtraVisual(v: Visual): boolean {
  return EXTRA_TYPES.has(v.type);
}

/* ------------------------------------------------------------------ */
/* Thống kê: cột, ngang, tròn, đường, tần số ghép nhóm                 */
/* ------------------------------------------------------------------ */

/**
 * Màu chữ đặt trên một nền màu: trắng nếu nền tối, xanh đậm nếu nền sáng.
 * Dùng độ sáng cảm nhận (0,299R + 0,587G + 0,114B) theo khuyến nghị tiếp cận.
 */
function chuTrenNen(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#17283A";
  const n = parseInt(m[1], 16);
  const sang = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return sang < 0.62 ? "#FFFFFF" : "#17283A";
}

function StatChart({ v }: { v: StatChartVisual }) {
  const W = 880, H = 470;
  // Lề trái phải chứa nổi nhãn trục tung ở cỡ chữ mới (ví dụ "100"), nếu không
  // số bị đẩy ra ngoài khung — 56 px của V11.5 vừa đủ cho chữ 13 px mà thôi.
  const p = 118;
  const series = v.series ?? [];
  const labels = v.labels ?? [];

  if (v.chart === "pie") {
    const values = series[0]?.values ?? [];
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const fsPie = svgFontPx(W, H);
    const cx = 290, cy = H / 2 + fsPie * 0.5, r = 170;
    let acc = -Math.PI / 2;
    return (
      <svg className="stat-svg" viewBox={`0 0 ${W} ${H}`} role="img" style={{ fontSize: svgFontPx(W, H) }} aria-label={v.title || "Biểu đồ hình quạt"}>
        <rect width={W} height={H} fill="#fff" rx="12" />
        {v.title && <text x={W / 2} y={fsPie * 1.15} textAnchor="middle" className="chart-title">{v.title}</text>}
        {values.map((val, i) => {
          const ang = (val / total) * Math.PI * 2;
          const x1 = cx + r * Math.cos(acc), y1 = cy + r * Math.sin(acc);
          const x2 = cx + r * Math.cos(acc + ang), y2 = cy + r * Math.sin(acc + ang);
          const mid = acc + ang / 2;
          const d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${ang > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
          acc += ang;
          const pct = ((val / total) * 100).toFixed(1).replace(/\.0$/, "");
          return (
            <g key={i}>
              <path d={d} fill={PALETTE[i % PALETTE.length]} stroke="#fff" strokeWidth="2" />
              {/* Chữ phần trăm nằm TRÊN lát quạt, nên màu chữ phải theo độ sáng
                  của lát. V11 để một màu xám đậm cho mọi lát: trên lát navy
                  #17324D thì gần như không đọc được. */}
              <text x={cx + r * 0.62 * Math.cos(mid)} y={cy + r * 0.62 * Math.sin(mid) + fsPie / 3}
                    textAnchor="middle" className="chart-slice"
                    fill={chuTrenNen(PALETTE[i % PALETTE.length])}>{pct.replace(".", ",")}%</text>
            </g>
          );
        })}
        <g className="chart-legend">
          {labels.map((l, i) => (
            <g key={i} transform={`translate(${cx + r + 60}, ${cy - ((labels.length - 1) * fsPie * 1.6) / 2 + i * fsPie * 1.6})`}>
              <rect width={fsPie * 0.85} height={fsPie * 0.85} y={-fsPie * 0.7} rx="3" fill={PALETTE[i % PALETTE.length]} />
              <text x={fsPie * 1.3}>{l}</text>
            </g>
          ))}
        </g>
      </svg>
    );
  }

  const isHistogram = v.chart === "histogram";
  const isRow = v.chart === "bar";
  const flatMax = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = Math.ceil(flatMax / 5) * 5 || 1;
  /**
   * V11.6: chữ trong hình to gấp gần ba lần nên mọi khoảng chừa cũ đều hụt —
   * tên trục đè lên tiêu đề, nhãn cột đè lên trục hoành. Các mốc dưới đây tính
   * theo chính cỡ chữ (fs) chứ không phải theo số px cố định, nên còn đúng cả
   * khi sau này khung vẽ thay đổi.
   */
  const fs = svgFontPx(W, H);
  /**
   * Tên trục tung có DẢI RIÊNG dưới tiêu đề.
   *
   * V11.6 đặt nó ở x = 8, y = titleH + 1,85fs — tức là chen vào đúng hàng số
   * của trục tung. Kết quả: vạch 16 của biểu đồ "Xếp loại học lực" bị chữ
   * "Số học sinh" phủ mất, dãy vạch đọc ra thành 0; 4; 8; 12; 20 — một giáo
   * viên Toán nhìn là thấy sai ngay.
   */
  const titleH = v.title ? fs * 1.5 : fs * 0.4;
  const yLabelH = v.yLabel ? fs * 1.75 : 0;
  const bottomH = fs * (v.xLabel ? 3.0 : 1.9) + (series.length > 1 ? fs * 1.6 : 0);
  const plotW = W - p - fs * 0.8, plotH = H - titleH - yLabelH - bottomH;
  const x0 = p, y0 = H - bottomH;

  const groups = isHistogram ? (v.bins?.length ? v.bins.length - 1 : labels.length) : labels.length;
  const groupW = plotW / Math.max(1, groups);
  const barW = isHistogram ? groupW : (groupW * 0.68) / Math.max(1, series.length);

  return (
    <svg className="stat-svg" viewBox={`0 0 ${W} ${H}`} role="img" style={{ fontSize: svgFontPx(W, H) }} aria-label={v.title || "Biểu đồ thống kê"}>
      <rect width={W} height={H} fill="#fff" rx="12" />
      {v.title && <text x={W / 2} y={fs * 1.15} textAnchor="middle" className="chart-title">{v.title}</text>}
      {/* lưới ngang + trục giá trị */}
      {Array.from({ length: 6 }, (_, i) => {
        const val = (niceMax * i) / 5;
        const y = y0 - (plotH * i) / 5;
        return (
          <g key={i}>
            <line x1={x0} x2={x0 + plotW} y1={y} y2={y} stroke="#E2EAF1" />
            <text x={x0 - fs * 0.4} y={y + fs / 3} textAnchor="end" className="chart-tick">{soVN(val)}</text>
          </g>
        );
      })}
      <line x1={x0} x2={x0 + plotW} y1={y0} y2={y0} stroke="#263746" strokeWidth="1.6" />
      <line x1={x0} x2={x0} y1={y0} y2={y0 - plotH} stroke="#263746" strokeWidth="1.6" />
      {/* Tên trục tung đặt NGAY TRÊN đầu trục, canh trái — V11.5 đặt lệch sang
          trái 40 px nên ở cỡ chữ lớn nó chạy ra ngoài khung và đè lên tiêu đề. */}
      {v.yLabel && <text x={8} y={titleH + fs * 1.1} textAnchor="start" className="chart-axis">{v.yLabel}</text>}
      {v.xLabel && <text x={x0 + plotW} y={y0 + fs * 2.6} textAnchor="end" className="chart-axis">{v.xLabel}</text>}

      {v.chart === "line"
        ? series.map((s, si) => {
            const d = s.values.map((val, i) =>
              `${i ? "L" : "M"} ${(x0 + groupW * (i + 0.5)).toFixed(1)} ${(y0 - (val / niceMax) * plotH).toFixed(1)}`).join(" ");
            return (
              <g key={si}>
                <path d={d} fill="none" stroke={s.color || PALETTE[si % PALETTE.length]} strokeWidth="3" />
                {s.values.map((val, i) => (
                  <circle key={i} cx={x0 + groupW * (i + 0.5)} cy={y0 - (val / niceMax) * plotH} r="4.5"
                          fill={s.color || PALETTE[si % PALETTE.length]} />
                ))}
              </g>
            );
          })
        : series.map((s, si) =>
            s.values.map((val, i) => {
              const h = (val / niceMax) * plotH;
              const bx = isHistogram ? x0 + groupW * i : x0 + groupW * i + groupW * 0.16 + si * barW;
              return (
                <g key={`${si}-${i}`}>
                  <rect x={bx} y={y0 - h} width={Math.max(2, barW - (isHistogram ? 0 : 3))} height={h}
                        fill={s.color || PALETTE[si % PALETTE.length]}
                        stroke={isHistogram ? "#fff" : "none"} rx={isHistogram ? 0 : 3} />
                  {v.showValues !== false && (
                    <text x={bx + barW / 2} y={y0 - h - fs * 0.35} textAnchor="middle" className="chart-value svg-halo">{soVN(val)}</text>
                  )}
                </g>
              );
            }),
          )}

      {/* nhãn trục hoành */}
      {isHistogram && v.bins?.length
        ? v.bins.map((b, i) => (
            <text key={i} x={x0 + groupW * i} y={y0 + fs * 1.15} textAnchor="middle" className="chart-tick">{soVN(b)}</text>
          ))
        : labels.map((l, i) => (
            <text key={i} x={x0 + groupW * (i + 0.5)} y={y0 + fs * 1.15} textAnchor="middle" className="chart-tick">{l}</text>
          ))}

      {series.length > 1 && (
        <g className="chart-legend">
          {series.map((s, i) => (
            <g key={i} transform={`translate(${x0 + i * (W / Math.max(2, series.length))}, ${H - fs * 0.4})`}>
              <rect width={fs * 0.8} height={fs * 0.8} y={-fs * 0.7} rx="3" fill={s.color || PALETTE[i % PALETTE.length]} />
              <text x={fs * 1.2}>{s.name || `Nhóm ${i + 1}`}</text>
            </g>
          ))}
        </g>
      )}
      {isRow && <title>Biểu đồ cột</title>}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Biểu đồ hộp (tứ phân vị)                                            */
/* ------------------------------------------------------------------ */

function BoxPlot({ v }: { v: BoxPlotVisual }) {
  /**
   * V11.5 ghi cả năm con số (min, Q₁, Q₂, Q₃, max) ngay cạnh hộp. Ở cỡ chữ 13 px
   * còn tạm đọc được; ở cỡ 33 px thì "Q₁=5.5" và "Q₂=7" chồng lên nhau thành
   * một vệt đen. V11.6 chỉ ghi min và max ở hai đầu râu, còn ba tứ phân vị xếp
   * so le trên – dưới – trên để luôn có khoảng hở.
   */
  const W = 900, H = 190 + v.groups.length * 100, p = 150;
  const fs = svgFontPx(W, H);
  const all = v.groups.flatMap((g) => [g.min, g.max, ...(g.outliers ?? [])]);
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 1;
  const left = p + fs * 0.6;
  const right = W - fs * 1.6;
  const sx = (x: number) => left + ((x - (lo - pad)) * (right - left)) / (hi - lo + 2 * pad);
  /**
   * TRỤC SỐ CHUNG cho mọi nhóm. V11 không vẽ trục nào: hai hộp nằm cạnh nhau
   * mà không có thước đo, nên không đọc được giá trị ngoại lệ nằm ở đâu — mà so
   * sánh các nhóm chính là việc duy nhất của biểu đồ hộp.
   */
  const vachTruc = ticksFit(lo - pad, hi + pad, right - left, fs);
  const yTruc = H - fs * (v.unit ? 2.4 : 1.1);

  return (
    <svg className="stat-svg" viewBox={`0 0 ${W} ${H}`} role="img" style={{ fontSize: svgFontPx(W, H) }} aria-label={v.title || "Biểu đồ hộp"}>
      <rect width={W} height={H} fill="#fff" rx="12" />
      {v.title && <text x={W / 2} y={fs * 1.15} textAnchor="middle" className="chart-title">{v.title}</text>}
      {v.groups.map((g, i) => {
        const cy = fs * (v.title ? 2.6 : 1.2) + 100 * i + 46;
        const c = PALETTE[i % PALETTE.length];
        return (
          <g key={i}>
            <text x={left - fs * 0.4} y={cy + fs / 3} textAnchor="end" className="chart-tick">{g.name}</text>
            <line x1={sx(g.min)} x2={sx(g.q1)} y1={cy} y2={cy} stroke={c} strokeWidth="2" />
            <line x1={sx(g.q3)} x2={sx(g.max)} y1={cy} y2={cy} stroke={c} strokeWidth="2" />
            <line x1={sx(g.min)} x2={sx(g.min)} y1={cy - 16} y2={cy + 16} stroke={c} strokeWidth="3" />
            <line x1={sx(g.max)} x2={sx(g.max)} y1={cy - 16} y2={cy + 16} stroke={c} strokeWidth="3" />
            <rect x={sx(g.q1)} y={cy - 24} width={Math.max(2, sx(g.q3) - sx(g.q1))} height="48"
                  fill={`${c}22`} stroke={c} strokeWidth="3" rx="3" />
            <line x1={sx(g.median)} x2={sx(g.median)} y1={cy - 24} y2={cy + 24} stroke={c} strokeWidth="4.5" />
            {(g.outliers ?? []).map((o, j) => (
              <circle key={j} cx={sx(o)} cy={cy} r="7" fill="none" stroke="#B91C1C" strokeWidth="3" />
            ))}
            <g className="chart-tick svg-halo">
              <text x={sx(g.min)} y={cy + 24 + fs * 0.95} textAnchor="middle">{soVN(g.min)}</text>
              <text x={sx(g.q1)} y={cy - 24 - fs * 0.3} textAnchor="middle">{soVN(g.q1)}</text>
              <text x={sx(g.median)} y={cy + 24 + fs * 0.95} textAnchor="middle">{soVN(g.median)}</text>
              <text x={sx(g.q3)} y={cy - 24 - fs * 0.3} textAnchor="middle">{soVN(g.q3)}</text>
              <text x={sx(g.max)} y={cy + 24 + fs * 0.95} textAnchor="middle">{soVN(g.max)}</text>
            </g>
          </g>
        );
      })}
      {/* Trục số chung, vẽ SAU các hộp để nét trục luôn nằm trên cùng */}
      <g>
        <line x1={left} x2={right} y1={yTruc} y2={yTruc} stroke="#263746" strokeWidth="1.8" />
        <g className="chart-tick" fill="#5A6B7B">
          {vachTruc.map((t, i) => (
            <g key={i}>
              <line x1={sx(t)} x2={sx(t)} y1={yTruc} y2={yTruc + fs * 0.25} stroke="#263746" strokeWidth="1.5" />
              <text x={sx(t)} y={yTruc + fs * 1.15} textAnchor="middle">{soVN(t)}</text>
            </g>
          ))}
        </g>
      </g>
      {/* Đơn vị ghi dưới trục, bên phải — đặt cạnh tiêu đề thì nó đè lên nhãn
          tứ phân vị của nhóm trên cùng. */}
      {v.unit && <text x={right} y={H - fs * 0.25} textAnchor="end" className="chart-axis">Đơn vị: {v.unit}</text>}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Sơ đồ cây xác suất                                                  */
/* ------------------------------------------------------------------ */

function ProbTree({ v }: { v: ProbTreeVisual }) {
  const leaves = v.branches.reduce((n, b) => n + Math.max(1, b.children?.length ?? 0), 0);
  const W = 860, H = Math.max(300, 80 + leaves * 78);
  const x0 = 60, x1 = 280, x2 = 540;
  const cy = H / 2;
  let row = 0;

  return (
    <svg className="tree-svg" viewBox={`0 0 ${W} ${H}`} role="img" style={{ fontSize: svgFontPx(W, H) }} aria-label="Sơ đồ cây xác suất">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <circle cx={x0} cy={cy} r="7" fill="#17324D" />
      <text x={x0} y={cy - 16} textAnchor="middle" className="tree-node">{v.root || "Bắt đầu"}</text>
      {v.branches.map((b, i) => {
        const kids = b.children?.length ? b.children : [null];
        const startRow = row;
        const ys = kids.map(() => 40 + (row++ + 0.5) * ((H - 60) / Math.max(1, leaves)));
        const by = ys.reduce((a, c) => a + c, 0) / ys.length;
        const color = PALETTE[i % PALETTE.length];
        return (
          <g key={i}>
            <line x1={x0 + 8} y1={cy} x2={x1 - 8} y2={by} stroke={color} strokeWidth="2.2" />
            <text x={(x0 + x1) / 2} y={(cy + by) / 2 - 8} textAnchor="middle" className="tree-prob">{b.p}</text>
            <circle cx={x1} cy={by} r="7" fill={color} />
            <text x={x1} y={by - 16} textAnchor="middle" className="tree-node">{b.label}</text>
            {b.children?.map((c, j) => (
              <g key={j}>
                <line x1={x1 + 8} y1={by} x2={x2 - 8} y2={ys[j]} stroke={color} strokeWidth="2" opacity="0.75" />
                <text x={(x1 + x2) / 2} y={(by + ys[j]) / 2 - 8} textAnchor="middle" className="tree-prob">{c.p}</text>
                <circle cx={x2} cy={ys[j]} r="6" fill={color} opacity="0.8" />
                <text x={x2 + 14} y={ys[j] + 5} className="tree-node" textAnchor="start">
                  {c.label}{c.result ? ` → ${c.result}` : ""}
                </text>
              </g>
            ))}
            {startRow >= 0 && null}
          </g>
        );
      })}
      {v.caption && <text x={W / 2} y={H - 10} textAnchor="middle" className="visual-caption-svg">{v.caption}</text>}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Đường tròn lượng giác                                               */
/* ------------------------------------------------------------------ */

/* parseAngle chuyển sang lib/plot.ts với tên gocRadian — xem lời giải thích
   về lỗi "2\\pi/3 hoá 23,14" ở đó. Giữ tên cũ cho phần còn lại của tệp. */
const parseAngle = gocRadian;

function UnitCircle({ v }: { v: UnitCircleVisual }) {
  /**
   * ĐƯỜNG TRÒN LƯỢNG GIÁC — V12.0 bổ sung ba thứ SGK nào cũng có mà V11 thiếu.
   *
   * 1. Bốn điểm đặc biệt A(1; 0), A'(-1; 0), B(0; 1), B'(0; -1). Thiếu chúng thì
   *    đường tròn chỉ là một vòng trơn, không chỉ được chiều dương hay gốc đo.
   * 2. Chiều dương của góc, vẽ bằng một cung có mũi.
   * 3. Nhãn O nằm LỆCH khỏi gốc, không cưỡi lên chấm gốc như V11.
   *
   * Khung cũng thu lại (900 → 740 px) vì đường tròn chỉ chiếm 44 % bề ngang,
   * phần trống đó làm ảnh bị thu nhỏ thêm khi đưa lên slide.
   */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ucId = `ucArrow${uid}`;
  const W = 740, H = 600;
  const fs = svgFontPx(W, H);
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W / 2 - fs * 3.2, H / 2 - fs * 2.4);
  const px = (a2: number) => cx + R * Math.cos(a2);
  const py = (a2: number) => cy - R * Math.sin(a2);
  const show = new Set(v.show ?? []);

  return (
    <svg className="circle-svg" viewBox={`0 0 ${W} ${H}`} role="img" style={{ fontSize: fs }} aria-label="Đường tròn lượng giác">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <defs>
        <marker id={ucId} markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="#0E8A72" />
        </marker>
      </defs>
      <line x1={cx - R - fs * 0.9} x2={cx + R + fs * 0.9} y1={cy} y2={cy} stroke="#263746" strokeWidth="1.5" />
      <line y1={cy + R + fs * 0.9} y2={cy - R - fs * 0.9} x1={cx} x2={cx} stroke="#263746" strokeWidth="1.5" />
      <text x={cx + R + fs * 1.05} y={cy + fs * 0.33} className="chart-axis">cos</text>
      <text x={cx + fs * 0.35} y={cy - R - fs * 1.05} className="chart-axis">sin</text>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#17324D" strokeWidth="2.4" />

      {/* Bốn điểm đặc biệt và chiều dương */}
      <g className="chart-tick svg-halo">
        {([
          ["A", 0, fs * 0.9, fs * 1.05],
          ["B", Math.PI / 2, -fs * 0.5, -fs * 0.5],
          ["A′", Math.PI, -fs * 0.9, fs * 1.05],
          ["B′", -Math.PI / 2, -fs * 0.5, fs * 1.2],
        ] as [string, number, number, number][]).map(([ten, ang, ddx, ddy]) => (
          <g key={ten}>
            <circle cx={px(ang)} cy={py(ang)} r="5" fill="#17324D" />
            <text x={px(ang) + ddx} y={py(ang) + ddy} textAnchor={ddx < 0 ? "end" : "start"}>{ten}</text>
          </g>
        ))}
      </g>
      <path d={`M ${px(0.22)} ${py(0.22)} A ${R * 0.99} ${R * 0.99} 0 0 0 ${px(0.72)} ${py(0.72)}`}
            fill="none" stroke="#0E8A72" strokeWidth="2.6" markerEnd={`url(#${ucId})`} />

      {show.has("tan") && (
        <>
          <line x1={cx + R} x2={cx + R} y1={cy - R - fs * 0.6} y2={cy + R + fs * 0.6} stroke="#B45309" strokeWidth="1.8" strokeDasharray="6 4" />
          <text x={cx + R + fs * 0.35} y={cy - R - fs * 0.8} className="chart-tick" fill="#B45309">tan</text>
        </>
      )}
      {show.has("cot") && (
        <>
          <line y1={cy - R} y2={cy - R} x1={cx - R - fs * 0.6} x2={cx + R + fs * 0.6} stroke="#6D28D9" strokeWidth="1.8" strokeDasharray="6 4" />
          <text x={cx - R - fs * 0.75} y={cy - R - fs * 0.35} textAnchor="end" className="chart-tick" fill="#6D28D9">cot</text>
        </>
      )}

      {v.arcs?.map((a2, i) => {
        /**
         * Cung nghiệm luôn đi theo CHIỀU DƯƠNG từ `from` sang `to`.
         *
         * V12.0 lấy `Math.abs(to - from)` trên góc thô. Hai góc viết ở dạng
         * khác nhau (ví dụ 2π/3 và −4π/3 là cùng một tia) cho hiệu số lớn hơn
         * π nên cờ "cung lớn" bật lên, phần tô đi đường dài quanh gần hết
         * đường tròn. Nay chuẩn hoá về [0; 2π) rồi đo đúng bề rộng cung theo
         * chiều dương, nên cờ ấy chỉ bật khi cung THẬT SỰ lớn hơn nửa vòng.
         */
        const from = gocRadian(a2.from), to = gocRadian(a2.to);
        const rong = gocChuan(to - from);
        const big = rong > Math.PI ? 1 : 0;
        const den = from + rong;   // luôn nằm cùng phía dương với `from`
        return (
          <g key={i}>
            <path d={`M ${cx} ${cy} L ${px(from).toFixed(1)} ${py(from).toFixed(1)} A ${R} ${R} 0 ${big} 0 ${px(den).toFixed(1)} ${py(den).toFixed(1)} Z`}
                  fill="#0E8A7233" stroke="#0E8A72" strokeWidth="1.8" />
          </g>
        );
      })}

      {v.angles?.map((a2, i) => {
        const ang = parseAngle(a2.value);
        const color = a2.color || PALETTE[i % PALETTE.length];
        const cosA = Math.cos(ang), sinA = Math.sin(ang);
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={px(ang)} y2={py(ang)} stroke={color} strokeWidth="2.8" />
            <circle cx={px(ang)} cy={py(ang)} r="6.5" fill={color} stroke="#fff" strokeWidth="1.4" />
            {show.has("sin") && <line x1={px(ang)} y1={py(ang)} x2={cx} y2={py(ang)} stroke={color} strokeDasharray="5 4" strokeWidth="1.6" />}
            {show.has("cos") && <line x1={px(ang)} y1={py(ang)} x2={px(ang)} y2={cy} stroke={color} strokeDasharray="5 4" strokeWidth="1.6" />}
            <text x={cx + (R + fs * 0.85) * cosA} y={cy - (R + fs * 0.85) * sinA + fs * 0.33}
                  textAnchor={cosA < -0.3 ? "end" : cosA > 0.3 ? "start" : "middle"}
                  className="circle-label svg-halo" fill={color}>
              {a2.label || a2.value}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="4.5" fill="#263746" />
      <text x={cx - fs * 0.4} y={cy + fs} textAnchor="end" className="chart-tick svg-halo">O</text>

      {/**
        * TÊN CUNG NGHIỆM — chú giải ở lề dưới, NGOÀI đường tròn.
        *
        * lib/types.ts cho khai báo `arcs[].label` từ V11 mà hình chưa bao giờ
        * vẽ ra: bài giải phương trình lượng giác tô một vệt màu rồi không nói
        * vệt ấy là gì. Tôi thử viết vào giữa phần tô trước, nhưng chữ "Cung
        * nghiệm" rộng hơn cả cung 60° nên nó tràn ra đè lên đường tròn và mũi
        * chiều dương — đúng lỗi mà miền nghiệm đã phải sửa ở V12.0. Rồi tôi
        * hạ xuống lề dưới, nó đè luôn vào nhãn B′. Góc TRÊN BÊN TRÁI là chỗ
        * duy nhất thật sự trống: nhãn góc thấp nhất ở đó cũng còn cách hơn một
        * dòng chữ.
        */}
      {(v.arcs ?? []).some((a2) => a2.label) && (
        /* Cỡ chữ ĐÚNG fs, không thu nhỏ: 32 pt là mức sàn cứng của phần mềm
             này, chú giải cũng là chữ học sinh phải đọc. */
        <g className="chart-tick" style={{ fontSize: fs }}>
          {(v.arcs ?? []).filter((a2) => a2.label).map((a2, i) => (
            <g key={i} transform={`translate(${fs * 0.5}, ${fs * (0.9 + i * 1.05)})`}>
              <rect x="0" y={-fs * 0.62} width={fs * 0.7} height={fs * 0.7} fill="#0E8A7255" stroke="#0E8A72" strokeWidth="1.6" />
              <text x={fs * 1.05} y="0">{a2.label}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Trục số                                                             */
/* ------------------------------------------------------------------ */

function NumberLine({ v }: { v: NumberLineVisual }) {
  /**
   * TRỤC SỐ — V12.0 sửa ba thứ.
   *
   * 1. V11 chỉ vẽ ba vạch chia: min, trung điểm, max. Trục [-5; 5] hiện ra
   *    đúng "-5  0  5", nên không đọc được mút khoảng [-3; 2) nằm ở đâu.
   * 2. Mỗi khoảng vẽ trên một hàng riêng nhưng KHÔNG có gì nối hàng đó với
   *    trục, nên mắt phải tự ước lượng. Nay có nét đứt dóng từ hai mút lên trục.
   * 3. Nhãn khoảng ghi giữa hàng, chạm vào chấm mút khi khoảng ngắn. Nay ghi ở
   *    đầu bên phải hàng, chỗ luôn trống.
   */
  const nlId = `nlArrow${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const hasPoints = !!v.points?.length;
  const W = NL_W;
  const H = NL_HEAD + (v.intervals.length + (hasPoints ? 1 : 0)) * NL_ROW_H;
  const fs = svgFontPx(W, H);
  const p = fs * 2.2;
  const sx = (x: number) => p + ((x - v.min) * (W - 2 * p)) / (v.max - v.min);
  const val = (t: number | "-inf" | "+inf") => (t === "-inf" ? v.min : t === "+inf" ? v.max : t);
  const ticks = v.ticks?.length ? v.ticks : ticksFit(v.min, v.max, W - 2 * p, fs);
  // Trục nằm dưới hàng số, cách đúng một dòng chữ — V11.5 để 34 px cố định nên
  // khi chữ to lên, số trên trục đè lên chính cái trục.
  const axisY = fs * 1.5;
  const hangY = (i: number) => axisY + fs * 1.15 + (hasPoints ? NL_ROW_H : 0) + i * NL_ROW_H;

  return (
    <svg className="numline-svg" viewBox={`0 0 ${W} ${H}`} role="img" style={{ fontSize: fs }} aria-label="Trục số">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <defs>
        <marker id={nlId} markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="#263746" />
        </marker>
      </defs>

      {/* Nét dóng từ hai mút mỗi khoảng lên trục */}
      {v.intervals.map((iv, i) => {
        const y = hangY(i);
        return (
          <g key={`d${i}`} stroke="#CBD6DE" strokeWidth="1.4" strokeDasharray="5 4">
            {iv.from !== "-inf" && <line x1={sx(val(iv.from))} x2={sx(val(iv.from))} y1={axisY} y2={y} />}
            {iv.to !== "+inf" && <line x1={sx(val(iv.to))} x2={sx(val(iv.to))} y1={axisY} y2={y} />}
          </g>
        );
      })}

      <line x1={p - fs * 0.7} x2={W - p + fs * 0.7} y1={axisY} y2={axisY} stroke="#263746" strokeWidth="1.8" markerEnd={`url(#${nlId})`} />
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={sx(t)} x2={sx(t)} y1={axisY - fs * 0.26} y2={axisY + fs * 0.26} stroke="#263746" strokeWidth="2" />
          <text x={sx(t)} y={axisY - fs * 0.6} textAnchor="middle" className="chart-tick svg-halo">{soVN(t)}</text>
        </g>
      ))}

      {v.intervals.map((iv, i) => {
        const y = hangY(i);
        const a3 = sx(val(iv.from)), b3 = sx(val(iv.to));
        const color = iv.color || PALETTE[i % PALETTE.length];
        return (
          <g key={i}>
            <line x1={a3} x2={b3} y1={y} y2={y} stroke={color} strokeWidth="8" strokeLinecap="butt" />
            {iv.from !== "-inf" && (
              <circle cx={a3} cy={y} r="10" fill={iv.closedLeft ? color : "#fff"} stroke={color} strokeWidth="4" />
            )}
            {iv.to !== "+inf" && (
              <circle cx={b3} cy={y} r="10" fill={iv.closedRight ? color : "#fff"} stroke={color} strokeWidth="4" />
            )}
            {/* Nhãn ghi ở chỗ trống rộng hơn của hàng: bên phải nếu khoảng nằm
                lệch trái, bên trái nếu ngược lại. */}
            {iv.label && (() => {
              // Chọn bên nào CHỨA NỔI nhãn. Bản đầu V12 chỉ so vị trí mút nên
              // nhãn "(3; +∞)" của khoảng sát mép phải bị cắt cụt.
              const w = beRongChu(iv.label, fs, 0.55);
              if (b3 + fs * 0.7 + w <= W - 6)
                return <text x={b3 + fs * 0.7} y={y + fs * 0.33} textAnchor="start" className="chart-tick svg-halo" fill={color}>{iv.label}</text>;
              if (a3 - fs * 0.7 - w >= 6)
                return <text x={a3 - fs * 0.7} y={y + fs * 0.33} textAnchor="end" className="chart-tick svg-halo" fill={color}>{iv.label}</text>;
              return <text x={(a3 + b3) / 2} y={y - fs * 0.65} textAnchor="middle" className="chart-tick svg-halo" fill={color}>{iv.label}</text>;
            })()}
          </g>
        );
      })}

      {v.points?.map((q, i) => (
        <g key={i}>
          <circle cx={sx(q.x)} cy={axisY} r="9" fill={q.filled === false ? "#fff" : "#E4572E"} stroke="#E4572E" strokeWidth="3" />
          {q.label && <text x={sx(q.x)} y={axisY + fs * 1.2} textAnchor="middle" className="chart-tick svg-halo">{q.label}</text>}
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Miền nghiệm bất phương trình bậc nhất hai ẩn                        */
/* ------------------------------------------------------------------ */

function InequalityRegion({ v }: { v: RegionVisual }) {
  /**
   * MIỀN NGHIỆM — V12.0 sửa bốn thứ.
   *
   * 1. KHÔNG CÓ SỐ NÀO TRÊN TRỤC. Bài quy hoạch tuyến tính mà không đọc được
   *    toạ độ đỉnh thì không làm được gì: đỉnh B(4; 2) nhìn vào chỉ là một chấm.
   * 2. Chú giải ràng buộc đặt ở góc trên trái NGAY TRONG khung vẽ, nên nó nằm
   *    đè lên chính các đường thẳng ràng buộc. Nay chú giải có dải riêng ở trên,
   *    ngoài khung vẽ.
   * 3. Nhãn hàm mục tiêu ghi ở đáy khung, bị cả đường thẳng lẫn mép khung cắt
   *    qua. Nay xếp cùng dải chú giải.
   * 4. Miền tô ghép từ 14 400 ô vuông nhỏ. Nay mỗi hàng quét chỉ sinh MỘT hình
   *    chữ nhật cho mỗi đoạn liền nhau, nên mép miền sạch và tệp nhẹ hẳn.
   */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const axId = `regAx${uid}`;
  /**
   * Khung CAO THEO SỐ HÀNG CHÚ GIẢI. Để cứng 560 px thì hệ 4 ràng buộc + hàm
   * mục tiêu ăn 3 hàng chú giải, chiếm hơn nửa chiều cao, và phần đồ thị — thứ
   * học sinh phải nhìn — chỉ còn lại một dải hẹp. Tính hai lượt: lấy cỡ chữ
   * tạm để biết chú giải cao bao nhiêu, rồi mới chốt chiều cao khung.
   */
  const W = 860;
  const KHUNG_VE = 430;
  const chuGiai = [
    ...v.constraints.filter((c) => c.label).map((c, i) => ({
      label: c.label!, color: PALETTE[i % PALETTE.length], dashed: c.op === "<" || c.op === ">",
    })),
    ...(v.objective ? [{
      label: v.objective.label || `F = ${soVN(v.objective.p)}x + ${soVN(v.objective.q)}y`,
      color: "#17324D", dashed: false,
    }] : []),
  ];
  /* Chú giải xếp thành hàng ở trên; mỗi hàng chứa được vài nhãn ngắn. */
  const xepChuGiai = (co: number) => {
    const rong = (c: { label: string }) => co * 1.8 + beRongChu(c.label, co, 0.56);
    const hang: { label: string; color: string; dashed: boolean }[][] = [];
    chuGiai.forEach((c) => {
      const cuoi = hang[hang.length - 1];
      const daDung = (cuoi ?? []).reduce((t, k) => t + rong(k), 0);
      if (cuoi && daDung + rong(c) < W - 24) cuoi.push(c);
      else hang.push([c]);
    });
    return hang;
  };
  const fsTam = svgFontPx(W, 560);
  const soHangTam = xepChuGiai(fsTam).length;
  const H = Math.round(KHUNG_VE + (soHangTam ? fsTam * (0.35 + soHangTam * 1.3) : fsTam * 0.4));
  const fs = svgFontPx(W, H);
  const hangChuGiai = xepChuGiai(fs);
  const rongChuGiai = (c: { label: string }) => fs * 1.8 + beRongChu(c.label, fs, 0.56);
  const yTren = hangChuGiai.length ? fs * (0.35 + hangChuGiai.length * 1.3) : fs * 0.4;

  const pL = fs * 1.9, pR = fs * 1.1, pB = fs * 1.7, pT = fs * 0.9;
  const x0p = pL, x1p = W - pR, y0p = yTren + pT, y1p = H - pB;
  const sx = (x: number) => x0p + ((x - v.xMin) * (x1p - x0p)) / (v.xMax - v.xMin);
  const sy = (y: number) => y1p - ((y - v.yMin) * (y1p - y0p)) / (v.yMax - v.yMin);
  const vachX = ticksFit(v.xMin, v.xMax, x1p - x0p, fs);
  const vachY = ticksFitDoc(v.yMin, v.yMax, y1p - y0p, fs);
  const truX = v.yMin <= 0 && v.yMax >= 0 ? sy(0) : y1p;
  const truY = v.xMin <= 0 && v.xMax >= 0 ? sx(0) : x0p;

  const thoaMan = (x: number, y: number) =>
    v.constraints.every((c) => {
      const t = c.a * x + c.b * y;
      return c.op === "<=" ? t <= c.c + 1e-9 : c.op === "<" ? t < c.c - 1e-9
        : c.op === ">=" ? t >= c.c - 1e-9 : t > c.c + 1e-9;
    });

  /* Quét theo hàng, mỗi đoạn liền nhau thành một hình chữ nhật. */
  const N = 150;
  const dx = (v.xMax - v.xMin) / N, dy = (v.yMax - v.yMin) / N;
  const oTo: { x: number; y: number; w: number; h: number }[] = [];
  for (let j = 0; j < N; j++) {
    const y = v.yMin + (j + 0.5) * dy;
    let dau = -1;
    for (let i = 0; i <= N; i++) {
      const ok = i < N && thoaMan(v.xMin + (i + 0.5) * dx, y);
      if (ok && dau < 0) dau = i;
      if (!ok && dau >= 0) {
        const xa = sx(v.xMin + dau * dx), xb = sx(v.xMin + i * dx);
        const ya = sy(y + dy / 2), yb = sy(y - dy / 2);
        oTo.push({ x: xa, y: ya, w: Math.max(0.6, xb - xa), h: Math.max(0.6, yb - ya) });
        dau = -1;
      }
    }
  }

  return (
    <svg className="region-svg" viewBox={`0 0 ${W} ${H}`} role="img" style={{ fontSize: fs }}
         aria-label="Miền nghiệm hệ bất phương trình">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <defs>
        <marker id={axId} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" fill="#263746" />
        </marker>
      </defs>

      {/* Chú giải ràng buộc + hàm mục tiêu, dải riêng ở trên khung vẽ */}
      <g className="chart-tick svg-halo">
        {hangChuGiai.map((hang, r) => {
          let x = 14;
          return (
            <g key={r} transform={`translate(0, ${fs * (1.0 + r * 1.3)})`}>
              {hang.map((c, i) => {
                const tai = x;
                x += rongChuGiai(c);
                return (
                  <g key={i} transform={`translate(${tai}, 0)`}>
                    <line x1="0" x2={fs * 1.15} y1={-fs * 0.3} y2={-fs * 0.3} stroke={c.color} strokeWidth="4"
                          strokeDasharray={c.dashed ? "8 5" : undefined} />
                    <text x={fs * 1.5} fill={c.color}>{c.label}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>

      <g stroke="#E9EFF4" strokeWidth="1">
        {vachX.map((t, i) => <line key={`gx${i}`} x1={sx(t)} x2={sx(t)} y1={y0p} y2={y1p} />)}
        {vachY.map((t, i) => <line key={`gy${i}`} y1={sy(t)} y2={sy(t)} x1={x0p} x2={x1p} />)}
      </g>

      {oTo.map((o, i) => <rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} fill="#0E8A7233" />)}

      {v.constraints.map((c, i) => {
        const color = PALETTE[i % PALETTE.length];
        const strict = c.op === "<" || c.op === ">";
        let xa: number, ya: number, xb: number, yb: number;
        if (Math.abs(c.b) > 1e-9) {
          xa = v.xMin; ya = (c.c - c.a * xa) / c.b;
          xb = v.xMax; yb = (c.c - c.a * xb) / c.b;
        } else {
          xa = xb = c.c / (c.a || 1); ya = v.yMin; yb = v.yMax;
        }
        return (
          <line key={i} x1={sx(xa)} y1={sy(ya)} x2={sx(xb)} y2={sy(yb)} stroke={color} strokeWidth="2.6"
                strokeDasharray={strict ? "8 5" : undefined} />
        );
      })}

      <g stroke="#263746" strokeWidth="2">
        {v.yMin <= 0 && v.yMax >= 0 && <line x1={x0p} x2={x1p + 8} y1={truX} y2={truX} markerEnd={`url(#${axId})`} />}
        {v.xMin <= 0 && v.xMax >= 0 && <line y1={y1p} y2={y0p - 8} x1={truY} x2={truY} markerEnd={`url(#${axId})`} />}
      </g>
      <g className="chart-tick svg-halo" fill="#5A6B7B">
        {vachX.filter((t) => Math.abs(t) > 1e-9).map((t, i) => (
          <text key={`tx${i}`} x={sx(t)} y={truX + fs * 0.95} textAnchor="middle">{soVN(t)}</text>
        ))}
        {vachY.filter((t) => Math.abs(t) > 1e-9).map((t, i) => (
          <text key={`ty${i}`} x={truY - fs * 0.35} y={sy(t) + fs * 0.33} textAnchor="end">{soVN(t)}</text>
        ))}
        <text x={truY - fs * 0.35} y={truX + fs * 0.95} textAnchor="end">O</text>
        <text x={x1p + 6} y={truX - fs * 0.45} textAnchor="end" className="axis-name">x</text>
        <text x={truY + fs * 0.5} y={Math.max(y0p - fs * 0.2, yTren + fs * 0.9)} textAnchor="start" className="axis-name">y</text>
      </g>

      {/* Đỉnh miền nghiệm: nhãn xếp tránh hàng số và tránh nhau */}
      {(() => {
        const vatCan: OChu[] = [
          ...vachX.filter((t) => Math.abs(t) > 1e-9).map((t) => {
            const w = beRongChu(soVN(t), fs);
            return { x0: sx(t) - w / 2, x1: sx(t) + w / 2, y: truX + fs * 0.95 };
          }),
          ...vachY.filter((t) => Math.abs(t) > 1e-9).map((t) => {
            const w = beRongChu(soVN(t), fs);
            return { x0: truY - fs * 0.35 - w, x1: truY - fs * 0.35, y: sy(t) + fs * 0.33 };
          }),
        ];
        return (v.vertices ?? []).map((q, i) => {
          const ten = q.label ? `${q.label}(${soVN(q.x)}; ${soVN(q.y)})` : `(${soVN(q.x)}; ${soVN(q.y)})`;
          const w = beRongChu(ten, fs, 0.55);
          const cx = Math.min(Math.max(sx(q.x) + fs * 0.3, x0p), x1p - w);
          const o = { x0: cx, x1: cx + w };
          const huong = sy(q.y) < (y0p + y1p) / 2 ? 1 : -1;
          const thu = [0, 1, -1, 2, -2].map((k) => sy(q.y) - fs * 0.45 + k * huong * fs * 1.15);
          const y = chonChoDat(thu, o, vatCan, fs, (yy) => yy > yTren + fs && yy < H - fs * 0.2);
          vatCan.push({ ...o, y });
          const xaNhau = Math.abs(y - sy(q.y)) > fs * 1.1 || Math.abs(cx - sx(q.x)) > fs * 1.1;
          return (
            <g key={i}>
              {/* Nhãn phải đứng xa thì kẻ nét mảnh nối về chấm, nếu không giáo
                  viên không biết toạ độ nào của đỉnh nào. */}
              {xaNhau && (
                <line x1={sx(q.x)} y1={sy(q.y)} x2={Math.min(Math.max(sx(q.x), cx), cx + beRongChu(ten, fs, 0.55))}
                      y2={y + (y < sy(q.y) ? fs * 0.25 : -fs * 0.3)}
                      stroke="#B0BEC8" strokeWidth="1.5" strokeDasharray="4 3" />
              )}
              <circle cx={sx(q.x)} cy={sy(q.y)} r="7" fill="#E4572E" stroke="#fff" strokeWidth="2" />
              <text x={cx} y={y} className="chart-tick svg-halo">{ten}</text>
            </g>
          );
        });
      })()}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Hình không gian (phép chiếu trục đo)                                */
/* ------------------------------------------------------------------ */

const LETTERS = "ABCDEFGH".split("");

/**
 * Hình chóp / lăng trụ / khối tròn.
 *
 * HAI LỖI NẶNG NHẤT CỦA V11, sửa ở V12.0.
 *
 * 1. TÊN ĐỈNH ĐẶT SAI CHỖ. Người Việt gọi "hình chóp S.ABCD" — chữ trước dấu
 *    chấm là ĐỈNH, các chữ sau là đáy. V11 gán labels[0..n-1] cho ĐÁY rồi
 *    labels[n] cho đỉnh, nên với ["S","A","B","C","D"] thì S rơi xuống một đỉnh
 *    đáy và D leo lên làm đỉnh chóp. Vẽ ra là hình chóp D.SABC, mà phần mềm vẫn
 *    báo "Đạt".
 *
 * 2. PHÉP CHIẾU LÀM HAI ĐỈNH TRÙNG NHAU. V11 đặt đáy vuông ở các góc 45°, 135°,
 *    225°, 315° rồi chiếu kiểu (x−y, (x+y)/2) — ra hình thoi, và đỉnh phía sau
 *    rơi đúng bên trên đỉnh phía trước. Hai nhãn đè lên nhau, còn cạnh bên thì
 *    đi xuyên qua giữa đáy. SGK không vẽ như vậy: đáy vẽ thành HÌNH BÌNH HÀNH,
 *    cạnh trước nằm ngang, cạnh sau đẩy lên và lệch sang phải — bốn đỉnh tách
 *    nhau rõ ràng.
 *
 * Ngoài ra V11 đặt cứng hệ số thu s = 52 nên hình chỉ chiếm chừng nửa khung;
 * phần trống ấy làm ảnh bị thu nhỏ thêm một lần nữa khi đưa lên slide. Nay tính
 * khung bao của mọi điểm rồi mới chọn hệ số thu, nên khối luôn chiếm hết chỗ.
 */

/** Toạ độ "thô" trong không gian phẳng hoá, chưa co giãn. */
type Diem = { x: number; y: number };

/**
 * Đáy nằm trên một ELIP dẹt, cạnh trước nằm ngang, rồi nghiêng đi một chút.
 * Với n = 4 cho ra đúng hình bình hành của SGK; n = 3 cho tam giác đáy nằm
 * ngang; n = 6 cho lục giác dẹt.
 */
function dayKhoi(n: number, R = 1, k = 0.42, nghieng = 0.5): Diem[] {
  const goc0 = n === 3 ? 150 : n === 4 ? 135 : 180 - 180 / n;
  return Array.from({ length: n }, (_, i) => {
    const t = ((goc0 - (i * 360) / n) * Math.PI) / 180;
    const y = k * R * Math.sin(t);
    return { x: R * Math.cos(t) - nghieng * y, y };
  });
}

function Solid3D({ v }: { v: Solid3DVisual }) {
  const W = 820, H = 520;
  const fs = svgFontPx(W, H);
  const caption = v.caption?.trim();
  const chuThich = (v.highlights ?? []).filter((h) => h?.label);

  const nCanh = Math.max(3, Math.min(8, v.baseSides ?? (v.shape === "tetrahedron" ? 3 : 4)));
  const laChop = v.shape === "pyramid" || v.shape === "tetrahedron" || v.shape === "cone";
  const laLangTru = v.shape === "prism" || v.shape === "cube" || v.shape === "cylinder";
  const cao = v.height ?? (v.shape === "cube" ? 1.55 : v.shape === "prism" || v.shape === "cylinder" ? 1.5 : 1.65);

  /* Tên đỉnh và tên các đỉnh đáy, theo lối gọi S.ABCD. Thầy chỉ ghi đủ n tên
     (tức chỉ có đáy) thì đỉnh mặc định là "S". */
  const labels = v.labels?.length ? v.labels : [];
  const coTenDinh = laChop && labels.length > nCanh;
  const tenDinh = laChop ? (coTenDinh ? labels[0] : "S") : "";
  const tenDay = Array.from({ length: nCanh }, (_, i) =>
    (coTenDinh ? labels[i + 1] : labels[i]) ?? LETTERS[i] ?? `P${i}`);

  const day = dayKhoi(nCanh);
  const dinh: Diem = { x: 0, y: -cao };
  const tren = day.map((d) => ({ x: d.x, y: d.y - cao }));

  /* Khung bao của MỌI điểm sẽ vẽ, để chọn hệ số thu cho khối chiếm hết chỗ. */
  const moiDiem: Diem[] = [...day, ...(laChop ? [dinh] : []), ...(laLangTru ? tren : [])];
  const xs = moiDiem.map((d) => d.x), ys = moiDiem.map((d) => d.y);
  const bx0 = Math.min(...xs), bx1 = Math.max(...xs);
  const by0 = Math.min(...ys), by1 = Math.max(...ys);

  /* Chỗ được dùng: chừa hàng chú thích ở trên, dòng caption ở dưới, và một vành
     lề đủ rộng cho nhãn đỉnh (nhãn nằm NGOÀI khối nên phải tính vào). */
  // Lề cho nhãn đỉnh; hàng chú thích và dòng caption đã chiếm đúng dải đó rồi
  // nên lấy giá trị LỚN HƠN, không cộng dồn — cộng dồn thì lề trên dưới ăn hết
  // 41 % chiều cao khung và khối chỉ còn bằng nửa chỗ đáng ra nó được chiếm.
  const leNhan = fs * 1.15;
  const yTren = (chuThich.length ? fs * (0.35 + chuThich.length * 1.35) : 0) + leNhan;
  const yDuoi = (caption ? fs * 1.7 : 0) + leNhan * 0.85;
  const oX0 = leNhan, oX1 = W - leNhan;
  const oY0 = yTren, oY1 = H - yDuoi;
  const s = Math.min((oX1 - oX0) / Math.max(1e-6, bx1 - bx0), (oY1 - oY0) / Math.max(1e-6, by1 - by0));
  const dx = (oX0 + oX1) / 2 - ((bx0 + bx1) / 2) * s;
  const dy = (oY0 + oY1) / 2 - ((by0 + by1) / 2) * s;
  const P = (d: Diem): [number, number] => [d.x * s + dx, d.y * s + dy];

  const dayPx = day.map(P);
  const trenPx = tren.map(P);
  const dinhPx = P(dinh);
  const tamDayPx = P({ x: 0, y: 0 });

  /* Đỉnh PHÍA SAU: y thô nhỏ nhất. Cạnh nối hai đỉnh phía sau là cạnh bị khối
     che, SGK vẽ nét đứt. */
  const nuaSau = day.map((d) => d.y < -1e-9);
  const canhSau = (i: number) => nuaSau[i] && nuaSau[(i + 1) % nCanh];
  let sauNhat = 0;
  day.forEach((d, i) => { if (d.y < day[sauNhat].y) sauNhat = i; });

  const nodes = new Map<string, [number, number]>();
  const edges: { a: [number, number]; b: [number, number]; dashed: boolean }[] = [];

  if (laChop) {
    dayPx.forEach((pt, i) => {
      nodes.set(tenDay[i], pt);
      edges.push({ a: pt, b: dayPx[(i + 1) % nCanh], dashed: canhSau(i) });
      if (v.shape !== "cone") edges.push({ a: pt, b: dinhPx, dashed: false });
    });
    if (v.shape !== "cone") nodes.set(tenDinh, dinhPx);
  } else if (laLangTru) {
    dayPx.forEach((pt, i) => {
      nodes.set(tenDay[i], pt);
      nodes.set(labels[nCanh + i] ?? `${tenDay[i]}'`, trenPx[i]);
      edges.push({ a: pt, b: dayPx[(i + 1) % nCanh], dashed: canhSau(i) });
      edges.push({ a: trenPx[i], b: trenPx[(i + 1) % nCanh], dashed: false });
      edges.push({ a: pt, b: trenPx[i], dashed: i === sauNhat });
    });
  }

  const laTron = v.shape === "cone" || v.shape === "cylinder" || v.shape === "sphere";
  const rxPx = s, ryPx = 0.42 * s;

  /**
   * Nhãn đỉnh đặt theo hướng TỪ TÂM ĐÁY RA NGOÀI. V11 đặt theo nửa trái/nửa
   * phải của khung, nên nhãn của đỉnh đáy phía sau bị đẩy lên trên và đè đúng
   * vào cạnh bên đi lên đỉnh chóp.
   */
  const tamTrenPx = laLangTru ? P({ x: 0, y: -cao }) : tamDayPx;
  const datNhan = (pt: [number, number], laDinhChop: boolean, laMatTren: boolean) => {
    if (laDinhChop) return { x: pt[0], y: pt[1] - fs * 0.45, anchor: "middle" as const };
    // Đỉnh mặt trên của lăng trụ phải toả ra từ tâm MẶT TRÊN, không phải tâm đáy
    // — lấy tâm đáy thì nhãn của A' và D' cùng bị đẩy lên một chỗ.
    const tam = laMatTren ? tamTrenPx : tamDayPx;
    const vx = pt[0] - tam[0], vy = pt[1] - tam[1];
    const d = Math.hypot(vx, vy) || 1;
    const ra = fs * 0.85;
    return {
      x: pt[0] + (vx / d) * ra * 1.25,
      y: pt[1] + (vy / d) * ra + fs * 0.33 - (laMatTren ? fs * 0.35 : 0),
      anchor: (Math.abs(vx) < d * 0.35 ? "middle" : vx < 0 ? "end" : "start") as "start" | "middle" | "end",
    };
  };

  /**
   * Xếp nhãn đỉnh một lượt cho CẢ KHỐI, đẩy ra xa dần khi còn chạm nhãn khác.
   * Lăng trụ nhìn từ góc này có A' và D' gần nhau, hai nhãn dính lại thành một
   * khối chữ không đọc được.
   */
  const nhanKhoi = (() => {
    const ten = [...nodes.keys()];
    const tenTren = laLangTru ? new Set(trenPx.map((pt) => ten.find((t) => nodes.get(t) === pt))) : new Set<string | undefined>();
    const out = ten.map((name) => {
      const pt = nodes.get(name)!;
      const d = datNhan(pt, laChop && name === tenDinh, tenTren.has(name));
      const w = beRongChu(name, fs, 0.58);
      const x0 = d.anchor === "middle" ? d.x - w / 2 : d.anchor === "start" ? d.x : d.x - w;
      return { name, pt, ...d, x0, x1: x0 + w };
    });
    out.forEach((q, i) => {
      const truoc = out.slice(0, i);
      for (let lan = 0; lan < 4; lan++) {
        if (!truoc.some((o) => chamNhau({ x0: o.x0, x1: o.x1, y: o.y }, { x0: q.x0, x1: q.x1, y: q.y }, fs))) break;
        const huong = q.pt[1] < H / 2 ? -1 : 1;
        q.y += huong * fs * 1.1;
      }
    });
    return out;
  })();

  return (
    <svg className="solid-svg" viewBox={`0 0 ${W} ${H}`} role="img" style={{ fontSize: fs }}
         aria-label={caption || "Hình không gian"}>
      <rect width={W} height={H} fill="#fff" rx="12" />

      {v.shape === "cone" && (() => {
        const [ox, oy] = P({ x: 0, y: 0 });
        return (
          <>
            <ellipse cx={ox} cy={oy} rx={rxPx} ry={ryPx} fill="#17324D10" stroke="#263746" strokeWidth="1.8"
                     strokeDasharray="7 5" />
            <path d={`M ${ox - rxPx} ${oy} A ${rxPx} ${ryPx} 0 0 0 ${ox + rxPx} ${oy}`} fill="none" stroke="#263746" strokeWidth="2.2" />
            <line x1={ox - rxPx} y1={oy} x2={dinhPx[0]} y2={dinhPx[1]} stroke="#263746" strokeWidth="2.2" />
            <line x1={ox + rxPx} y1={oy} x2={dinhPx[0]} y2={dinhPx[1]} stroke="#263746" strokeWidth="2.2" />
            {/* Đường cao: SGK luôn vẽ, nét đứt, kèm bán kính đáy. */}
            <line x1={ox} y1={oy} x2={dinhPx[0]} y2={dinhPx[1]} stroke="#263746" strokeWidth="1.5" strokeDasharray="7 5" />
            <line x1={ox} y1={oy} x2={ox + rxPx} y2={oy} stroke="#E4572E" strokeWidth="2.4" />
            <circle cx={ox} cy={oy} r="4.5" fill="#263746" />
            <text x={ox - fs * 0.45} y={oy + fs} textAnchor="end" className="solid-label svg-halo">O</text>
            <text x={ox + rxPx / 2} y={oy - fs * 0.3} textAnchor="middle" className="solid-label svg-halo" fill="#E4572E">R</text>
            <text x={dinhPx[0]} y={dinhPx[1] - fs * 0.5} textAnchor="middle" className="solid-label svg-halo">{tenDinh}</text>
          </>
        );
      })()}

      {v.shape === "cylinder" && (() => {
        const [ox, oy] = P({ x: 0, y: 0 });
        const [tx, ty] = P({ x: 0, y: -cao });
        return (
          <>
            <ellipse cx={ox} cy={oy} rx={rxPx} ry={ryPx} fill="#17324D10" stroke="#263746" strokeWidth="1.8" strokeDasharray="7 5" />
            <path d={`M ${ox - rxPx} ${oy} A ${rxPx} ${ryPx} 0 0 0 ${ox + rxPx} ${oy}`} fill="none" stroke="#263746" strokeWidth="2.2" />
            <ellipse cx={tx} cy={ty} rx={rxPx} ry={ryPx} fill="#17324D10" stroke="#263746" strokeWidth="2.2" />
            <line x1={ox - rxPx} y1={oy} x2={tx - rxPx} y2={ty} stroke="#263746" strokeWidth="2.2" />
            <line x1={ox + rxPx} y1={oy} x2={tx + rxPx} y2={ty} stroke="#263746" strokeWidth="2.2" />
            <line x1={ox} y1={oy} x2={tx} y2={ty} stroke="#263746" strokeWidth="1.5" strokeDasharray="7 5" />
            <circle cx={ox} cy={oy} r="4.5" fill="#263746" />
            <circle cx={tx} cy={ty} r="4.5" fill="#263746" />
            <text x={ox - fs * 0.45} y={oy + fs} textAnchor="end" className="solid-label svg-halo">O</text>
            <text x={tx - fs * 0.45} y={ty - fs * 0.35} textAnchor="end" className="solid-label svg-halo">O&apos;</text>
          </>
        );
      })()}

      {v.shape === "sphere" && (() => {
        const R = Math.min(oX1 - oX0, oY1 - oY0) / 2;
        const cxS = (oX0 + oX1) / 2, cyS = (oY0 + oY1) / 2;
        return (
          <>
            <circle cx={cxS} cy={cyS} r={R} fill="#17324D10" stroke="#263746" strokeWidth="2.2" />
            <ellipse cx={cxS} cy={cyS} rx={R} ry={R * 0.28} fill="none" stroke="#263746" strokeWidth="1.5" strokeDasharray="6 5" />
            <circle cx={cxS} cy={cyS} r="4.5" fill="#263746" />
            <line x1={cxS} y1={cyS} x2={cxS + R} y2={cyS} stroke="#E4572E" strokeWidth="2.6" />
            <text x={cxS - fs * 0.45} y={cyS + fs} textAnchor="end" className="solid-label svg-halo">O</text>
            <text x={cxS + R / 2} y={cyS - fs * 0.3} textAnchor="middle" className="solid-label svg-halo" fill="#E4572E">R</text>
          </>
        );
      })()}

      {!laTron &&
        edges.map((e, i) => (
          <line key={i} x1={e.a[0]} y1={e.a[1]} x2={e.b[0]} y2={e.b[1]} stroke="#263746"
                strokeWidth={e.dashed ? 1.5 : 2.2} strokeDasharray={e.dashed ? "7 5" : undefined} />
        ))}

      {/* Đoạn cần nhấn mạnh: TÔ ĐẬM trên hình, chú thích xếp thành hàng ở trên.
          V11.5 ghi ngay giữa đoạn nên ở cỡ chữ lớn nó đè lên đỉnh và cạnh khác. */}
      {v.highlights?.map((hl, i) => {
        const a = nodes.get(hl.from), b = nodes.get(hl.to);
        if (!a || !b) return null;
        return (
          <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={hl.color || "#E4572E"} strokeWidth="4.4"
                strokeDasharray={hl.dashed ? "8 5" : undefined} />
        );
      })}
      <g className="chart-tick svg-halo">
        {chuThich.map((hl, i) => (
          <g key={i} transform={`translate(14, ${fs * (1.05 + i * 1.35)})`}>
            <line x1="0" x2={fs * 1.1} y1={-fs * 0.3} y2={-fs * 0.3} stroke={hl.color || "#E4572E"} strokeWidth="4.4"
                  strokeDasharray={hl.dashed ? "8 5" : undefined} />
            <text x={fs * 1.5} fill={hl.color || "#E4572E"}>{hl.label}</text>
          </g>
        ))}
      </g>

      {!laTron &&
        nhanKhoi.map((q) => (
          <g key={q.name}>
            <circle cx={q.pt[0]} cy={q.pt[1]} r="5" fill="#263746" />
            <text x={q.x} y={q.y} textAnchor={q.anchor} className="solid-label svg-halo">{q.name}</text>
          </g>
        ))}
      {caption && <text x={W / 2} y={H - fs * 0.4} textAnchor="middle" className="visual-caption-svg">{caption}</text>}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Hệ trục Oxyz                                                        */
/* ------------------------------------------------------------------ */

/**
 * Mũi vectơ trên đầu tên: vẽ một đoạn có mũi nhọn ngay trên chữ.
 *
 * Ký tự Unicode U+20D7 ghép sau chữ cái cho kết quả khác nhau tuỳ phông, và
 * phông Times New Roman dùng trong hình Toán vẽ lệch hẳn sang phải. V11 thì
 * không vẽ mũi gì cả — trên hình chỉ thấy chữ "u" trơ trọi, mà trong Toán
 * "u" và "u⃗" là hai thứ khác nhau.
 */
function TenVecto({
  x, y, ten, fs, color, anchor = "start",
}: { x: number; y: number; ten: string; fs: number; color: string; anchor?: "start" | "middle" | "end" }) {
  if (!ten) return null;
  const w = Math.max(fs * 0.46, beRongChu(ten, fs, 0.5));
  const x0 = anchor === "start" ? x : anchor === "middle" ? x - w / 2 : x - w;
  const yMui = y - fs * 0.92;
  return (
    <g>
      <text x={x} y={y} textAnchor={anchor} className="chart-tick" fill={color}>{ten}</text>
      <line x1={x0} y1={yMui} x2={x0 + w} y2={yMui} stroke={color} strokeWidth="1.6" />
      <path d={`M ${x0 + w} ${yMui} l ${-fs * 0.2} ${-fs * 0.11} l 0 ${fs * 0.22} Z`} fill={color} />
    </g>
  );
}

/**
 * Phương trình mặt phẳng viết đúng lối Toán: bỏ hệ số 1, bỏ hạng tử hệ số 0.
 * V12 bản đầu in ra "2x − 1y + 3z − 6 = 0" — giáo viên Toán thấy "1y" là gạch.
 */
function phuongTrinhMatPhang(pl: { a: number; b: number; c: number; d: number }): string {
  const hang = ([[pl.a, "x"], [pl.b, "y"], [pl.c, "z"], [pl.d, ""]] as [number, string][])
    .filter(([k]) => Math.abs(k) > 1e-12);
  if (!hang.length) return "0 = 0";
  return hang
    .map(([k, bien], i) => {
      const dau = k < 0 ? "−" : "+";
      const tri = Math.abs(k);
      const so = bien && Math.abs(tri - 1) < 1e-12 ? "" : soVN(tri);
      const than = `${so}${bien}`;
      return i === 0 ? `${k < 0 ? "−" : ""}${than}` : ` ${dau} ${than}`;
    })
    .join("") + " = 0";
}

function Oxyz({ v }: { v: OxyzVisual }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const axId = `axArrow${uid}`;
  const vecId = `oxyzVec${uid}`;
  const W = 820, H = 540;
  const fs = svgFontPx(W, H);
  const range = Math.max(1, Math.round(v.range ?? 4));

  /**
   * Phép chiếu theo lối SGK: Oz thẳng đứng lên, Oy nằm ngang sang phải, Ox
   * chếch xuống trái về phía người xem.
   */
  // Hệ số 0,62 và 0,44 (thay cho 0,5 và 0,42): với 0,5 thì MỌI điểm có y = x/2
  // chiếu đúng lên trục Oz — A(2; 1; 3) rơi hẳn vào trục, nhìn tưởng điểm nằm
  // trên Oz. Đổi hệ số làm các ca trùng trục thưa hẳn đi.
  const proj1 = (x: number, y: number, z: number) => ({ x: y - x * 0.62, y: -z + x * 0.44 });

  const dsPoint = v.points ?? [];
  const dsVec = v.vectors ?? [];
  /* Mặt phẳng ax+by+cz+d=0: SGK vẽ TAM GIÁC VẾT qua ba giao điểm với ba trục,
     chứ không chỉ ghi phương trình ra một góc như V11. */
  const matPhang = (v.planes ?? []).map((pl) => {
    const gx = pl.a ? -pl.d / pl.a : null;
    const gy = pl.b ? -pl.d / pl.b : null;
    const gz = pl.c ? -pl.d / pl.c : null;
    return { pl, gx, gy, gz, veDuoc: gx !== null && gy !== null && gz !== null };
  });

  const thoTho = [
    proj1(range, 0, 0), proj1(0, range, 0), proj1(0, 0, range), proj1(0, 0, 0),
    ...dsPoint.map((q) => proj1(q.x, q.y, q.z)),
    ...dsPoint.map((q) => proj1(q.x, q.y, 0)),
    ...dsVec.map((q) => proj1(q.x, q.y, q.z)),
    ...matPhang.flatMap((m) => (m.veDuoc ? [proj1(m.gx!, 0, 0), proj1(0, m.gy!, 0), proj1(0, 0, m.gz!)] : [])),
    ...(v.sphere ? [proj1(v.sphere.x, v.sphere.y, v.sphere.z)] : []),
  ];
  // Chừa dải trên cho các dòng phương trình mặt phẳng, nếu không dòng
  // "(P): 2x − y + 3z − 6 = 0" đè lên tên trục z.
  const leTren = fs * 1.9 + (matPhang.length ? fs * (0.5 + matPhang.length * 1.3) : 0);
  const le = fs * 1.9;
  const bx0 = Math.min(...thoTho.map((d) => d.x)), bx1 = Math.max(...thoTho.map((d) => d.x));
  const by0 = Math.min(...thoTho.map((d) => d.y)), by1 = Math.max(...thoTho.map((d) => d.y));
  const s = Math.min((W - 2 * le) / Math.max(1e-6, bx1 - bx0), (H - leTren - le) / Math.max(1e-6, by1 - by0));
  const offX = W / 2 - ((bx0 + bx1) / 2) * s;
  const offY = (leTren + (H - le)) / 2 - ((by0 + by1) / 2) * s;
  const proj = (x: number, y: number, z: number): [number, number] => {
    const d = proj1(x, y, z);
    return [d.x * s + offX, d.y * s + offY];
  };
  const O = proj(0, 0, 0);

  /* Vạch chia trên ba trục — không có thì hình vẽ không kiểm được: A(2; 1; 3)
     nhìn vào chỉ thấy một chấm lơ lửng. */
  const vach = Array.from({ length: range }, (_, i) => i + 1);

  return (
    <svg className="oxyz-svg" viewBox={`0 0 ${W} ${H}`} role="img" style={{ fontSize: fs }} aria-label="Hệ trục toạ độ Oxyz">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <defs>
        <marker id={axId} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" fill="#263746" />
        </marker>
        {/* markerUnits="userSpaceOnUse": mặc định mũi phóng theo BỀ DÀY NÉT, nên
            vectơ nét 3 px có mũi rộng 27 px — vectơ n(1;1;1) dài 40 px thì gần
            như chỉ còn thấy cái mũi. */}
        <marker id={vecId} markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,1 L14,7 L0,13 Z" fill="context-stroke" />
        </marker>
      </defs>

      {/* Ba trục, kèm nửa âm vẽ nét nhạt để thấy rõ gốc O ở đâu */}
      {([
        ["x", proj(range, 0, 0), proj(-range * 0.35, 0, 0)],
        ["y", proj(0, range, 0), proj(0, -range * 0.35, 0)],
        ["z", proj(0, 0, range), proj(0, 0, -range * 0.35)],
      ] as [string, [number, number], [number, number]][]).map(([ten, pt, am]) => (
        <g key={ten}>
          <line x1={O[0]} y1={O[1]} x2={am[0]} y2={am[1]} stroke="#B7C6D2" strokeWidth="1.4" />
          <line x1={O[0]} y1={O[1]} x2={pt[0]} y2={pt[1]} stroke="#263746" strokeWidth="2" markerEnd={`url(#${axId})`} />
          {/* Tên trục đẩy RA NGOÀI theo đúng hướng của trục, vượt qua cả đầu
              mũi. Bản đầu V12 chỉ lệch một chút nên vẫn rơi cạnh số 4 và hiện
              ra thành "x4". */}
          {(() => {
            const dx = pt[0] - O[0], dy = pt[1] - O[1];
            const d = Math.hypot(dx, dy) || 1;
            return (
              <text x={pt[0] + (dx / d) * fs * 1.15} y={pt[1] + (dy / d) * fs * 1.15 + fs * 0.33}
                    textAnchor={dx < -d * 0.3 ? "end" : dx > d * 0.3 ? "start" : "middle"}
                    className="chart-axis">{ten}</text>
            );
          })()}
        </g>
      ))}
      <g className="chart-tick svg-halo" fill="#5A6B7B">
        {vach.map((t) => {
          const px = proj(t, 0, 0), py = proj(0, t, 0), pz = proj(0, 0, t);
          return (
            <g key={t}>
              <circle cx={px[0]} cy={px[1]} r="2.6" fill="#5A6B7B" />
              <circle cx={py[0]} cy={py[1]} r="2.6" fill="#5A6B7B" />
              <circle cx={pz[0]} cy={pz[1]} r="2.6" fill="#5A6B7B" />
              {/* Chỉ ghi số ở vạch cuối và vạch giữa: ghi hết thì chữ chen nhau */}
              {(t === range || t === Math.ceil(range / 2)) && (
                <>
                  {/* Số trên Ox lệch VUÔNG GÓC với trục: Ox chếch xuống trái nên
                      đặt số theo hướng trục làm nó dính vào tên trục ("x4"). */}
                  <text x={px[0] + fs * 0.42} y={px[1] + fs * 0.72} textAnchor="start">{t}</text>
                  <text x={py[0]} y={py[1] + fs} textAnchor="middle">{t}</text>
                  <text x={pz[0] - fs * 0.4} y={pz[1] + fs * 0.3} textAnchor="end">{t}</text>
                </>
              )}
            </g>
          );
        })}
      </g>
      <text x={O[0] - fs * 0.4} y={O[1] + fs} textAnchor="end" className="chart-tick">O</text>

      {/* Tam giác vết của mặt phẳng */}
      {matPhang.map((m, i) =>
        m.veDuoc ? (
          <g key={i}>
            <polygon
              points={[proj(m.gx!, 0, 0), proj(0, m.gy!, 0), proj(0, 0, m.gz!)].map((p) => `${p[0]},${p[1]}`).join(" ")}
              fill="#1D4ED81F" stroke="#1D4ED8" strokeWidth="2" />
            {(() => {
              const ba = [proj(m.gx!, 0, 0), proj(0, m.gy!, 0), proj(0, 0, m.gz!)];
              const tx = ba.reduce((t, q) => t + q[0], 0) / 3;
              const ty = ba.reduce((t, q) => t + q[1], 0) / 3;
              return (
                <text x={tx} y={ty + fs * 0.33} textAnchor="middle" className="chart-tick svg-halo" fill="#1D4ED8">
                  ({m.pl.label || "P"})
                </text>
              );
            })()}
          </g>
        ) : null,
      )}

      {v.sphere && (() => {
        const c = proj(v.sphere.x, v.sphere.y, v.sphere.z);
        const R = v.sphere.r * s;
        return (
          <g>
            <circle cx={c[0]} cy={c[1]} r={R} fill="#1D4ED815" stroke="#1D4ED8" strokeWidth="2" />
            <ellipse cx={c[0]} cy={c[1]} rx={R} ry={R * 0.3} fill="none" stroke="#1D4ED8" strokeWidth="1.3" strokeDasharray="6 5" />
            <circle cx={c[0]} cy={c[1]} r="4.5" fill="#1D4ED8" />
            <line x1={c[0]} y1={c[1]} x2={c[0] + R} y2={c[1]} stroke="#E4572E" strokeWidth="2.2" />
            <text x={c[0] + R / 2} y={c[1] - fs * 0.3} textAnchor="middle" className="chart-tick svg-halo" fill="#E4572E">R</text>
            {/* TÊN TÂM — lib/types.ts cho khai báo `sphere.label` mà hình chưa
                bao giờ vẽ: mặt cầu hiện ra có chấm tâm mà không có chữ I, nên
                không viết được phương trình (x−1)²+(y−1)²+(z−1)²=4 dựa vào
                hình. Ghi sang BÊN TRÁI tâm vì bán kính R đã chiếm bên phải. */}
            {v.sphere.label && (
              <text x={c[0] - fs * 0.4} y={c[1] - fs * 0.35} textAnchor="end" className="chart-tick svg-halo">
                {`${v.sphere.label}(${soVN(v.sphere.x)}; ${soVN(v.sphere.y)}; ${soVN(v.sphere.z)})`}
              </text>
            )}
          </g>
        );
      })()}

      {dsPoint.map((q, i) => {
        const pt = proj(q.x, q.y, q.z);
        const chan = proj(q.x, q.y, 0);
        return (
          <g key={i}>
            <line x1={pt[0]} y1={pt[1]} x2={chan[0]} y2={chan[1]} stroke="#9AA9B8" strokeDasharray="5 4" />
            <line x1={O[0]} y1={O[1]} x2={chan[0]} y2={chan[1]} stroke="#9AA9B8" strokeDasharray="5 4" />
            <circle cx={pt[0]} cy={pt[1]} r="5.5" fill={PALETTE[i % PALETTE.length]} stroke="#fff" strokeWidth="1.4" />
            <text x={pt[0] + fs * 0.35} y={pt[1] - fs * 0.35} className="chart-tick svg-halo">
              {q.label ? `${q.label}(${soVN(q.x)}; ${soVN(q.y)}; ${soVN(q.z)})` : `(${soVN(q.x)}; ${soVN(q.y)}; ${soVN(q.z)})`}
            </text>
          </g>
        );
      })}

      {dsVec.map((vec, i) => {
        const end = proj(vec.x, vec.y, vec.z);
        const color = vec.color || "#E4572E";
        return (
          <g key={i}>
            <line x1={O[0]} y1={O[1]} x2={end[0]} y2={end[1]} stroke={color} strokeWidth="3" markerEnd={`url(#${vecId})`} />
            <circle cx={end[0]} cy={end[1]} r="4" fill={color} />
            <TenVecto x={end[0] + fs * 0.35} y={end[1] - fs * 0.2} ten={vec.label || ""} fs={fs} color={color} />
          </g>
        );
      })}

      {/* Phương trình mặt phẳng ghi thành hàng ở góc, kể cả khi không vẽ được vết */}
      <g className="chart-tick svg-halo" fill="#1D4ED8">
        {matPhang.map((m, i) => (
          <text key={i} x={14} y={fs * (1.05 + i * 1.3)}>
            ({m.pl.label || "P"}): {phuongTrinhMatPhang(m.pl)}
          </text>
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Vectơ trong mặt phẳng                                               */
/* ------------------------------------------------------------------ */

function Vector2D({ v }: { v: VectorVisual }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const v2Id = `v2Arrow${uid}`;
  const axId = `v2Ax${uid}`;
  const W = 880, H = 520, p = 58;
  const fs = svgFontPx(W, H);
  const sx = (x: number) => p + ((x - v.xMin) * (W - 2 * p)) / (v.xMax - v.xMin);
  const sy = (y: number) => H - p - ((y - v.yMin) * (H - 2 * p)) / (v.yMax - v.yMin);
  const vachX = ticksFit(v.xMin, v.xMax, W - 2 * p, fs);
  const vachY = ticksFitDoc(v.yMin, v.yMax, H - 2 * p, fs);
  const coTrucX = v.yMin <= 0 && v.yMax >= 0;
  const coTrucY = v.xMin <= 0 && v.xMax >= 0;
  const y0 = coTrucX ? sy(0) : H - p;
  const x0 = coTrucY ? sx(0) : p;

  /**
   * QUY TẮC HÌNH BÌNH HÀNH. `showParallelogram` có trong lib/types.ts từ V11 và
   * được bài mẫu khai báo, nhưng V11 KHÔNG VẼ GÌ CẢ — một tính năng chết mà
   * không ai biết. Nay dựng hình bình hành từ hai vectơ đầu chung gốc, kèm
   * vectơ tổng vẽ nét đứt.
   */
  /** Hàng số trên hai trục và tên trục — chỗ đã có chữ, nhãn khác phải tránh. */
  const vatCanTruc: OChu[] = [
    ...vachX.filter((t) => Math.abs(t) > 1e-9).map((t) => {
      const w = beRongChu(soVN(t), fs);
      return { x0: sx(t) - w / 2, x1: sx(t) + w / 2, y: y0 + fs * 0.95 };
    }),
    ...vachY.filter((t) => Math.abs(t) > 1e-9).map((t) => {
      const w = beRongChu(soVN(t), fs);
      return { x0: x0 - fs * 0.35 - w, x1: x0 - fs * 0.35, y: sy(t) + fs * 0.33 };
    }),
    { x0: x0 - fs * 0.35 - beRongChu("O", fs), x1: x0 - fs * 0.35, y: y0 + fs * 0.95 },
    { x0: W - 8 - beRongChu("x", fs + 2), x1: W - 8, y: y0 - fs * 0.45 },
    { x0: x0 + fs * 0.5, x1: x0 + fs * 0.5 + beRongChu("y", fs + 2), y: Math.max(fs, p - fs * 0.5) },
  ];

  const hbh = (() => {
    if (!v.showParallelogram || v.vectors.length < 2) return null;
    const [a, b] = v.vectors;
    if (Math.abs(a.x1 - b.x1) > 1e-9 || Math.abs(a.y1 - b.y1) > 1e-9) return null;
    const ux = a.x2 - a.x1, uy = a.y2 - a.y1;
    const wx = b.x2 - b.x1, wy = b.y2 - b.y1;
    return { ox: a.x1, oy: a.y1, ux, uy, wx, wy, sx2: a.x1 + ux + wx, sy2: a.y1 + uy + wy };
  })();

  return (
    <svg className="vector-svg" viewBox={`0 0 ${W} ${H}`} role="img" style={{ fontSize: fs }} aria-label="Hình vectơ">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <defs>
        <marker id={v2Id} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" fill="context-stroke" />
        </marker>
        <marker id={axId} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" fill="#263746" />
        </marker>
      </defs>

      <g stroke="#E9EFF4" strokeWidth="1">
        {vachX.map((t, i) => <line key={`gx${i}`} x1={sx(t)} x2={sx(t)} y1={p} y2={H - p} />)}
        {vachY.map((t, i) => <line key={`gy${i}`} y1={sy(t)} y2={sy(t)} x1={p} x2={W - p} />)}
      </g>

      <g stroke="#263746" strokeWidth="2">
        {coTrucX && <line x1={p} x2={W - p + 8} y1={y0} y2={y0} markerEnd={`url(#${axId})`} />}
        {coTrucY && <line y1={H - p} y2={p - 8} x1={x0} x2={x0} markerEnd={`url(#${axId})`} />}
      </g>
      {/* SỐ TRÊN TRỤC — V11 không có số nào, nên không kiểm được u = (3; 2). */}
      <g className="chart-tick svg-halo" fill="#5A6B7B">
        {vachX.filter((t) => Math.abs(t) > 1e-9).map((t, i) => (
          <text key={`tx${i}`} x={sx(t)} y={y0 + fs * 0.95} textAnchor="middle">{soVN(t)}</text>
        ))}
        {vachY.filter((t) => Math.abs(t) > 1e-9).map((t, i) => (
          <text key={`ty${i}`} x={x0 - fs * 0.35} y={sy(t) + fs * 0.33} textAnchor="end">{soVN(t)}</text>
        ))}
        <text x={x0 - fs * 0.35} y={y0 + fs * 0.95} textAnchor="end">O</text>
        {/* Tên trục đặt PHÍA TRÊN trục hoành và bên phải trục tung, để không
            rơi vào hàng số của trục — V12 bản đầu ghi "x" ngay cạnh số 5. */}
        <text x={W - 8} y={y0 - fs * 0.45} textAnchor="end" className="axis-name">x</text>
        <text x={x0 + fs * 0.5} y={Math.max(fs, p - fs * 0.5)} textAnchor="start" className="axis-name">y</text>
      </g>

      {v.polygon && v.polygon.length > 2 && (
        <polygon points={v.polygon.map((q) => `${sx(q.x)},${sy(q.y)}`).join(" ")}
                 fill="#0E8A7218" stroke="#0E8A72" strokeWidth="2.2" />
      )}

      {hbh && (
        <g>
          <line x1={sx(hbh.ox + hbh.ux)} y1={sy(hbh.oy + hbh.uy)} x2={sx(hbh.sx2)} y2={sy(hbh.sy2)}
                stroke="#8C9BAA" strokeWidth="1.8" strokeDasharray="7 5" />
          <line x1={sx(hbh.ox + hbh.wx)} y1={sy(hbh.oy + hbh.wy)} x2={sx(hbh.sx2)} y2={sy(hbh.sy2)}
                stroke="#8C9BAA" strokeWidth="1.8" strokeDasharray="7 5" />
          <line x1={sx(hbh.ox)} y1={sy(hbh.oy)} x2={sx(hbh.sx2)} y2={sy(hbh.sy2)}
                stroke="#0E8A72" strokeWidth="3" markerEnd={`url(#${v2Id})`} />
          <TenVecto x={(sx(hbh.ox) + sx(hbh.sx2)) / 2} y={sy((hbh.oy + hbh.sy2) / 2) - fs * 0.35}
                    ten="u + v" fs={fs} color="#0E8A72" anchor="middle" />
        </g>
      )}

      {/* Vectơ và điểm: nhãn xếp MỘT LƯỢT, tránh hàng số trên trục và tránh
          nhau. Bản đầu V12 đặt rời từng nhãn nên A(-2; -1), B(3; -1) và nhãn
          vectơ AB dồn cả vào hàng số của trục hoành thành một khối chữ. */}
      {(() => {
        const dsVec = v.vectors.map((vec, i) => {
          const color = vec.color || PALETTE[i % PALETTE.length];
          const ax = sx(vec.x1), ay = sy(vec.y1), bx = sx(vec.x2), by = sy(vec.y2);
          const mx = (ax + bx) / 2, my = (ay + by) / 2;
          // Đẩy nhãn VUÔNG GÓC với vectơ: đẩy chéo lên thì nhãn của vectơ nằm
          // ngang rơi đúng vào hàng số của trục hoành ("v1").
          const L = Math.hypot(bx - ax, by - ay) || 1;
          const nx = -(by - ay) / L, ny = (bx - ax) / L;
          const huong = ny > 0 ? -1 : 1;
          const ten = vec.label || "";
          const w = Math.max(fs * 0.6, beRongChu(ten, fs, 0.55));
          const cx = mx + nx * huong * fs * 0.8;
          const y0 = my + ny * huong * fs * 0.8 + fs * 0.2;
          return { kind: "vec" as const, vec, color, ax, ay, bx, by, ten, cx, w, y0, huong };
        });
        const dsDiem = (v.points ?? []).map((q) => {
          const ten = q.label ? `${q.label}(${soVN(q.x)}; ${soVN(q.y)})` : "";
          return {
            kind: "diem" as const, q, ten,
            cx: sx(q.x) + fs * 0.3, w: beRongChu(ten, fs, 0.55),
            y0: sy(q.y) - fs * 0.4, huong: sy(q.y) < H / 2 ? 1 : -1,
          };
        });

        const daChiem: OChu[] = [...vatCanTruc];
        const xep = [...dsDiem, ...dsVec].map((it) => {
          const x0 = it.kind === "diem" ? it.cx : it.cx - it.w / 2;
          const o = { x0, x1: x0 + it.w };
          const thu = [0, 1, -1, 2, -2, 3].map((k) => it.y0 + k * it.huong * fs * 1.15);
          const y = chonChoDat(thu, o, daChiem, fs, (yy) => yy > fs && yy < H - fs * 0.3);
          daChiem.push({ ...o, y });
          return { it, y };
        });

        return (
          <g>
            {xep.filter((e) => e.it.kind === "vec").map((e, i) => {
              const it = e.it as Extract<typeof e.it, { kind: "vec" }>;
              return (
                <g key={`v${i}`}>
                  <line x1={it.ax} y1={it.ay} x2={it.bx} y2={it.by} stroke={it.color} strokeWidth="3.2"
                        strokeDasharray={it.vec.dashed ? "7 5" : undefined} markerEnd={`url(#${v2Id})`} />
                  <TenVecto x={it.cx} y={e.y} ten={it.ten} fs={fs} color={it.color} anchor="middle" />
                </g>
              );
            })}
            {xep.filter((e) => e.it.kind === "diem").map((e, i) => {
              const it = e.it as Extract<typeof e.it, { kind: "diem" }>;
              return (
                <g key={`p${i}`}>
                  <circle cx={sx(it.q.x)} cy={sy(it.q.y)} r="5.5" fill="#263746" stroke="#fff" strokeWidth="1.4" />
                  <text x={it.cx} y={e.y} className="chart-tick svg-halo">{it.ten}</text>
                </g>
              );
            })}
          </g>
        );
      })()}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Biểu đồ Ven                                                         */
/* ------------------------------------------------------------------ */

function Venn({ v }: { v: VennVisual }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const W = 700, H = 420;
  const fsVenn = svgFontPx(W, H);
  const two = v.sets.length <= 2;
  const centers = two
    ? [[270, 190], [430, 190]]
    : [[265, 165], [435, 165], [350, 285]];
  const R = two ? 125 : 110;
  const shade = new Set(v.shade ?? []);
  const names = v.sets.map((s) => s.name);

  return (
    <svg className="venn-svg" viewBox={`0 0 ${W} ${H}`} role="img" style={{ fontSize: svgFontPx(W, H) }} aria-label="Biểu đồ Ven">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <rect x="60" y="30" width={W - 120} height={H - 90} fill="none" stroke="#9AA9B8" strokeWidth="2" rx="8" />
      <text x={70} y={30 + fsVenn} className="chart-tick">E</text>
      <defs>
        {centers.map((c, i) => (
          <clipPath key={i} id={`venn${uid}_${i}`}>
            <circle cx={c[0]} cy={c[1]} r={R} />
          </clipPath>
        ))}
      </defs>
      {/* vùng giao được tô bằng cách lồng clipPath */}
      {shade.has(names.slice(0, 2).join("")) && (
        <g clipPath={`url(#venn${uid}_0)`}>
          <circle cx={centers[1][0]} cy={centers[1][1]} r={R} fill="#0E8A7255" />
        </g>
      )}
      {names.map((n, i) =>
        shade.has(n) ? (
          <circle key={`s${i}`} cx={centers[i][0]} cy={centers[i][1]} r={R} fill={`${PALETTE[i % PALETTE.length]}44`} />
        ) : null,
      )}
      {centers.map((c, i) => (
        <g key={i}>
          <circle cx={c[0]} cy={c[1]} r={R} fill="none" stroke={v.sets[i]?.color || PALETTE[i % PALETTE.length]} strokeWidth="2.6" />
          <text x={c[0] + (i === 0 ? -R + 24 : R - 24)} y={c[1] - R + 26} textAnchor="middle" className="chart-title">
            {v.sets[i]?.name}
          </text>
        </g>
      ))}
      {v.caption && <text x={W / 2} y={H - fsVenn * 0.35} textAnchor="middle" className="visual-caption-svg">{v.caption}</text>}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Bảng số liệu                                                        */
/* ------------------------------------------------------------------ */

function DataTable({ v }: { v: TableVisual }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>{v.headers.map((h, i) => <th key={i}><MixedMath value={h} compact /></th>)}</tr>
        </thead>
        <tbody>
          {v.rows.map((row, i) => (
            <tr key={i} className={v.highlightRow === i ? "hl" : undefined}>
              {row.map((cell, j) => <td key={j}><MixedMath value={cell} compact /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {v.caption && <small className="visual-caption"><MixedMath value={v.caption} /></small>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Câu hỏi tương tác                                                   */
/* ------------------------------------------------------------------ */

function Quiz({ v }: { v: QuizVisual }) {
  const [picked, setPicked] = useState<number | null>(null);
  const revealed = picked !== null;
  return (
    <div className="quiz-card">
      <p className="quiz-question"><MixedMath value={v.question} compact /></p>
      <div className="quiz-options">
        {v.options.map((o, i) => {
          const correct = i === v.answerIndex;
          const cls = !revealed ? "" : correct ? " correct" : i === picked ? " wrong" : " dim";
          return (
            <button key={i} type="button" className={`quiz-option${cls}`} onClick={() => setPicked(i)}>
              <b>{String.fromCharCode(65 + i)}</b>
              <span><MixedMath value={o} compact /></span>
            </button>
          );
        })}
      </div>
      {revealed && v.explanation && <p className="quiz-explain">💡 <MixedMath value={v.explanation} compact /></p>}
      {v.timer ? <small className="quiz-timer">⏱ Thời gian gợi ý: {v.timer} giây</small> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ExtraVisual({ visual }: { visual: Visual }) {
  switch (visual.type) {
    case "stat_chart": return <StatChart v={visual as StatChartVisual} />;
    case "box_plot": return <BoxPlot v={visual as BoxPlotVisual} />;
    case "prob_tree": return <ProbTree v={visual as ProbTreeVisual} />;
    case "unit_circle": return <UnitCircle v={visual as UnitCircleVisual} />;
    case "number_line": return <NumberLine v={visual as NumberLineVisual} />;
    case "inequality_region": return <InequalityRegion v={visual as RegionVisual} />;
    case "solid_3d": return <Solid3D v={visual as Solid3DVisual} />;
    case "oxyz": return <Oxyz v={visual as OxyzVisual} />;
    case "vector_2d": return <Vector2D v={visual as VectorVisual} />;
    case "venn": return <Venn v={visual as VennVisual} />;
    case "data_table": return <DataTable v={visual as TableVisual} />;
    case "quiz": return <Quiz v={visual as QuizVisual} />;
    default: return null;
  }
}
