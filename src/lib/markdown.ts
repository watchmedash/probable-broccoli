import MarkdownIt from "markdown-it";

// Raw HTML is never allowed: it's escaped and shows as text.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false });

type Env = { allowedDomains?: string[]; preview?: boolean };

const isLocal = (href: string) => href.startsWith("/") && !href.startsWith("//");
const hostAllowed = (href: string, allowed: string[]) => {
  try {
    const host = new URL(href).hostname.toLowerCase();
    return allowed.some(d => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
};

// Outside links open in a new tab and are marked as user content. With an allow list (comments),
// links to other sites aren't links at all, just their text.
const defaultOpen = md.renderer.rules.link_open ?? ((tokens, i, opts, _env, self) => self.renderToken(tokens, i, opts));
const defaultClose = md.renderer.rules.link_close ?? ((tokens, i, opts, _env, self) => self.renderToken(tokens, i, opts));
md.renderer.rules.link_open = (tokens, i, opts, env: Env, self) => {
  const href = tokens[i].attrGet("href") ?? "";
  // [DOWNLOAD]url[/DOWNLOAD] arrives as a link titled DOWNLOAD_MARK, and shows as a button.
  const download = tokens[i].attrGet("title") === DOWNLOAD_MARK;
  if (download) {
    tokens[i].attrs = (tokens[i].attrs ?? []).filter(([k]) => k !== "title");
    tokens[i].attrJoin("class", "md-download");
  }
  if (env.preview && download) {
    tokens[i].meta = { dropped: true };
    return '<span class="md-download">';
  }
  // A feed card is one big link already, so links inside its preview are just styled text.
  if (env.preview) {
    tokens[i].meta = { dropped: true };
    return '<span class="md-link">';
  }
  if (!isLocal(href) && env.allowedDomains && !hostAllowed(href, env.allowedDomains)) {
    tokens[i].meta = { dropped: true };
    return "";
  }
  if (!isLocal(href)) {
    tokens[i].attrSet("rel", "nofollow ugc noopener");
    tokens[i].attrSet("target", "_blank");
  }
  return defaultOpen(tokens, i, opts, env, self);
};
md.renderer.rules.link_close = (tokens, i, opts, env, self) => {
  // Find the opening token of this link to see whether it was dropped.
  let depth = 0;
  for (let j = i - 1; j >= 0; j--) {
    if (tokens[j].type === "link_close") depth++;
    if (tokens[j].type === "link_open") {
      if (depth === 0) return tokens[j].meta?.dropped ? ((env as Env).preview ? "</span>" : "") : defaultClose(tokens, i, opts, env, self);
      depth--;
    }
  }
  return defaultClose(tokens, i, opts, env, self);
};
// >!text!< is a spoiler, [u]text[/u] underlines and [color=red]text[/color] colours. The markers are
// swapped for private characters first (so a line starting with >! isn't read as a quote), then
// turned into tags once the text is parsed.
const OPEN = "", CLOSE = "", U_OPEN = "", U_CLOSE = "", C_CLOSE = "";
const DOWNLOAD_MARK = "";
/** Text colours people can pick; each has a light and a dark shade in the stylesheet. */
export const TEXT_COLORS = ["red", "orange", "green", "blue", "purple", "gray"] as const;
const colorOpen = (i: number) => String.fromCharCode(0xe010 + i);
const MARK = /([--])/;
md.core.ruler.after("inline", "marks", state => {
  for (const block of state.tokens) {
    if (block.type !== "inline" || !block.children) continue;
    const out: typeof block.children = [];
    for (const t of block.children) {
      if (t.type !== "text" || !MARK.test(t.content)) { out.push(t); continue; }
      for (const piece of t.content.split(MARK)) {
        const code = piece.length === 1 ? piece.charCodeAt(0) : 0;
        if (piece === OPEN) {
          const open = new state.Token("spoiler_open", "span", 1);
          open.attrSet("class", "md-spoiler");
          out.push(open);
        } else if (piece === CLOSE || piece === C_CLOSE) out.push(new state.Token("span_close", "span", -1));
        else if (piece === U_OPEN) out.push(new state.Token("u_open", "u", 1));
        else if (piece === U_CLOSE) out.push(new state.Token("u_close", "u", -1));
        else if (code >= 0xe010 && code <= 0xe01f) {
          const open = new state.Token("color_open", "span", 1);
          open.attrSet("class", "md-c-" + TEXT_COLORS[code - 0xe010]);
          out.push(open);
        } else if (piece) {
          const text = new state.Token("text", "", 0);
          text.content = piece;
          out.push(text);
        }
      }
    }
    block.children = out;
  }
});
// One paragraph's worth: these tags can't reach across a blank line.
const SPAN = String.raw`((?:(?!\n[ \t]*\n)[\s\S])+?)`;
const UNDERLINE = new RegExp(String.raw`\[u\]` + SPAN + String.raw`\[\/u\]`, "gi");
const COLOR = new RegExp(String.raw`\[colou?r=([a-z]+)\]` + SPAN + String.raw`\[\/colou?r\]`, "gi");
const DOWNLOAD = /\[download(?:=([^\]\n]{1,40}))?\]\s*(https?:\/\/[^\s[\]()]+)\s*\[\/download\]/gi;
const LEFTOVER = /\[\/?(?:u|colou?r(?:=[a-z]*)?|center|right|download(?:=[^\]\n]*)?)\](?!\()/gi;

function markSpoilers(src: string): string {
  return src
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, i) => {
      if (i % 2) return part;
      let out = part
        .replace(DOWNLOAD, (_all, label: string | undefined, url: string) => `[${(label?.trim() || "Download").replace(/[[\]]/g, "")}](${url} "${DOWNLOAD_MARK}")`)
        .replace(/>!(?=\S)([^\n]*?\S)!</g, `${OPEN}$1${CLOSE}`);
      // A few rounds, so tags inside tags ([u][color=red]x[/color][/u]) all turn.
      for (let n = 0; n < 3; n++) {
        out = out
          .replace(UNDERLINE, (_a, t: string) => U_OPEN + t + U_CLOSE)
          .replace(COLOR, (all, c: string, t: string) => {
            const at = (TEXT_COLORS as readonly string[]).indexOf(c.toLowerCase());
            return at < 0 ? all : colorOpen(at) + t + C_CLOSE;
          });
      }
      return out;
    })
    .join("");
}

