"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";

const SHAPES = {
  icon: { title: "Adjust icon", aspect: 1, radius: "25%", width: 512 },
  avatar: { title: "Adjust picture", aspect: 1, radius: "50%", width: 512 },
  cover: { title: "Adjust cover", aspect: 4, radius: "0", width: 1600 },
} as const;
export type CropShape = keyof typeof SHAPES;

const MAX_ZOOM = 4;

/** Position and zoom a picture inside the shape it will show in. Hands back the cropped picture as a new file. */
export function ImageCropper({ file, shape, onCancel, onDone }: { file: File; shape: CropShape; onCancel: () => void; onDone: (cropped: File) => Promise<void> | void }) {
  const { title, aspect, radius, width } = SHAPES[shape];
  const frame = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const frameSize = () => {
    const w = frame.current?.clientWidth ?? 1;
    return { fw: w, fh: w / aspect };
  };
  const baseScale = (s: { w: number; h: number }) => {
    const { fw, fh } = frameSize();
    return Math.max(fw / s.w, fh / s.h);
  };
  // The picture always covers the whole frame.
  const fit = (zoom: number, x: number, y: number) => {
    if (!size) return { zoom, x, y };
    const { fw, fh } = frameSize();
    const scale = baseScale(size) * zoom;
    return {
      zoom,
      x: Math.min(0, Math.max(fw - size.w * scale, x)),
      y: Math.min(0, Math.max(fh - size.h * scale, y)),
    };
  };
  const zoomTo = (next: number | ((zoom: number) => number)) => setView(v => {
    const { fw, fh } = frameSize();
    const wanted = typeof next === "function" ? next(v.zoom) : next;
    const zoom = Math.min(MAX_ZOOM, Math.max(1, wanted));
    const change = zoom / v.zoom;
    return fit(zoom, fw / 2 - (fw / 2 - v.x) * change, fh / 2 - (fh / 2 - v.y) * change);
  });
  const zoomRef = useRef(zoomTo);
  useEffect(() => { zoomRef.current = zoomTo; });

  // Added by hand: the page would scroll as well if this listener were passive, which React's are.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current(z => z * (e.deltaY < 0 ? 1.1 : 0.9));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  function onLoad() {
    const img = picture.current;
    if (!img) return;
    const s = { w: img.naturalWidth, h: img.naturalHeight };
    setSize(s);
    const { fw, fh } = frameSize();
    const scale = Math.max(fw / s.w, fh / s.h);
    setView({ zoom: 1, x: (fw - s.w * scale) / 2, y: (fh - s.h * scale) / 2 });
  }

  function onMove(e: React.PointerEvent) {
    const last = pointers.current.get(e.pointerId);
    if (!last) return;
    const before = [...pointers.current.values()];
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (before.length === 2) {
      // Two fingers pinch.
      const now = [...pointers.current.values()];
      const apart = (p: { x: number; y: number }[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (apart(before) > 0) zoomTo(z => z * (apart(now) / apart(before)));
      return;
    }
    setView(v => fit(v.zoom, v.x + e.clientX - last.x, v.y + e.clientY - last.y));
  }

  async function save() {
    const img = picture.current;
    if (!img || !size) return;
    setBusy(true);
    const { fw, fh } = frameSize();
    const scale = baseScale(size) * view.zoom;
    const outW = Math.min(width, Math.round(fw / scale));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = Math.round(outW / aspect);
    canvas.getContext("2d")?.drawImage(img, -view.x / scale, -view.y / scale, fw / scale, fh / scale, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/webp", 0.9));
    if (!blob) { setBusy(false); return onCancel(); }
    try {
      await onDone(new File([blob], "picture", { type: blob.type }));
    } finally {
      setBusy(false);
    }
  }

  const scale = size ? baseScale(size) * view.zoom : 1;
  return (
    <div className="dialog-back">
      <div className="dialog crop-dialog" role="dialog" aria-modal aria-label={title}>
        <h2>{title}</h2>
        <div
          ref={frame}
          className="crop-frame"
          style={{ aspectRatio: String(aspect), maxWidth: aspect === 1 ? 340 : undefined }}
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); }}
          onPointerMove={onMove}
          onPointerUp={e => pointers.current.delete(e.pointerId)}
          onPointerCancel={e => pointers.current.delete(e.pointerId)}
        >
          {url && (
            <img
              ref={picture}
              src={url}
              alt=""
              draggable={false}
              onLoad={onLoad}
              onError={onCancel}
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${scale})`, visibility: size ? "visible" : "hidden" }}
            />
          )}
          {radius !== "0" && <span className="crop-ring" style={{ borderRadius: radius }} />}
        </div>
        <input type="range" aria-label="Zoom" min={1} max={MAX_ZOOM} step={0.01} value={view.zoom} onChange={e => zoomTo(Number(e.target.value))} />
        <div className="row">
          <button className="btn quiet" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn" onClick={save} disabled={busy || !size}>{busy ? "Uploading..." : "Use photo"}</button>
        </div>
      </div>
    </div>
  );
}
