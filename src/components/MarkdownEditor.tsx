"use client";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import {
  faAlignCenter, faAlignLeft, faAlignRight, faBold, faCode, faDownload, faEyeSlash, faItalic, faLink, faListOl, faListUl,
  faPalette, faQuoteLeft, faStrikethrough, faUnderline,
} from "@fortawesome/free-solid-svg-icons";
import { useLayoutEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { renderMarkdown, TEXT_COLORS } from "@/lib/markdown";
import { downloadMarkdown, headingAt, imageMarkdown, isImageUrl, linePrefix, setAlign, setHeading, wrapSelection, wrapWith, type Edit } from "@/lib/mdedit";
import { uploadImage } from "@/lib/upload";
import { Icon, I } from "./Icon";

/**
 * Post text with formatting buttons. Pictures go in where the cursor is: pick a file, give an address,
 * paste or drop a picture, or paste a picture's address.
 */
export function MarkdownEditor({ id, label, value, onChange, maxLength, imagesAllowed = true }: {
  id: string; label: string; value: string; onChange: (v: string) => void; maxLength: number; imagesAllowed?: boolean;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<[number, number] | null>(null);
  const [preview, setPreview] = useState(false);
  const [uploads, setUploads] = useState(0);
  // The address row under the buttons, for a picture or a download.
  const [asking, setAsking] = useState<"image" | "download" | null>(null);
  const [colors, setColors] = useState(false);
  const [level, setLevel] = useState(0);
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Put the cursor back after the text changes under it.
  useLayoutEffect(() => {
    if (!pendingSelection.current || !box.current) return;
    box.current.focus();
    box.current.setSelectionRange(...pendingSelection.current);
    pendingSelection.current = null;
  });

  function apply(edit: (text: string, start: number, end: number) => Edit) {
    const el = box.current;
    if (!el) return;
    const next = edit(el.value, el.selectionStart, el.selectionEnd);
    pendingSelection.current = [next.start, next.end];
    onChange(next.text);
  }

  async function addFiles(files: File[]) {
    const pictures = files.filter(f => f.type.startsWith("image/"));
    if (!pictures.length) return;
    setError(null);
    setUploads(n => n + pictures.length);
    for (const file of pictures) {
      try {
        const url = await uploadImage(file, "post-images");
        apply((t, s, e) => imageMarkdown(t, s, e, url));
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setUploads(n => n - 1);
      }
    }
  }

  function addAddress() {
    const url = address.trim();
    if (!isImageUrl(url, false)) return setError("That needs to be a full https:// address.");
    setError(null);
    const kind = asking;
    setAsking(null);
    setAddress("");
    apply((t, s, e) => (kind === "download" ? downloadMarkdown(t, s, e, url) : imageMarkdown(t, s, e, url)));
  }

  const tool = (icon: IconDefinition, name: string, run: () => void) => (
    // Keep the selection in the text box when a button is pressed.
    <button type="button" className="md-tool" aria-label={name} title={name} onMouseDown={e => e.preventDefault()} onClick={run}>
      <Icon icon={icon} size={14} />
    </button>
  );

  const left = maxLength - value.length;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="md-editor">
        <div className="md-tools">
          {!preview && (
            <>
              <select
                className="md-style"
                aria-label="Paragraph style"
                value={level}
                onChange={e => { const n = Number(e.target.value); setLevel(n); apply((t, s, end) => setHeading(t, s, end, n)); }}
              >
                <option value={0}>Paragraph</option>
                <option value={1}>Heading 1</option>
                <option value={2}>Heading 2</option>
                <option value={3}>Heading 3</option>
              </select>
              {tool(faBold, "Bold", () => apply((t, s, e) => wrapSelection(t, s, e, "**")))}
              {tool(faItalic, "Italic", () => apply((t, s, e) => wrapSelection(t, s, e, "*")))}
              {tool(faUnderline, "Underline", () => apply((t, s, e) => wrapWith(t, s, e, "[u]", "[/u]")))}
              {tool(faStrikethrough, "Strikethrough", () => apply((t, s, e) => wrapSelection(t, s, e, "~~")))}
              <span className="md-colors">
                {tool(faPalette, "Text colour", () => setColors(c => !c))}
                {colors && (
                  <span className="md-swatches" role="menu">
                    {TEXT_COLORS.map(c => (
                      <button key={c} type="button" role="menuitem" className={`md-swatch md-c-${c}`} aria-label={c} title={c}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { setColors(false); apply((t, s, e) => wrapWith(t, s, e, `[color=${c}]`, "[/color]")); }} />
                    ))}
                  </span>
                )}
              </span>
              {tool(faEyeSlash, "Spoiler", () => apply((t, s, e) => wrapWith(t, s, e, ">!", "!<")))}
              {tool(faAlignLeft, "Align left", () => apply((t, s, e) => setAlign(t, s, e, "left")))}
              {tool(faAlignCenter, "Align center", () => apply((t, s, e) => setAlign(t, s, e, "center")))}
              {tool(faAlignRight, "Align right", () => apply((t, s, e) => setAlign(t, s, e, "right")))}
              {tool(faQuoteLeft, "Quote", () => apply((t, s, e) => linePrefix(t, s, e, "> ")))}
              {tool(faListUl, "List", () => apply((t, s, e) => linePrefix(t, s, e, "- ")))}
              {tool(faListOl, "Numbered list", () => apply((t, s, e) => linePrefix(t, s, e, "1. ", true)))}
              {tool(faCode, "Code", () => apply((t, s, e) => wrapSelection(t, s, e, "`")))}
              {tool(faLink, "Link", () => apply((t, s, e) => {
                const text = t.slice(s, e) || "text";
                const inserted = `[${text}](https://)`;
                const urlStart = s + text.length + 3;
                return { text: t.slice(0, s) + inserted + t.slice(e), start: urlStart, end: urlStart + 8 };
              }))}
              {tool(faDownload, "Download button", () => setAsking(a => (a === "download" ? null : "download")))}
              {imagesAllowed && (
                <>
                  <label className="md-tool" aria-label="Upload a picture" title="Upload a picture">
                    <Icon icon={I.imageOutline} size={14} />
                    <input type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
                  </label>
                  <button type="button" className="md-tool md-tool-text" onMouseDown={e => e.preventDefault()} onClick={() => setAsking(a => (a === "image" ? null : "image"))}>Image URL</button>
                </>
              )}
            </>
          )}
          <button type="button" className="linkish small md-preview" onClick={() => setPreview(p => !p)}>{preview ? "Edit" : "Preview"}</button>
        </div>
        {asking && !preview && (
          <div className="md-url">
            <input
              aria-label={asking === "download" ? "Download address" : "Image address"}
              placeholder="https://"
              value={address}
              autoFocus
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAddress(); } }}
            />
            <button type="button" className="btn" onClick={addAddress}>Add</button>
          </div>
        )}
        {preview ? (
          <div className="md md-preview-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(value || "*Nothing to preview*") }} />
        ) : (
          <textarea
            ref={box}
            id={id}
            onSelect={e => setLevel(headingAt(e.currentTarget.value, e.currentTarget.selectionStart))}
            value={value}
            maxLength={maxLength}
            onChange={e => onChange(e.target.value)}
            onPaste={e => {
              if (!imagesAllowed) return;
              const files = [...e.clipboardData.files];
              if (files.some(f => f.type.startsWith("image/"))) {
                e.preventDefault();
                addFiles(files);
                return;
              }
              const pasted = e.clipboardData.getData("text").trim();
              if (isImageUrl(pasted, true)) {
                e.preventDefault();
                apply((t, s, end) => imageMarkdown(t, s, end, pasted));
              }
            }}
            onDragOver={e => { if (imagesAllowed && e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
            onDrop={e => {
              if (!imagesAllowed || !e.dataTransfer.files.length) return;
              e.preventDefault();
              addFiles([...e.dataTransfer.files]);
            }}
          />
        )}
      </div>
      <div className="md-status small">
        <span className="error">{error}</span>
        <span className="muted">{uploads > 0 ? "Uploading..." : left < 2000 ? `${left.toLocaleString("en")} characters left` : ""}</span>
      </div>
    </div>
  );
}
