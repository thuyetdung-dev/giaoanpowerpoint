import { renderToStaticMarkup } from "react-dom/server";
import { MathVisual } from "../components/MathVisuals";
import { VISUAL_LABEL } from "../lib/themes";
import type { Visual } from "../lib/types";
import { visualCanvas, svgFontPx, visualAspect, BAND, BAND_H } from "../lib/slides";

(globalThis as any).renderVisual = (v: Visual) => renderToStaticMarkup(<MathVisual visual={v} />);
(globalThis as any).canvasOf = visualCanvas;
(globalThis as any).fontOf = svgFontPx;
(globalThis as any).aspectOf = visualAspect;
(globalThis as any).LABELS = VISUAL_LABEL;
// Ô ảnh thật trên slide, tính từ chính hằng bố cục — bộ đo dùng lại số này.
(globalThis as any).IMG_BOX = {
  IMG_W_PT: (BAND.w - 0.3) * 72,
  IMG_H_PT: (BAND_H - 0.3 - 0.08) * 72,
};
