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

function StatChart({ v }: { v: StatChartVisual }) {
  const W = 720, H = 420, p = 56;
  const series = v.series ?? [];
  const labels = v.labels ?? [];

  if (v.chart === "pie") {
    const values = series[0]?.values ?? [];
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const cx = 250, cy = H / 2, r = 140;
    let acc = -Math.PI / 2;
    return (
      <svg className="stat-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={v.title || "Biểu đồ hình quạt"}>
        <rect width={W} height={H} fill="#fff" rx="12" />
        {v.title && <text x={W / 2} y="28" textAnchor="middle" className="chart-title">{v.title}</text>}
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
              <text x={cx + r * 0.65 * Math.cos(mid)} y={cy + r * 0.65 * Math.sin(mid)}
                    textAnchor="middle" className="chart-slice">{pct}%</text>
            </g>
          );
        })}
        <g className="chart-legend">
          {labels.map((l, i) => (
            <g key={i} transform={`translate(455, ${90 + i * 28})`}>
              <rect width="16" height="16" rx="3" fill={PALETTE[i % PALETTE.length]} />
              <text x="24" y="13">{l}</text>
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
  const plotW = W - p - 24, plotH = H - p - 46;
  const x0 = p, y0 = H - 46;

  const groups = isHistogram ? (v.bins?.length ? v.bins.length - 1 : labels.length) : labels.length;
  const groupW = plotW / Math.max(1, groups);
  const barW = isHistogram ? groupW : (groupW * 0.68) / Math.max(1, series.length);

  return (
    <svg className="stat-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={v.title || "Biểu đồ thống kê"}>
      <rect width={W} height={H} fill="#fff" rx="12" />
      {v.title && <text x={W / 2} y="26" textAnchor="middle" className="chart-title">{v.title}</text>}
      {/* lưới ngang + trục giá trị */}
      {Array.from({ length: 6 }, (_, i) => {
        const val = (niceMax * i) / 5;
        const y = y0 - (plotH * i) / 5;
        return (
          <g key={i}>
            <line x1={x0} x2={x0 + plotW} y1={y} y2={y} stroke="#E2EAF1" />
            <text x={x0 - 10} y={y + 4} textAnchor="end" className="chart-tick">{Number(val.toFixed(2))}</text>
          </g>
        );
      })}
      <line x1={x0} x2={x0 + plotW} y1={y0} y2={y0} stroke="#263746" strokeWidth="1.6" />
      <line x1={x0} x2={x0} y1={y0} y2={y0 - plotH} stroke="#263746" strokeWidth="1.6" />
      {v.yLabel && <text x={x0 - 40} y={y0 - plotH - 12} className="chart-axis">{v.yLabel}</text>}
      {v.xLabel && <text x={x0 + plotW} y={H - 10} textAnchor="end" className="chart-axis">{v.xLabel}</text>}

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
                    <text x={bx + barW / 2} y={y0 - h - 6} textAnchor="middle" className="chart-value">{val}</text>
                  )}
                </g>
              );
            }),
          )}

      {/* nhãn trục hoành */}
      {isHistogram && v.bins?.length
        ? v.bins.map((b, i) => (
            <text key={i} x={x0 + groupW * i} y={y0 + 20} textAnchor="middle" className="chart-tick">{b}</text>
          ))
        : labels.map((l, i) => (
            <text key={i} x={x0 + groupW * (i + 0.5)} y={y0 + 20} textAnchor="middle" className="chart-tick">{l}</text>
          ))}

      {series.length > 1 && (
        <g className="chart-legend">
          {series.map((s, i) => (
            <g key={i} transform={`translate(${x0 + i * 150}, ${H - 8})`}>
              <rect width="14" height="14" y="-11" rx="3" fill={s.color || PALETTE[i % PALETTE.length]} />
              <text x="20">{s.name || `Nhóm ${i + 1}`}</text>
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
  const W = 720, H = 120 + v.groups.length * 78, p = 110;
  const all = v.groups.flatMap((g) => [g.min, g.max, ...(g.outliers ?? [])]);
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 1;
  const sx = (x: number) => p + ((x - (lo - pad)) * (W - p - 40)) / (hi - lo + 2 * pad);

  return (
    <svg className="stat-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={v.title || "Biểu đồ hộp"}>
      <rect width={W} height={H} fill="#fff" rx="12" />
      {v.title && <text x={W / 2} y="26" textAnchor="middle" className="chart-title">{v.title}</text>}
      {v.groups.map((g, i) => {
        const cy = 66 + i * 78;
        const c = PALETTE[i % PALETTE.length];
        return (
          <g key={i}>
            <text x={p - 14} y={cy + 5} textAnchor="end" className="chart-tick">{g.name}</text>
            <line x1={sx(g.min)} x2={sx(g.q1)} y1={cy} y2={cy} stroke={c} strokeWidth="2" />
            <line x1={sx(g.q3)} x2={sx(g.max)} y1={cy} y2={cy} stroke={c} strokeWidth="2" />
            <line x1={sx(g.min)} x2={sx(g.min)} y1={cy - 14} y2={cy + 14} stroke={c} strokeWidth="2" />
            <line x1={sx(g.max)} x2={sx(g.max)} y1={cy - 14} y2={cy + 14} stroke={c} strokeWidth="2" />
            <rect x={sx(g.q1)} y={cy - 22} width={Math.max(2, sx(g.q3) - sx(g.q1))} height="44"
                  fill={`${c}22`} stroke={c} strokeWidth="2" rx="3" />
            <line x1={sx(g.median)} x2={sx(g.median)} y1={cy - 22} y2={cy + 22} stroke={c} strokeWidth="3.5" />
            {(g.outliers ?? []).map((o, j) => (
              <circle key={j} cx={sx(o)} cy={cy} r="4.5" fill="none" stroke="#B91C1C" strokeWidth="2" />
            ))}
            <g className="chart-tick">
              <text x={sx(g.min)} y={cy + 34} textAnchor="middle">{g.min}</text>
              <text x={sx(g.q1)} y={cy - 30} textAnchor="middle">Q₁={g.q1}</text>
              <text x={sx(g.median)} y={cy + 34} textAnchor="middle">Q₂={g.median}</text>
              <text x={sx(g.q3)} y={cy - 30} textAnchor="middle">Q₃={g.q3}</text>
              <text x={sx(g.max)} y={cy + 34} textAnchor="middle">{g.max}</text>
            </g>
          </g>
        );
      })}
      {v.unit && <text x={W - 16} y={H - 10} textAnchor="end" className="chart-axis">Đơn vị: {v.unit}</text>}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Sơ đồ cây xác suất                                                  */
/* ------------------------------------------------------------------ */

function ProbTree({ v }: { v: ProbTreeVisual }) {
  const leaves = v.branches.reduce((n, b) => n + Math.max(1, b.children?.length ?? 0), 0);
  const W = 760, H = Math.max(240, 60 + leaves * 62);
  const x0 = 60, x1 = 280, x2 = 540;
  const cy = H / 2;
  let row = 0;

  return (
    <svg className="tree-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sơ đồ cây xác suất">
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

function parseAngle(s: string): number {
  const t = String(s).replace(/\\pi|π/g, "PI").replace(/\s/g, "");
  const expr = t.replace(/PI/g, String(Math.PI));
  const c = compileExpression(expr);
  return c.ok ? c.eval(0) : Number(t) || 0;
}

function UnitCircle({ v }: { v: UnitCircleVisual }) {
  const W = 520, H = 520, cx = 250, cy = 250, R = 180;
  const px = (a: number) => cx + R * Math.cos(a);
  const py = (a: number) => cy - R * Math.sin(a);
  const show = new Set(v.show ?? []);

  return (
    <svg className="circle-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Đường tròn lượng giác">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <line x1={cx - R - 40} x2={cx + R + 40} y1={cy} y2={cy} stroke="#263746" strokeWidth="1.4" />
      <line y1={cy + R + 40} y2={cy - R - 40} x1={cx} x2={cx} stroke="#263746" strokeWidth="1.4" />
      <text x={cx + R + 46} y={cy + 5} className="chart-axis">cos</text>
      <text x={cx + 8} y={cy - R - 46} className="chart-axis">sin</text>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#17324D" strokeWidth="2" />

      {show.has("tan") && <line x1={cx + R} x2={cx + R} y1={cy - R - 20} y2={cy + R + 20} stroke="#B45309" strokeWidth="1.6" strokeDasharray="6 4" />}
      {show.has("cot") && <line y1={cy - R} y2={cy - R} x1={cx - R - 20} x2={cx + R + 20} stroke="#6D28D9" strokeWidth="1.6" strokeDasharray="6 4" />}

      {v.arcs?.map((a, i) => {
        const from = parseAngle(a.from), to = parseAngle(a.to);
        const big = Math.abs(to - from) > Math.PI ? 1 : 0;
        return (
          <g key={i}>
            <path d={`M ${cx} ${cy} L ${px(from).toFixed(1)} ${py(from).toFixed(1)} A ${R} ${R} 0 ${big} 0 ${px(to).toFixed(1)} ${py(to).toFixed(1)} Z`}
                  fill="#0E8A7233" stroke="#0E8A72" strokeWidth="1.5" />
          </g>
        );
      })}

      {v.angles?.map((a, i) => {
        const ang = parseAngle(a.value);
        const color = a.color || PALETTE[i % PALETTE.length];
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={px(ang)} y2={py(ang)} stroke={color} strokeWidth="2.4" />
            <circle cx={px(ang)} cy={py(ang)} r="6" fill={color} />
            {show.has("sin") && <line x1={px(ang)} y1={py(ang)} x2={cx} y2={py(ang)} stroke={color} strokeDasharray="5 4" strokeWidth="1.4" />}
            {show.has("cos") && <line x1={px(ang)} y1={py(ang)} x2={px(ang)} y2={cy} stroke={color} strokeDasharray="5 4" strokeWidth="1.4" />}
            <text x={cx + (R + 26) * Math.cos(ang)} y={cy - (R + 26) * Math.sin(ang) + 5}
                  textAnchor="middle" className="circle-label" fill={color}>
              {a.label || a.value}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="4" fill="#263746" />
      <text x={cx - 14} y={cy + 18} className="chart-tick">O</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Trục số                                                             */
/* ------------------------------------------------------------------ */

function NumberLine({ v }: { v: NumberLineVisual }) {
  const nlId = `nlArrow${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const W = 760, H = 60 + v.intervals.length * 46, p = 50;
  const sx = (x: number) => p + ((x - v.min) * (W - 2 * p)) / (v.max - v.min);
  const val = (t: number | "-inf" | "+inf") => (t === "-inf" ? v.min : t === "+inf" ? v.max : t);
  const ticks = v.ticks?.length ? v.ticks : [v.min, (v.min + v.max) / 2, v.max];
  const axisY = 34;

  return (
    <svg className="numline-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trục số">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <defs>
        <marker id={nlId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#263746" />
        </marker>
      </defs>
      <line x1={p - 24} x2={W - p + 24} y1={axisY} y2={axisY} stroke="#263746" strokeWidth="1.8" markerEnd={`url(#${nlId})`} />
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={sx(t)} x2={sx(t)} y1={axisY - 7} y2={axisY + 7} stroke="#263746" strokeWidth="1.6" />
          <text x={sx(t)} y={axisY - 14} textAnchor="middle" className="chart-tick">{t}</text>
        </g>
      ))}
      {v.intervals.map((iv, i) => {
        const y = axisY + 30 + i * 46;
        const a = sx(val(iv.from)), b = sx(val(iv.to));
        const color = iv.color || PALETTE[i % PALETTE.length];
        return (
          <g key={i}>
            <line x1={a} x2={b} y1={y} y2={y} stroke={color} strokeWidth="6" strokeLinecap="butt" />
            {iv.from !== "-inf" && (
              <circle cx={a} cy={y} r="7" fill={iv.closedLeft ? color : "#fff"} stroke={color} strokeWidth="3" />
            )}
            {iv.to !== "+inf" && (
              <circle cx={b} cy={y} r="7" fill={iv.closedRight ? color : "#fff"} stroke={color} strokeWidth="3" />
            )}
            {iv.label && <text x={(a + b) / 2} y={y + 24} textAnchor="middle" className="chart-tick" fill={color}>{iv.label}</text>}
          </g>
        );
      })}
      {v.points?.map((q, i) => (
        <g key={i}>
          <circle cx={sx(q.x)} cy={axisY} r="6" fill={q.filled === false ? "#fff" : "#E4572E"} stroke="#E4572E" strokeWidth="2.5" />
          {q.label && <text x={sx(q.x)} y={axisY + 22} textAnchor="middle" className="chart-tick">{q.label}</text>}
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Miền nghiệm bất phương trình bậc nhất hai ẩn                        */
/* ------------------------------------------------------------------ */

function InequalityRegion({ v }: { v: RegionVisual }) {
  const W = 640, H = 480, p = 44;
  const sx = (x: number) => p + ((x - v.xMin) * (W - 2 * p)) / (v.xMax - v.xMin);
  const sy = (y: number) => H - p - ((y - v.yMin) * (H - 2 * p)) / (v.yMax - v.yMin);

  // quét lưới để tô miền nghiệm chung
  const N = 120;
  const cells: string[] = [];
  const dx = (v.xMax - v.xMin) / N, dy = (v.yMax - v.yMin) / N;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = v.xMin + (i + 0.5) * dx, y = v.yMin + (j + 0.5) * dy;
      const ok = v.constraints.every((c) => {
        const s = c.a * x + c.b * y;
        return c.op === "<=" ? s <= c.c : c.op === "<" ? s < c.c : c.op === ">=" ? s >= c.c : s > c.c;
      });
      if (ok) cells.push(`M ${sx(x - dx / 2).toFixed(1)} ${sy(y - dy / 2).toFixed(1)} h ${((W - 2 * p) / N).toFixed(2)} v ${-((H - 2 * p) / N).toFixed(2)} h ${-((W - 2 * p) / N).toFixed(2)} Z`);
    }
  }

  return (
    <svg className="region-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Miền nghiệm hệ bất phương trình">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <g stroke="#E2EAF1">
        {Array.from({ length: 11 }, (_, i) => <line key={`h${i}`} x1={p} x2={W - p} y1={p + (i * (H - 2 * p)) / 10} y2={p + (i * (H - 2 * p)) / 10} />)}
        {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} y1={p} y2={H - p} x1={p + (i * (W - 2 * p)) / 10} x2={p + (i * (W - 2 * p)) / 10} />)}
      </g>
      <path d={cells.join(" ")} fill="#0E8A7233" stroke="none" />
      <g stroke="#263746" strokeWidth="1.6">
        <line x1={p} x2={W - p} y1={sy(0)} y2={sy(0)} />
        <line y1={H - p} y2={p} x1={sx(0)} x2={sx(0)} />
      </g>
      {v.constraints.map((c, i) => {
        // đường a*x + b*y = c
        const color = PALETTE[i % PALETTE.length];
        const strict = c.op === "<" || c.op === ">";
        let x1: number, y1: number, x2: number, y2: number;
        if (Math.abs(c.b) > 1e-9) {
          x1 = v.xMin; y1 = (c.c - c.a * x1) / c.b;
          x2 = v.xMax; y2 = (c.c - c.a * x2) / c.b;
        } else {
          x1 = x2 = c.c / (c.a || 1); y1 = v.yMin; y2 = v.yMax;
        }
        return (
          <g key={i}>
            <line x1={sx(x1)} y1={sy(y1)} x2={sx(x2)} y2={sy(y2)} stroke={color} strokeWidth="2.4"
                  strokeDasharray={strict ? "8 5" : undefined} />
            {c.label && <text x={sx((x1 + x2) / 2) + 6} y={sy((y1 + y2) / 2) - 6} className="chart-tick" fill={color}>{c.label}</text>}
          </g>
        );
      })}
      {v.vertices?.map((q, i) => (
        <g key={i}>
          <circle cx={sx(q.x)} cy={sy(q.y)} r="5.5" fill="#E4572E" stroke="#fff" strokeWidth="1.5" />
          <text x={sx(q.x) + 9} y={sy(q.y) - 8} className="chart-tick">{q.label || `(${q.x}; ${q.y})`}</text>
        </g>
      ))}
      {v.objective && (
        <text x={W - 14} y={22} textAnchor="end" className="chart-title">
          {v.objective.label || `F = ${v.objective.p}x + ${v.objective.q}y`}
        </text>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Hình không gian (phép chiếu trục đo)                                */
/* ------------------------------------------------------------------ */

const LETTERS = "ABCDEFGH".split("");

function Solid3D({ v }: { v: Solid3DVisual }) {
  const W = 560, H = 460, cx = 280, cy = 300, s = 46;
  const proj = (x: number, y: number, z: number): [number, number] =>
    [cx + (x - y) * 0.866 * s, cy + ((x + y) * 0.5 - z) * s];

  const n = v.baseSides ?? (v.shape === "tetrahedron" ? 3 : 4);
  const h = v.height ?? 3.2;
  const r = 2.1;
  const labels = v.labels?.length ? v.labels : [];
  const nameOf = (i: number) => labels[i] ?? LETTERS[i] ?? `P${i}`;

  const nodes = new Map<string, [number, number]>();
  const edges: { a: [number, number]; b: [number, number]; dashed: boolean }[] = [];

  const base: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + (n === 4 ? Math.PI / 4 : Math.PI / 2);
    const pt = proj(r * Math.cos(a), r * Math.sin(a), 0);
    base.push(pt);
  }
  // đỉnh khuất: đỉnh có toạ độ màn hình cao nhất (ở xa nhất phía sau)
  let hidden = 0;
  base.forEach((pt, i) => { if (pt[1] < base[hidden][1]) hidden = i; });

  let apexLabelIndex = n;
  if (v.shape === "pyramid" || v.shape === "tetrahedron" || v.shape === "cone") {
    const apex = proj(0, 0, h);
    base.forEach((pt, i) => {
      nodes.set(nameOf(i), pt);
      edges.push({ a: pt, b: base[(i + 1) % n], dashed: i === hidden || (i + 1) % n === hidden });
      if (v.shape !== "cone") edges.push({ a: pt, b: apex, dashed: i === hidden });
    });
    nodes.set(labels[apexLabelIndex] ?? "S", apex);
  } else if (v.shape === "prism" || v.shape === "cube" || v.shape === "cylinder") {
    const top = base.map((_, i) => {
      const a = (Math.PI * 2 * i) / n + (n === 4 ? Math.PI / 4 : Math.PI / 2);
      return proj(r * Math.cos(a), r * Math.sin(a), h);
    });
    base.forEach((pt, i) => {
      nodes.set(nameOf(i), pt);
      nodes.set(labels[n + i] ?? `${nameOf(i)}'`, top[i]);
      edges.push({ a: pt, b: base[(i + 1) % n], dashed: i === hidden || (i + 1) % n === hidden });
      edges.push({ a: top[i], b: top[(i + 1) % n], dashed: false });
      edges.push({ a: pt, b: top[i], dashed: i === hidden });
    });
  }

  const isRound = v.shape === "cone" || v.shape === "cylinder" || v.shape === "sphere";
  const [ox, oy] = proj(0, 0, 0);
  const [tx, ty] = proj(0, 0, h);
  const rx = r * 0.866 * s * 1.15, ry = r * 0.5 * s;

  return (
    <svg className="solid-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={v.caption || "Hình không gian"}>
      <rect width={W} height={H} fill="#fff" rx="12" />
      {isRound && v.shape !== "sphere" && (
        <>
          <ellipse cx={ox} cy={oy} rx={rx} ry={ry} fill="#17324D10" stroke="#263746" strokeWidth="1.8" />
          <path d={`M ${ox - rx} ${oy} A ${rx} ${ry} 0 0 0 ${ox + rx} ${oy}`} fill="none" stroke="#263746" strokeWidth="1.8" />
          {v.shape === "cone" ? (
            <>
              <line x1={ox - rx} y1={oy} x2={tx} y2={ty} stroke="#263746" strokeWidth="1.8" />
              <line x1={ox + rx} y1={oy} x2={tx} y2={ty} stroke="#263746" strokeWidth="1.8" />
            </>
          ) : (
            <>
              <ellipse cx={tx} cy={ty} rx={rx} ry={ry} fill="#17324D10" stroke="#263746" strokeWidth="1.8" />
              <line x1={ox - rx} y1={oy} x2={tx - rx} y2={ty} stroke="#263746" strokeWidth="1.8" />
              <line x1={ox + rx} y1={oy} x2={tx + rx} y2={ty} stroke="#263746" strokeWidth="1.8" />
            </>
          )}
        </>
      )}
      {v.shape === "sphere" && (
        <>
          <circle cx={cx} cy={cy - 60} r={rx} fill="#17324D10" stroke="#263746" strokeWidth="1.8" />
          <ellipse cx={cx} cy={cy - 60} rx={rx} ry={ry * 0.7} fill="none" stroke="#263746" strokeWidth="1.4" strokeDasharray="6 5" />
          <circle cx={cx} cy={cy - 60} r="4" fill="#263746" />
          <line x1={cx} y1={cy - 60} x2={cx + rx} y2={cy - 60} stroke="#E4572E" strokeWidth="2" />
          <text x={cx + rx / 2} y={cy - 68} textAnchor="middle" className="chart-tick">R</text>
        </>
      )}

      {!isRound &&
        edges.map((e, i) => (
          <line key={i} x1={e.a[0]} y1={e.a[1]} x2={e.b[0]} y2={e.b[1]} stroke="#263746"
                strokeWidth={e.dashed ? 1.4 : 2} strokeDasharray={e.dashed ? "7 5" : undefined} />
        ))}

      {v.highlights?.map((hl, i) => {
        const a = nodes.get(hl.from), b = nodes.get(hl.to);
        if (!a || !b) return null;
        return (
          <g key={i}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={hl.color || "#E4572E"} strokeWidth="2.8"
                  strokeDasharray={hl.dashed ? "7 5" : undefined} />
            {hl.label && (
              <text x={(a[0] + b[0]) / 2 + 8} y={(a[1] + b[1]) / 2 - 6} className="chart-tick" fill={hl.color || "#E4572E"}>{hl.label}</text>
            )}
          </g>
        );
      })}

      {[...nodes.entries()].map(([name, pt], i) => (
        <g key={i}>
          <circle cx={pt[0]} cy={pt[1]} r="3.5" fill="#263746" />
          <text x={pt[0] + (pt[0] < cx ? -12 : 10)} y={pt[1] + (pt[1] < cy ? -8 : 16)} className="solid-label">{name}</text>
        </g>
      ))}
      {v.caption && <text x={W / 2} y={H - 12} textAnchor="middle" className="visual-caption-svg">{v.caption}</text>}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Hệ trục Oxyz                                                        */
/* ------------------------------------------------------------------ */

function Oxyz({ v }: { v: OxyzVisual }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const axId = `axArrow${uid}`;
  const vecId = `vecArrow${uid}`;
  const W = 560, H = 460, cx = 250, cy = 270;
  const range = v.range ?? 4;
  const s = 150 / range;
  const proj = (x: number, y: number, z: number): [number, number] =>
    [cx + (x - y * 0.62) * s, cy + (y * 0.46 - z) * s];
  const O = proj(0, 0, 0);

  return (
    <svg className="oxyz-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hệ trục toạ độ Oxyz">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <defs>
        <marker id={axId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#263746" />
        </marker>
        <marker id={vecId} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" fill="#E4572E" />
        </marker>
      </defs>
      {([["x", proj(range, 0, 0)], ["y", proj(0, range, 0)], ["z", proj(0, 0, range)]] as [string, [number, number]][]).map(([n, pt]) => (
        <g key={n}>
          <line x1={O[0]} y1={O[1]} x2={pt[0]} y2={pt[1]} stroke="#263746" strokeWidth="1.7" markerEnd={`url(#${axId})`} />
          <text x={pt[0] + 10} y={pt[1] + 4} className="chart-axis">{n}</text>
        </g>
      ))}
      <text x={O[0] - 14} y={O[1] + 16} className="chart-tick">O</text>

      {v.sphere && (() => {
        const c = proj(v.sphere.x, v.sphere.y, v.sphere.z);
        return (
          <g>
            <circle cx={c[0]} cy={c[1]} r={v.sphere.r * s} fill="#1D4ED815" stroke="#1D4ED8" strokeWidth="1.8" />
            <circle cx={c[0]} cy={c[1]} r="4" fill="#1D4ED8" />
            <text x={c[0] + 8} y={c[1] - 8} className="chart-tick">{v.sphere.label || "I"}</text>
          </g>
        );
      })()}

      {v.points?.map((q, i) => {
        const pt = proj(q.x, q.y, q.z);
        const foot = proj(q.x, q.y, 0);
        return (
          <g key={i}>
            <line x1={pt[0]} y1={pt[1]} x2={foot[0]} y2={foot[1]} stroke="#9AA9B8" strokeDasharray="5 4" />
            <line x1={O[0]} y1={O[1]} x2={foot[0]} y2={foot[1]} stroke="#9AA9B8" strokeDasharray="5 4" />
            <circle cx={pt[0]} cy={pt[1]} r="5.5" fill={PALETTE[i % PALETTE.length]} stroke="#fff" strokeWidth="1.4" />
            <text x={pt[0] + 9} y={pt[1] - 8} className="chart-tick">
              {q.label || `(${q.x}; ${q.y}; ${q.z})`}
            </text>
          </g>
        );
      })}

      {v.vectors?.map((vec, i) => {
        const end = proj(vec.x, vec.y, vec.z);
        return (
          <g key={i}>
            <line x1={O[0]} y1={O[1]} x2={end[0]} y2={end[1]} stroke={vec.color || "#E4572E"} strokeWidth="2.6" markerEnd={`url(#${vecId})`} />
            <text x={end[0] + 8} y={end[1] - 10} className="chart-tick" fill={vec.color || "#E4572E"}>{vec.label || ""}</text>
          </g>
        );
      })}

      {v.planes?.map((pl, i) => (
        <text key={i} x={16} y={26 + i * 20} className="chart-tick">
          ({pl.label || "P"}): {pl.a}x {pl.b >= 0 ? "+" : "−"} {Math.abs(pl.b)}y {pl.c >= 0 ? "+" : "−"} {Math.abs(pl.c)}z {pl.d >= 0 ? "+" : "−"} {Math.abs(pl.d)} = 0
        </text>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Vectơ trong mặt phẳng                                               */
/* ------------------------------------------------------------------ */

function Vector2D({ v }: { v: VectorVisual }) {
  const v2Id = `v2Arrow${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const W = 620, H = 460, p = 40;
  const sx = (x: number) => p + ((x - v.xMin) * (W - 2 * p)) / (v.xMax - v.xMin);
  const sy = (y: number) => H - p - ((y - v.yMin) * (H - 2 * p)) / (v.yMax - v.yMin);
  return (
    <svg className="vector-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hình vectơ">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <defs>
        <marker id={v2Id} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" fill="context-stroke" />
        </marker>
      </defs>
      <g stroke="#E9EFF4">
        {Array.from({ length: 11 }, (_, i) => <line key={`h${i}`} x1={p} x2={W - p} y1={p + (i * (H - 2 * p)) / 10} y2={p + (i * (H - 2 * p)) / 10} />)}
        {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} y1={p} y2={H - p} x1={p + (i * (W - 2 * p)) / 10} x2={p + (i * (W - 2 * p)) / 10} />)}
      </g>
      <g stroke="#263746" strokeWidth="1.5">
        <line x1={p} x2={W - p} y1={sy(0)} y2={sy(0)} />
        <line y1={H - p} y2={p} x1={sx(0)} x2={sx(0)} />
      </g>
      {v.polygon && v.polygon.length > 2 && (
        <polygon points={v.polygon.map((q) => `${sx(q.x)},${sy(q.y)}`).join(" ")}
                 fill="#0E8A7218" stroke="#0E8A72" strokeWidth="2" />
      )}
      {v.vectors.map((vec, i) => {
        const color = vec.color || PALETTE[i % PALETTE.length];
        return (
          <g key={i}>
            <line x1={sx(vec.x1)} y1={sy(vec.y1)} x2={sx(vec.x2)} y2={sy(vec.y2)} stroke={color} strokeWidth="2.8"
                  strokeDasharray={vec.dashed ? "7 5" : undefined} markerEnd={`url(#${v2Id})`} />
            {vec.label && (
              <text x={(sx(vec.x1) + sx(vec.x2)) / 2 + 8} y={(sy(vec.y1) + sy(vec.y2)) / 2 - 8}
                    className="chart-tick" fill={color}>{vec.label}</text>
            )}
          </g>
        );
      })}
      {v.points?.map((q, i) => (
        <g key={i}>
          <circle cx={sx(q.x)} cy={sy(q.y)} r="5" fill="#263746" />
          <text x={sx(q.x) + 8} y={sy(q.y) - 8} className="chart-tick">{q.label || ""}</text>
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Biểu đồ Ven                                                         */
/* ------------------------------------------------------------------ */

function Venn({ v }: { v: VennVisual }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const W = 560, H = 340;
  const two = v.sets.length <= 2;
  const centers = two
    ? [[220, 170], [340, 170]]
    : [[220, 145], [340, 145], [280, 245]];
  const R = two ? 105 : 95;
  const shade = new Set(v.shade ?? []);
  const names = v.sets.map((s) => s.name);

  return (
    <svg className="venn-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ Ven">
      <rect width={W} height={H} fill="#fff" rx="12" />
      <rect x="60" y="40" width={W - 120} height={H - 80} fill="none" stroke="#9AA9B8" strokeWidth="1.5" rx="8" />
      <text x="70" y="60" className="chart-tick">E</text>
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
      {v.caption && <text x={W / 2} y={H - 12} textAnchor="middle" className="visual-caption-svg">{v.caption}</text>}
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
          <tr>{v.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {v.rows.map((row, i) => (
            <tr key={i} className={v.highlightRow === i ? "hl" : undefined}>
              {row.map((cell, j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {v.caption && <small className="visual-caption">{v.caption}</small>}
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
      <p className="quiz-question">{v.question}</p>
      <div className="quiz-options">
        {v.options.map((o, i) => {
          const correct = i === v.answerIndex;
          const cls = !revealed ? "" : correct ? " correct" : i === picked ? " wrong" : " dim";
          return (
            <button key={i} type="button" className={`quiz-option${cls}`} onClick={() => setPicked(i)}>
              <b>{String.fromCharCode(65 + i)}</b>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
      {revealed && v.explanation && <p className="quiz-explain">💡 {v.explanation}</p>}
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
