import { describe, expect, it } from "vitest";
import { timeAgo, countLabel } from "./format";
import { nextVote, applyVote } from "./votes";
import { buildTree, type CommentSort } from "./comments";
import { renderMarkdown } from "./markdown";
import { youTubeId } from "./youtube";
import { firstBodyImage, imageMarkdown, isImageUrl, linePrefix, wrapSelection } from "./mdedit";

describe("timeAgo", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  it("uses short units like the app", () => {
    expect(timeAgo("2026-10-30T11:59:30Z", now)).toBe("now");
    expect(timeAgo("2026-10-30T11:45:00Z", now)).toBe("15m");
    expect(timeAgo("2026-10-30T02:00:00Z", now)).toBe("10h");
    expect(timeAgo("2026-10-27T12:00:00Z", now)).toBe("3d");
    expect(timeAgo("2026-09-30T12:00:00Z", now)).toBe("4w");
    expect(timeAgo("2025-10-01T12:00:00Z", now)).toBe("1y");
  });
});

describe("countLabel", () => {
  it("pluralises", () => {
    expect(countLabel(1, "member")).toBe("1 member");
    expect(countLabel(2, "member")).toBe("2 members");
    expect(countLabel(1234, "comment")).toBe("1,234 comments");
  });
});

describe("votes", () => {
  it("one press is one step", () => {
    expect(nextVote(0, "up")).toBe(1);
    expect(nextVote(0, "down")).toBe(-1);
    expect(nextVote(1, "up")).toBe(0);
    expect(nextVote(1, "down")).toBe(0);
    expect(nextVote(-1, "up")).toBe(0);
    expect(nextVote(-1, "down")).toBe(0);
  });
  it("moves the score by the change", () => {
    expect(applyVote({ score: 5, mine: 1 }, "down")).toEqual({ score: 4, mine: 0 });
    expect(applyVote({ score: 4, mine: 0 }, "down")).toEqual({ score: 3, mine: -1 });
    expect(applyVote({ score: 0, mine: 0 }, "down")).toEqual({ score: -1, mine: -1 });
  });
});

describe("comment tree", () => {
  const c = (id: number, parent: number | null, score: number, at: string) =>
    ({ id, parent_id: parent, score, created_at: at, body: "", depth: 0, deleted: false, post_id: 1, edited_at: null, author: null, my_vote: 0 });
  const rows = [c(1, null, 1, "2026-01-01"), c(2, null, 9, "2026-01-02"), c(3, 1, 0, "2026-01-03"), c(4, 1, 5, "2026-01-04")];
  const ids = (sort: CommentSort) => buildTree(rows, sort).map(n => [n.comment.id, n.children.map(k => k.comment.id)]);
  it("sorts each level", () => {
    expect(ids("top")).toEqual([[2, []], [1, [4, 3]]]);
    expect(ids("new")).toEqual([[2, []], [1, [4, 3]]]);
    expect(ids("old")).toEqual([[1, [3, 4]], [2, []]]);
  });
  it("keeps replies whose parent is missing at the top", () => {
    expect(buildTree([c(5, 99, 0, "2026-01-01")], "top").map(n => n.comment.id)).toEqual([5]);
  });
});

describe("markdown", () => {
  it("escapes raw html", () => {
    expect(renderMarkdown("<script>alert(1)</script>")).not.toContain("<script>");
  });
  it("links u/ and n/ mentions", () => {
    const html = renderMarkdown("ask u/nakodu in n/general");
    expect(html).toContain('href="/u/nakodu"');
    expect(html).toContain('href="/n/general"');
  });
  it("leaves mentions inside words alone", () => {
    expect(renderMarkdown("see menu/general")).not.toContain("href");
  });
  it("only links allowed sites when a list is given", () => {
    const md = "[a](https://youtube.com/x) and [b](https://evil.example/y)";
    const html = renderMarkdown(md, { allowedDomains: ["youtube.com"] });
    expect(html).toContain('href="https://youtube.com/x"');
    expect(html).not.toContain("evil.example/y\"");
  });
  it("marks outside links as user content", () => {
    expect(renderMarkdown("https://example.com")).toContain('rel="nofollow ugc noopener"');
  });
});

describe("youTubeId", () => {
  it("reads the common link shapes", () => {
    expect(youTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});

import { plainText } from "./format";
describe("plainText", () => {
  it("keeps underscores in links and words", () => {
    expect(plainText("see https://en.wikipedia.org/wiki/List_of_common_misconceptions now")).toBe("see https://en.wikipedia.org/wiki/List_of_common_misconceptions now");
    expect(plainText("snake_case **bold** _it_ ~~gone~~")).toBe("snake_case bold it gone");
  });
});

describe("post editor", () => {
  it("wraps a selection and takes the markers off again", () => {
    const on = wrapSelection("a word b", 2, 6, "**");
    expect(on).toEqual({ text: "a **word** b", start: 4, end: 8 });
    expect(wrapSelection(on.text, on.start, on.end, "**")).toEqual({ text: "a word b", start: 2, end: 6 });
  });
  it("prefixes every selected line and numbers lists", () => {
    expect(linePrefix("one\ntwo", 0, 7, "- ").text).toBe("- one\n- two");
    expect(linePrefix("- one\n- two", 0, 11, "- ").text).toBe("one\ntwo");
    expect(linePrefix("one\ntwo", 0, 7, "1. ", true).text).toBe("1. one\n2. two");
  });
  it("puts a picture on its own line at the cursor", () => {
    const e = imageMarkdown("hello", 5, 5, "https://x.co/a.png");
    expect(e.text).toBe("hello\n\n![](https://x.co/a.png)\n\n");
    expect(e.start).toBe(e.text.length);
  });
  it("only takes https picture addresses", () => {
    expect(isImageUrl("https://x.co/a.JPG?w=1", true)).toBe(true);
    expect(isImageUrl("https://x.co/page", true)).toBe(false);
    expect(isImageUrl("https://x.co/page", false)).toBe(true);
    expect(isImageUrl("http://x.co/a.png", false)).toBe(false);
    expect(isImageUrl("javascript:alert(1)", false)).toBe(false);
    expect(isImageUrl("https://x.co/a).png", false)).toBe(false);
  });
  it("finds the first picture in the text", () => {
    expect(firstBodyImage("hi ![](https://x.co/a.png) ![b](https://x.co/b.png)")).toBe("https://x.co/a.png");
    expect(firstBodyImage("no pictures")).toBeNull();
  });
});