// [center]...[/center] and [right]...[/right] hold whole paragraphs, lists and pictures.
const ALIGN = /\[(center|right)\][ \t]*\n?([\s\S]*?)\n?[ \t]*\[\/\1\]/gi;
function renderAligned(src: string, render: (part: string) => string): string {
  let out = "";
  let last = 0;
  for (const m of src.matchAll(ALIGN)) {
    out += render(src.slice(last, m.index));
    out += `<div class="md-${m[1].toLowerCase()}">${render(m[2])}</div>`;
    last = m.index + m[0].length;
  }
  return out + render(src.slice(last));
}

// Pictures in text get lazy loading.
const defaultImage = md.renderer.rules.image!;
md.renderer.rules.image = (tokens, i, opts, env: Env, self) => {
  // A card shows its picture on its own, so previews leave pictures out.
  if (env.preview) return "";
  tokens[i].attrSet("loading", "lazy");
  return defaultImage(tokens, i, opts, env, self);
};

/**
 * u/name becomes a link, and so does n/name when that hub exists (pass the hub names, any case).
 * Code is left alone.
 */
export function linkMentions(src: string, hubs?: Iterable<string>): string {
  const known = new Set([...(hubs ?? [])].map(h => h.toLowerCase()));
  return src
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(/(^|[\s(])(u|n)\/([A-Za-z0-9_]{3,21})\b/g, (all, before: string, kind: string, name: string) =>
            kind === "n" && !known.has(name.toLowerCase()) ? all : `${before}[${kind}/${name}](/${kind}/${name})`,
          ),
    )
    .join("");
}

export function renderMarkdown(src: string, opts: { allowedDomains?: string[]; hubs?: Iterable<string> } = {}): string {
  const env = { allowedDomains: opts.allowedDomains } satisfies Env;
  return renderAligned(linkMentions(src ?? "", opts.hubs), part => (part.trim() ? md.render(markSpoilers(part), env) : ""));
}

/** A feed card's text: formatted like the post, without links or pictures, cut short. */
export function renderPreview(src: string, max = 700): string {
  const text = (src ?? "").length > max ? src.slice(0, max).replace(/\S*$/, "") + "…" : src ?? "";
  // A tag cut in half by the shortening shows as nothing rather than as "[color=red".
  return renderAligned(text, part => (part.trim() ? md.render(markSpoilers(part).replace(LEFTOVER, ""), { preview: true } satisfies Env) : ""));
}
