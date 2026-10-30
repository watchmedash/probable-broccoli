export type VoteDir = "up" | "down";
export type VoteState = { score: number; mine: number };

/**
 * One press is one step, like the app: tapping your vote clears it, and the other arrow also only
 * clears it (5 upvoted, tap down: 4 neutral, tap down again: 3 downvoted).
 */
export function nextVote(mine: number, dir: VoteDir): number {
  if (mine !== 0) return 0;
  return dir === "up" ? 1 : -1;
}

export function applyVote(state: VoteState, dir: VoteDir): VoteState {
  const mine = nextVote(state.mine, dir);
  return { score: state.score - state.mine + mine, mine };
}
