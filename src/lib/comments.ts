import type { Comment } from "./types";

export type CommentSort = "top" | "new" | "old";
export type CommentNode = { comment: Comment; children: CommentNode[] };

const ORDER: Record<CommentSort, (a: Comment, b: Comment) => number> = {
  top: (a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at) || a.id - b.id,
  new: (a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id,
  old: (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
};

/** Threads the flat list and sorts every level. Replies whose parent isn't there go to the top level. */
export function buildTree(rows: Comment[], sort: CommentSort): CommentNode[] {
  const nodes = new Map<number, CommentNode>(rows.map(c => [c.id, { comment: c, children: [] }]));
  const roots: CommentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.comment.parent_id != null ? nodes.get(node.comment.parent_id) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sortAll = (list: CommentNode[]) => {
    list.sort((a, b) => ORDER[sort](a.comment, b.comment));
    list.forEach(n => sortAll(n.children));
  };
  sortAll(roots);
  return roots;
}
