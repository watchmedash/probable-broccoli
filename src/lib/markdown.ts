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
// >!text!< is a spoiler. The markers are swapped for private characters first, so a line that
// starts with one isn't read as a quote.
const OPEN = "\uE000", CLOSE = "\uE001";
md.core.ruler.after("inline", "spoiler", state => {
  for (const block of state.tokens) {
    if (block.type !== "inline" || !block.children) continue;
    const out: typeof block.children = [];
    for (const t of block.children) {
      if (t.type !== "text" || !/[]/.test(t.content)) { out.push(t); continue; }
      for (const piece of t.content.split(/([])/)) {
        if (piece === OPEN) {
          const open = new state.Token("spoiler_open", "span", 1);
          open.attrSet("class", "md-spoiler");
          out.push(open);
        } else if (piece === CLOSE) out.push(new state.Token("spoiler_close", "span", -1));
        else if (piece) {
          const text = new state.Token("text", "", 0);
          text.content = piece;
          out.push(text);
        }
      }
    }
    block.children = out;
  }
});
function markSpoilers(src: string): string {
  return src
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/>!(?=\S)([^\n]*?\S)!</g, `${OPEN}$1${CLOSE}`)))
    .join("");
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
  return md.render(markSpoilers(linkMentions(src ?? "", opts.hubs)), { allowedDomains: opts.allowedDomains } satisfies Env);
}

/** A feed card's text: formatted like the post, without links or pictures, cut short. */
export function renderPreview(src: string, max = 700): string {
  const text = (src ?? "").length > max ? src.slice(0, max).replace(/\S*$/, "") + "…" : src ?? "";
  return md.render(markSpoilers(text), { preview: true } satisfies Env);
}
