import type { GraphVisual } from "./types";

type GraphPoint = NonNullable<GraphVisual["points"]>[number];

/** Ẩn các điểm CĐ, CT và tâm I để đồ thị không bị rối; giữ các điểm khác. */
export function graphPointsToDisplay(points: GraphPoint[] | undefined): GraphPoint[] {
  return (points ?? []).filter((point) => {
    if (point.kind === "max" || point.kind === "min" || point.kind === "center") return false;
    const label = String(point.label ?? "")
      .normalize("NFC")
      .trim()
      .toLocaleLowerCase("vi-VN");
    // Lọc cả JSON cũ không có `kind`, nhưng có nhãn CĐ(...), CT(...) hoặc I(...).
    return !/^(?:cđ|ct|cực\s*đại|cực\s*tiểu|tâm\s*đối\s*xứng|i\s*\()/.test(label);
  });
}
