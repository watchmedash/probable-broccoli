import MarkdownIt from "markdown-it";

// Raw HTML is never allowed: it's escaped and shows as text.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false });

type Env = { allowedDomains?: string[] };

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
      if (depth === 0) return tokens[j].meta?.dropped ? "" : defaultClose(tokens, i, opts, env, self);
      depth--;
    }
  }
  return defaultClose(tokens, i, opts, env, self);
};
// Pictures in text get lazy loading.
const defaultImage = md.renderer.rules.image!;
md.renderer.rules.image = (tokens, i, opts, env, self) => {
  tokens[i].attrSet("loading", "lazy");
  return defaultImage(tokens, i, opts, env, self);
};

/** u/name and n/name become links, the way the app treats them. Code is left alone. */
function linkMentions(src: string): string {
  return src
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/(^|[\s(])(u|n)\/([A-Za-z0-9_]{3,21})\b/g, "$1[$2/$3](/$2/$3)")))
    .join("");
}

export function renderMarkdown(src: string, opts: { allowedDomains?: string[] } = {}): string {
  return md.render(linkMentions(src ?? ""), { allowedDomains: opts.allowedDomains } satisfies Env);
}
