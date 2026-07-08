// Converts a MindMapFromVideoResult into ready-to-insert Excalidraw elements
// (rectangles + curved connectors) using the same visual language as the
// manual "Mapa mental" template in StudyHubTabs.tsx.
//
// Leaves and branches receive a YouTube deep-link at `?t=<seconds>` so
// clicking the node in Excalidraw jumps to that moment of the video.

export interface MindMapSpec {
  central: string;
  branches: Array<{
    label: string;
    timestamp: number;
    children: Array<{ label: string; timestamp: number }>;
  }>;
  youtubeId: string;
}

export interface BuildOpts {
  centerX: number;
  centerY: number;
}

// Base sizes — actual width/height are computed per-node from label length
// so long labels don't get clipped inside the box.
const CW_MIN = 260;
const CH_MIN = 90;
const BW_MIN = 220;
const BH_MIN = 64;
const LW_MIN = 200;
const LH_MIN = 52;

const STROKE = "#1e1e1e";
const CENTRAL_BG = "#fef3c7"; // soft yellow to stand out
const BRANCH_BG = "#dbeafe"; // soft blue
const LEAF_BG = "#ffffff";

// Rough text-fit heuristic: characters per line at a given font size, then
// grow width up to ~28 chars and add height for extra wrapped lines.
function fitBox(text: string, fontSize: number, minW: number, minH: number) {
  const t = (text ?? "").trim();
  const avgCharPx = fontSize * 0.58;
  const padX = 24;
  const padY = 18;
  const singleLineW = Math.ceil(t.length * avgCharPx) + padX * 2;
  const maxW = Math.max(minW, Math.min(360, singleLineW));
  const charsPerLine = Math.max(1, Math.floor((maxW - padX * 2) / avgCharPx));
  const lines = Math.max(1, Math.ceil(t.length / charsPerLine));
  const w = Math.max(minW, Math.min(360, singleLineW));
  const h = Math.max(minH, lines * (fontSize * 1.3) + padY * 2);
  return { w: Math.round(w), h: Math.round(h) };
}

function ytLink(id: string, seconds: number) {
  const t = Math.max(0, Math.floor(seconds || 0));
  return `https://youtu.be/${id}?t=${t}`;
}

// Simple curved connector using line with roundness type 2 (bezier).
// Uses start/end bindings so the connector stays glued to the nodes when
// the user drags them.
function connector(
  fromId: string,
  toId: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  return {
    type: "line" as const,
    x: fromX,
    y: fromY,
    strokeColor: STROKE,
    strokeWidth: 2,
    roundness: { type: 2 },
    points: [
      [0, 0],
      [dx * 0.5, 0],
      [dx * 0.5, dy],
      [dx, dy],
    ],
    start: { id: fromId },
    end: { id: toId },
  };
}

export function buildMindMapFromVideoElements(
  spec: MindMapSpec,
  opts: BuildOpts,
): any[] {
  const t = Date.now();
  const centerId = `mmv-c-${t}`;
  const cx = opts.centerX - CW / 2;
  const cy = opts.centerY - CH / 2;

  const elements: any[] = [
    {
      type: "rectangle",
      id: centerId,
      x: cx,
      y: cy,
      width: CW,
      height: CH,
      strokeColor: STROKE,
      backgroundColor: CENTRAL_BG,
      fillStyle: "solid",
      strokeWidth: 2,
      roundness: { type: 3 },
      label: { text: spec.central, fontSize: 20 },
    },
  ];

  const branches = spec.branches ?? [];
  if (branches.length === 0) return elements;

  // Split branches into left / right columns; left gets the "later" half so
  // the top-right ramp reads first (natural reading order).
  const rightCount = Math.ceil(branches.length / 2);
  const leftCount = branches.length - rightCount;

  const branchGapX = 260; // horizontal distance from center to branch box
  const branchGapY = 28; // vertical gap between branches in same column
  const leafGapX = 240;
  const leafGapY = 18;

  const layoutColumn = (
    items: Array<{ label: string; timestamp: number; children: Array<{ label: string; timestamp: number }> }>,
    side: "left" | "right",
    colOffset: number,
  ) => {
    const totalH = items.reduce((sum, b) => {
      const leaves = b.children.length;
      const stack = Math.max(BH, leaves * LH + Math.max(0, leaves - 1) * leafGapY);
      return sum + stack + branchGapY;
    }, -branchGapY);

    let cursorY = opts.centerY - totalH / 2;

    items.forEach((b, i) => {
      const leaves = b.children;
      const stack = Math.max(BH, leaves.length * LH + Math.max(0, leaves.length - 1) * leafGapY);
      const bTop = cursorY;
      const bMid = bTop + stack / 2;
      const bX =
        side === "right"
          ? opts.centerX + colOffset
          : opts.centerX - colOffset - BW;
      const bY = bMid - BH / 2;
      const branchId = `mmv-b-${t}-${side}-${i}`;

      elements.push({
        type: "rectangle",
        id: branchId,
        x: bX,
        y: bY,
        width: BW,
        height: BH,
        strokeColor: STROKE,
        backgroundColor: BRANCH_BG,
        fillStyle: "solid",
        strokeWidth: 2,
        roundness: { type: 3 },
        label: { text: b.label, fontSize: 16 },
        link: ytLink(spec.youtubeId, b.timestamp),
      });

      // Connect center → branch (start at center edge on that side)
      const centerEdgeX = side === "right" ? cx + CW : cx;
      const centerMidY = cy + CH / 2;
      const branchEdgeX = side === "right" ? bX : bX + BW;
      const branchMidY = bY + BH / 2;
      elements.push(
        connector(centerId, branchId, centerEdgeX, centerMidY, branchEdgeX, branchMidY),
      );

      // Leaves
      let leafY = bTop;
      leaves.forEach((leaf, j) => {
        const lX =
          side === "right"
            ? bX + BW + leafGapX - BW
            : bX - (leafGapX - BW) - LW;
        const lY = leafY;
        const leafId = `mmv-l-${t}-${side}-${i}-${j}`;
        elements.push({
          type: "rectangle",
          id: leafId,
          x: lX,
          y: lY,
          width: LW,
          height: LH,
          strokeColor: STROKE,
          backgroundColor: LEAF_BG,
          fillStyle: "solid",
          strokeWidth: 1,
          roundness: { type: 3 },
          label: { text: leaf.label, fontSize: 14 },
          link: ytLink(spec.youtubeId, leaf.timestamp),
        });
        const bEdgeX = side === "right" ? bX + BW : bX;
        const bMidY2 = bY + BH / 2;
        const lEdgeX = side === "right" ? lX : lX + LW;
        const lMidY = lY + LH / 2;
        elements.push(connector(branchId, leafId, bEdgeX, bMidY2, lEdgeX, lMidY));

        leafY += LH + leafGapY;
      });

      cursorY += stack + branchGapY;
    });
  };

  layoutColumn(branches.slice(0, rightCount), "right", branchGapX);
  if (leftCount > 0) {
    layoutColumn(branches.slice(rightCount), "left", branchGapX);
  }

  return elements;
}
