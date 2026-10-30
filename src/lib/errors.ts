/** Turns a Supabase error into one sentence, the way the app words it. */
export function errorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string; status?: number; name?: string } | null;
  const code = err?.code ?? "";
  const msg = err?.message ?? "";
  // The database explains its own rules: word filter, prefixes, posting limits, site bans.
  if (["NK001", "NK002", "NK003"].includes(code)) return msg;
  if (code === "NK004") return msg || "This account is banned.";
  if (code === "23505") return "That already exists.";
  if (code === "23514" || code === "22001") return "That doesn't fit the rules. Check the length and characters.";
  if (code === "42501") return "You don't have permission to do that.";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) return "Wrong username or password.";
  if (code === "user_already_exists" || code === "email_exists") return "That username is taken";
  if (code === "weak_password") return "That password is too weak. Try a longer one.";
  if (code === "captcha_failed" || /captcha/i.test(msg)) return "The check didn't go through. Wait for the tick and try again.";
  if (code === "over_request_rate_limit" || err?.status === 429) return "Too many tries right now. Try again in a little while.";
  if (err?.name === "TypeError" || /fetch/i.test(msg)) return "Can't reach Nakodu. Check your connection and try again.";
  return "Something went wrong. Try again in a moment.";
}
