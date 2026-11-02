export type HotCandidate = { id: number; score: number; comment_count: number; created_at: string };

const HALF_LIFE_DAYS = 14;

/** How likely a post is to land near the top: votes and comments lift it, downvotes sink it, and age slowly fades it. */
export function hotWeight(p: HotCandidate, now: number): number {
  const talk = 1 + Math.max(p.score, 0) + 2 * p.comment_count;
  const sunk = p.score < 0 ? 1 - p.score : 1;
  const days = Math.max(now - new Date(p.created_at).getTime(), 0) / 86400000;
  return (talk / sunk) * 0.5 ** (days / HALF_LIFE_DAYS);
}

/** A weighted shuffle: every post gets a place, and heavier posts tend to come first. */
export function shuffleHot(posts: HotCandidate[], now = Date.now(), random: () => number = Math.random): number[] {
  return posts
    .map(p => ({ id: p.id, key: random() ** (1 / hotWeight(p, now)) }))
    .sort((a, b) => b.key - a.key)
    .map(p => p.id);
}
