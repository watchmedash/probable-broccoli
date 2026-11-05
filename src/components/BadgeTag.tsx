/** A hub badge: its own background colour with white or black text. */
export function BadgeTag({ text, color, textColor, style }: { text: string; color: string; textColor?: string | null; style?: React.CSSProperties }) {
  return <span className="tag" style={{ background: color, color: textColor || "#fff", ...style }}>{text}</span>;
}

/** Black or white, whichever reads better on [hex]. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#000000" : "#FFFFFF";
}
