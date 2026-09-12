import { renderToStaticMarkup } from "react-dom/server";
import { MathVisual } from "../components/MathVisuals";
import { VISUAL_LABEL } from "../lib/themes";
import type { Visual } from "../lib/types";
import { visualCanvas, svgFontPx, visualAspect } from "../lib/slides";

(globalThis as any).renderVisual = (v: Visual) => renderToStaticMarkup(<MathVisual visual={v} />);
(globalThis as any).canvasOf = visualCanvas;
(globalThis as any).fontOf = svgFontPx;
(globalThis as any).aspectOf = visualAspect;
(globalThis as any).LABELS = VISUAL_LABEL;
