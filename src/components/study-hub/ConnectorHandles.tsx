import { useEffect, useRef, useState } from "react";

// Connector handles — draws 4 blue dots around the selected shape so the user
// can drag out a bound arrow from any side (draw.io / Miro style).
const BINDABLE = new Set(["rectangle", "diamond", "ellipse", "image", "text"]);
type SelInfo = { el: any; zoom: number; scrollX: number; scrollY: number; tick: number };

export function ConnectorHandles({
  apiRef,
  containerRef,
}: {
  apiRef: React.MutableRefObject<any>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [sel, setSel] = useState<SelInfo | null>(null);
  const draggingRef = useRef(false);
  const convertRef = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    if (!import.meta.env.SSR) {
      import("@excalidraw/excalidraw").then((m) => {
        if (alive) convertRef.current = m.convertToExcalidrawElements;
      });
    }
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const api = apiRef.current;
      if (api && !draggingRef.current) {
        try {
          const st = api.getAppState();
          const els = api.getSceneElements();
          const ids = Object.keys(st.selectedElementIds || {}).filter(
            (id) => st.selectedElementIds[id],
          );
          if (ids.length === 1) {
            const el = els.find((e: any) => e.id === ids[0]);
            if (el && !el.isDeleted && BINDABLE.has(el.type)) {
              setSel({
                el,
                zoom: st.zoom?.value ?? 1,
                scrollX: st.scrollX ?? 0,
                scrollY: st.scrollY ?? 0,
                tick: Date.now(),
              });
            } else {
              setSel(null);
            }
          } else {
            setSel(null);
          }
        } catch {
          /* noop */
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [apiRef]);

  if (!sel || !containerRef.current) return null;
  const { el, zoom, scrollX, scrollY } = sel;
  const toPx = (sx: number, sy: number) => ({
    x: (sx + scrollX) * zoom,
    y: (sy + scrollY) * zoom,
  });
  const anchors = [
    { key: "t", sx: el.x + el.width / 2, sy: el.y },
    { key: "r", sx: el.x + el.width, sy: el.y + el.height / 2 },
    { key: "b", sx: el.x + el.width / 2, sy: el.y + el.height },
    { key: "l", sx: el.x, sy: el.y + el.height / 2 },
  ];

  const dirVec = (key: string) =>
    key === "t" ? { dx: 0, dy: -1 } :
    key === "r" ? { dx: 1, dy: 0 } :
    key === "b" ? { dx: 0, dy: 1 } :
                  { dx: -1, dy: 0 };

  const fpFor = (key: string): [number, number] =>
    key === "t" ? [0.5, 0] :
    key === "r" ? [1, 0.5] :
    key === "b" ? [0.5, 1] :
                  [0, 0.5];

  const oppositeFp = (key: string): [number, number] =>
    key === "t" ? [0.5, 1] :
    key === "r" ? [0, 0.5] :
    key === "b" ? [0.5, 0] :
                  [1, 0.5];

  const sideFp = (side: "t" | "r" | "b" | "l"): [number, number] => fpFor(side);

  const sideAnchor = (target: any, side: "t" | "r" | "b" | "l") => ({
    x: side === "l" ? target.x : side === "r" ? target.x + target.width : target.x + target.width / 2,
    y: side === "t" ? target.y : side === "b" ? target.y + target.height : target.y + target.height / 2,
  });

  const nearestSide = (target: any, p: { x: number; y: number }): "t" | "r" | "b" | "l" => {
    const dLeft = Math.abs(p.x - target.x);
    const dRight = Math.abs(p.x - (target.x + target.width));
    const dTop = Math.abs(p.y - target.y);
    const dBottom = Math.abs(p.y - (target.y + target.height));
    const minD = Math.min(dLeft, dRight, dTop, dBottom);
    return minD === dTop ? "t" : minD === dBottom ? "b" : minD === dLeft ? "l" : "r";
  };

  const distanceToElement = (target: any, p: { x: number; y: number }) => {
    const dx = Math.max(target.x - p.x, 0, p.x - (target.x + target.width));
    const dy = Math.max(target.y - p.y, 0, p.y - (target.y + target.height));
    return Math.hypot(dx, dy);
  };

  const addBoundArrow = (target: any, arrowId: string) => {
    const existing = Array.isArray(target.boundElements) ? target.boundElements : [];
    if (existing.some((b: any) => b.id === arrowId)) return target;
    return {
      ...target,
      boundElements: [...existing, { id: arrowId, type: "arrow" }],
      version: (target.version ?? 1) + 1,
      versionNonce: Math.floor(Math.random() * 2 ** 31),
      updated: Date.now(),
    };
  };

  const dedupePoints = (points: [number, number][]) =>
    points.filter((p, i) => i === 0 || Math.abs(p[0] - points[i - 1][0]) > 0.5 || Math.abs(p[1] - points[i - 1][1]) > 0.5);

  const elbowPoints = (start: { x: number; y: number }, end: { x: number; y: number }, key: string): [number, number][] => {
    const relX = end.x - start.x;
    const relY = end.y - start.y;
    if (key === "r" || key === "l") {
      const dir = key === "r" ? 1 : -1;
      const midX = dir * relX > 36 ? relX / 2 : dir * 36;
      return dedupePoints([[0, 0], [midX, 0], [midX, relY], [relX, relY]]);
    }
    const dir = key === "b" ? 1 : -1;
    const midY = dir * relY > 36 ? relY / 2 : dir * 36;
    return dedupePoints([[0, 0], [0, midY], [relX, midY], [relX, relY]]);
  };

  // Click behavior: duplicate the shape in the direction of the handle and
  // connect it with an elbow arrow (like Excalidraw's Ctrl+Arrow shortcut).
  const cloneInDirection = (a: (typeof anchors)[number]) => {
    const api = apiRef.current;
    const convert = convertRef.current;
    if (!api || !convert) return;
    const { dx, dy } = dirVec(a.key);
    const gap = 80;
    const nx = el.x + dx * (el.width + gap);
    const ny = el.y + dy * (el.height + gap);
    const built = convert([
      {
        type: el.type,
        x: nx,
        y: ny,
        width: el.width,
        height: el.height,
        strokeColor: el.strokeColor,
        backgroundColor: el.backgroundColor,
        fillStyle: el.fillStyle,
        strokeWidth: el.strokeWidth,
        strokeStyle: el.strokeStyle,
        roughness: el.roughness,
        roundness: el.roundness,
      } as any,
      {
        type: "arrow",
        x: a.sx,
        y: a.sy,
        points: [
          [0, 0],
          [dx * gap, dy * gap],
        ],
        strokeColor: el.strokeColor,
        strokeWidth: el.strokeWidth ?? 2,
        endArrowhead: "arrow",
        elbowed: true,
        roundness: null,
      } as any,
    ]);
    const newShape = built[0];
    const start = { x: a.sx, y: a.sy };
    const arrow: any = {
      ...built[1],
      points: elbowPoints(start, { x: start.x + dx * gap, y: start.y + dy * gap }, a.key),
      elbowed: false,
      roundness: null,
      startBinding: { elementId: el.id, focus: 0, gap: 1, fixedPoint: fpFor(a.key) },
      endBinding: { elementId: newShape.id, focus: 0, gap: 1, fixedPoint: oppositeFp(a.key) },
    };
    const current = api.getSceneElements();
    api.updateScene({
      elements: current.map((n: any) => n.id === el.id ? addBoundArrow(n, arrow.id) : n).concat(addBoundArrow(newShape, arrow.id), arrow),
      appState: { selectedElementIds: { [newShape.id]: true } },
    });
  };

  const startDrag = (e: React.PointerEvent, a: (typeof anchors)[number]) => {
    e.preventDefault();
    e.stopPropagation();
    const api = apiRef.current;
    const convert = convertRef.current;
    const cont = containerRef.current;
    if (!api || !convert || !cont) return;
    const rect = cont.getBoundingClientRect();
    const downX = e.clientX;
    const downY = e.clientY;
    const CLICK_THRESHOLD = 4;
    let arrowCreated = false;
    let arrowId: string | null = null;
    const start = { x: a.sx, y: a.sy };
    const fpStart = fpFor(a.key);
    const { dx: ddx, dy: ddy } = dirVec(a.key);

    const scenePt = (ev: PointerEvent) => {
      const st = api.getAppState();
      const z = st.zoom?.value ?? 1;
      return {
        x: (ev.clientX - rect.left) / z - (st.scrollX ?? 0),
        y: (ev.clientY - rect.top) / z - (st.scrollY ?? 0),
      };
    };

    const findTarget = (scn: { x: number; y: number }) => {
      const arr = api.getSceneElements();
      const st = api.getAppState();
      const z = st.zoom?.value ?? 1;
      const hitMargin = Math.max(18, 34 / z);
      return [...arr]
        .reverse()
        .filter(
          (n: any) =>
            !n.isDeleted &&
            n.id !== el.id &&
            n.id !== arrowId &&
            BINDABLE.has(n.type) &&
            distanceToElement(n, scn) <= hitMargin,
        )
        .sort((x: any, y: any) => distanceToElement(x, scn) - distanceToElement(y, scn))[0];
    };

    // Create a NATIVE elbowed arrow with startBinding fixedPoint — same shape
    // that cloneInDirection (Ctrl+→) produces. Excalidraw handles the routing.
    const createArrow = (ev: PointerEvent) => {
      const st = api.getAppState();
      const end0 = scenePt(ev);
      const built = convert([
        {
          type: "arrow",
          x: start.x,
          y: start.y,
          points: [
            [0, 0],
            [Math.max(Math.abs(end0.x - start.x), 40) * ddx || end0.x - start.x,
             Math.max(Math.abs(end0.y - start.y), 40) * ddy || end0.y - start.y],
          ],
          strokeColor: st.currentItemStrokeColor ?? "#1e1e1e",
          strokeWidth: st.currentItemStrokeWidth ?? 2,
          endArrowhead: "arrow",
          elbowed: true,
          roundness: null,
        } as any,
      ]);
      const arrow: any = {
        ...built[0],
        elbowed: true,
        roundness: null,
        startBinding: { elementId: el.id, focus: 0, gap: 1, fixedPoint: fpStart },
        endBinding: null,
      };
      arrowId = arrow.id;
      const current = api.getSceneElements();
      api.updateScene({
        elements: current
          .map((n: any) => (n.id === el.id ? addBoundArrow(n, arrow.id) : n))
          .concat(arrow),
      });
      arrowCreated = true;
      draggingRef.current = true;
    };

    const updateArrow = (ev: PointerEvent, finalize = false) => {
      if (!arrowId) return;
      const scn = scenePt(ev);
      const target = findTarget(scn);
      const arr = api.getSceneElements();
      const next = arr.map((n: any) => {
        if (n.id === arrowId) {
          let endPoint = scn;
          let endBinding: any = null;
          if (target) {
            const side = nearestSide(target, scn);
            endPoint = sideAnchor(target, side);
            endBinding = {
              elementId: target.id,
              focus: 0,
              gap: 1,
              fixedPoint: sideFp(side),
            };
          }
          return {
            ...n,
            points: [
              [0, 0],
              [endPoint.x - start.x, endPoint.y - start.y],
            ],
            endBinding,
            version: (n.version ?? 1) + 1,
            versionNonce: Math.floor(Math.random() * 2 ** 31),
          };
        }
        if (finalize && target && n.id === target.id) {
          return addBoundArrow(n, arrowId!);
        }
        return n;
      });
      api.updateScene({ elements: next });
    };

    const onMove = (ev: PointerEvent) => {
      if (!arrowCreated) {
        if (Math.hypot(ev.clientX - downX, ev.clientY - downY) < CLICK_THRESHOLD) return;
        createArrow(ev);
        return;
      }
      updateArrow(ev);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      draggingRef.current = false;
      if (!arrowCreated) {
        // Treat as click → duplicate shape in the handle's direction
        cloneInDirection(a);
        return;
      }
      updateArrow(ev, true);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {anchors.map((a) => {
        const p = toPx(a.sx, a.sy);
        return (
          <div
            key={a.key}
            onPointerDown={(e) => startDrag(e, a)}
            title="Clique para duplicar nessa direção ou arraste para conectar"
            className="pointer-events-auto absolute rounded-full bg-blue-500 border-2 border-white shadow-md cursor-crosshair hover:scale-125 transition-transform"
            style={{
              left: p.x - 6,
              top: p.y - 6,
              width: 12,
              height: 12,
            }}
          />
        );
      })}
    </div>
  );
}
