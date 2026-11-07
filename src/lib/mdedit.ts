/** The text after an edit, with what should be selected. */
export type Edit = { text: string; start: number; end: number };

/** **selection**, or takes the markers off again. With nothing selected the cursor lands between them. */
export function wrapSelection(text: string, start: number, end: number, marker: string): Edit {
  const n = marker.length;
  const inner = text.slice(start, end);
  if (text.slice(start - n, start) === marker && text.slice(end, end + n) === marker) {
    return { text: text.slice(0, start - n) + inner + text.slice(end + n), start: start - n, end: end - n };
  }
  return { text: text.slice(0, start) + marker + inner + marker + text.slice(end), start: start + n, end: end + n };
}

/** Puts a prefix on every selected line (counting up if numbered), or takes it off if all have it. */
export function linePrefix(text: string, start: number, end: number, prefix: string, numbered = false): Edit {
  const from = text.lastIndexOf("\n", start - 1) + 1;
  const nl = text.indexOf("\n", end);
  const to = nl === -1 ? text.length : nl;
  const lines = text.slice(from, to).split("\n");
  const marked = numbered ? /^\d+\. / : new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const out = lines.every(l => marked.test(l))
    ? lines.map(l => l.replace(marked, ""))
    : lines.map((l, i) => (numbered ? `${i + 1}. ` : prefix) + l);
  const joined = out.join("\n");
  const caret = from + joined.length;
  return { text: text.slice(0, from) + joined + text.slice(to), start: lines.length > 1 || start !== end ? from : caret, end: caret };
}

/** A picture on its own line where the cursor is, with the cursor after it. */
export function imageMarkdown(text: string, start: number, end: number, url: string): Edit {
  const before = start > 0 && text[start - 1] !== "\n" ? "\n\n" : "";
  const inserted = `${before}![](${url})\n\n`;
  const caret = start + inserted.length;
  return { text: text.slice(0, start) + inserted + text.slice(end), start: caret, end: caret };
}

/** A safe https address; when pasted, it also has to look like a picture so ordinary links stay links. */
export function isImageUrl(value: string, mustLookLikePicture: boolean): boolean {
  if (/[\s()]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return !mustLookLikePicture || /\.(jpe?g|png|gif|webp|avif)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

const BODY_IMAGE = /!\[[^\]]*\]\((https:\/\/[^\s)]+)\)/;

/** The first picture written into the text, which stands in for the post's picture in feeds. */
export function firstBodyImage(body: string): string | null {
  return BODY_IMAGE.exec(body)?.[1] ?? null;
}

/** [tag]selection[/tag] (or any opening and closing pair), or takes them off again. */
export function wrapWith(text: string, start: number, end: number, open: string, close: string): Edit {
  const inner = text.slice(start, end);
  if (text.slice(start - open.length, start) === open && text.slice(end, end + close.length) === close) {
    return { text: text.slice(0, start - open.length) + inner + text.slice(end + close.length), start: start - open.length, end: end - open.length };
  }
  return { text: text.slice(0, start) + open + inner + close + text.slice(end), start: start + open.length, end: end + open.length };
}

/** Paragraph (0) or Heading 1 to 3 for the lines the cursor or selection touches. */
export function setHeading(text: string, start: number, end: number, level: number): Edit {
  const from = text.lastIndexOf("\n", start - 1) + 1;
  const nl = text.indexOf("\n", end);
  const to = nl === -1 ? text.length : nl;
  const lines = text.slice(from, to).split("\n").map(l => (level ? "#".repeat(level) + " " : "") + l.replace(/^#{1,6}\s+/, ""));
  const joined = lines.join("\n");
  return { text: text.slice(0, from) + joined + text.slice(to), start: from + joined.length, end: from + joined.length };
}

/** The heading level of the line the cursor is on, 0 for a paragraph. */
export function headingAt(text: string, at: number): number {
  const from = text.lastIndexOf("\n", at - 1) + 1;
  return Math.min(/^(#{1,6})\s/.exec(text.slice(from))?.[1].length ?? 0, 3);
}

export type Align = "left" | "center" | "right";

/** The [center] or [right] block the cursor is in, if any. */
function blockAt(text: string, at: number): { tag: "center" | "right"; open: number; body: number; close: number; end: number } | null {
  const opens = [...text.slice(0, at).matchAll(/\[(center|right)\]\n/gi)];
  const last = opens[opens.length - 1];
  if (!last) return null;
  const tag = last[1].toLowerCase() as "center" | "right";
  const body = last.index + last[0].length;
  const close = text.toLowerCase().indexOf(`\n[/${tag}]`, body - 1);
  if (close === -1 || close < at) return null;
  return { tag, open: last.index, body, close, end: close + tag.length + 4 };
}

/** How the line the cursor is on is aligned. */
export function alignAt(text: string, at: number): Align {
  return blockAt(text, at)?.tag ?? "left";
}

/** Aligns the lines the selection touches; inside a [center] or [right] block, the whole block changes. */
export function setAlign(text: string, start: number, end: number, align: Align): Edit {
  const block = blockAt(text, start);
  let from: number, to: number;
  if (block) {
    const body = text.slice(block.body, block.close);
    text = text.slice(0, block.open) + body + text.slice(block.end);
    from = block.open;
    to = block.open + body.length;
  } else {
    from = text.lastIndexOf("\n", start - 1) + 1;
    const nl = text.indexOf("\n", end);
    to = nl === -1 ? text.length : nl;
  }
  const body = text.slice(from, to);
  if (align === "left") return { text, start: from, end: to };
  const shift = align.length + 3;
  return { text: text.slice(0, from) + `[${align}]\n${body}\n[/${align}]` + text.slice(to), start: from + shift, end: from + shift + body.length };
}

/** One button for alignment: left, then center, then right, then back to left. */
export function cycleAlign(text: string, start: number, end: number): Edit {
  const next: Record<Align, Align> = { left: "center", center: "right", right: "left" };
  return setAlign(text, start, end, next[alignAt(text, start)]);
}


/** A download button on its own line where the cursor is. */
export function downloadMarkdown(text: string, start: number, end: number, url: string): Edit {
  const before = start > 0 && text[start - 1] !== "\n" ? "\n\n" : "";
  const inserted = `${before}[DOWNLOAD]${url}[/DOWNLOAD]\n\n`;
  const caret = start + inserted.length;
  return { text: text.slice(0, start) + inserted + text.slice(end), start: caret, end: caret };
}
