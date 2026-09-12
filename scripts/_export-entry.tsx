import { renderToStaticMarkup } from "react-dom/server";
import { MathVisual } from "../components/MathVisuals";
import { exportPptx, lastRichMathReport } from "../lib/exporters";
import { buildDeck } from "../lib/slides";
(globalThis as any).renderVisual = (v: any) => renderToStaticMarkup(<MathVisual visual={v} />);
(globalThis as any).exportPptx = exportPptx;
(globalThis as any).buildDeck = buildDeck;
(globalThis as any).richMathReport = () => lastRichMathReport;
