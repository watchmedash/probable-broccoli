"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { hiddenEmail, SUPABASE_KEY, SUPABASE_URL } from "@/lib/config";
import { errorMessage } from "@/lib/errors";
import { Icon, I } from "./Icon";
import { Turnstile } from "./Turnstile";

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

function Password({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="prefix">
        <input id={id} type={shown ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete} style={{ height: 42 }} />
        <button type="button" className="icon-btn" onClick={() => setShown(s => !s)} aria-label={shown ? "Hide password" : "Show password"}>
          <Icon icon={shown ? I.eyeOff : I.eye} size={14} />
        </button>
      </div>
    </div>
  );
}

function Username({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor="username">Username</label>
      <input id="username" value={value} onChange={e => onChange(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />
    </div>
  );
}

/** Only same-site paths, so a crafted link can't send people elsewhere after logging in. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/** Google signs you in; a new account then picks its username and birthday. */
function GoogleButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn quiet block google-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await browserSupabase().auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
          });
        }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {busy ? "Opening Google..." : "Continue with Google"}
      </button>
      <div className="or-line"><span>or</span></div>
    </>
  );
}

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return setError("Enter your username and password");
    if (!token) return setError("Finish the check above the button first");
    setBusy(true);
    setError(null);
    const { error } = await browserSupabase().auth.signInWithPassword({ email: hiddenEmail(username), password, options: { captchaToken: token } });
    setRound(r => r + 1);
    setBusy(false);
    if (error) return setError(errorMessage(error));
    router.push(next);
    router.refresh();
  }

  return (
    <form className="form-page" onSubmit={submit}>
      <h1>Welcome back</h1>
      <GoogleButton next={next} />
      <Username value={username} onChange={v => { setUsername(v); setError(null); }} />
      <Password id="password" label="Password" value={password} onChange={v => { setPassword(v); setError(null); }} autoComplete="current-password" />
      <Turnstile round={round} onToken={setToken} />
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn block" disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
      <Link href="/recover" className="linkish" style={{ textAlign: "center" }}>Forgot your password?</Link>
      <p className="muted small" style={{ textAlign: "center", margin: 0 }}>New to Nakodu? <Link href="/signup" className="linkish">Sign up</Link></p>
    </form>
  );
}

export function SignUpForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [birthday, setBirthday] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function age(iso: string) {
    const b = new Date(iso + "T00:00:00Z"), n = new Date();
    let a = n.getUTCFullYear() - b.getUTCFullYear();
    if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--;
    return a;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim();
    const problem =
      !USERNAME.test(name) ? "Usernames are 3 to 20 letters, numbers or _" :
      password.length < 8 ? "Password must be at least 8 characters" :
      password !== confirm ? "The passwords don't match" :
      !birthday ? "Enter your birthday" :
      age(birthday) < 13 ? "You need to be at least 13 to join Nakodu" :
      !token ? "Finish the check above the button first" : null;
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const sb = browserSupabase();
    const { data: free } = await sb.rpc("username_available", { name });
    if (free === false) {
      setBusy(false);
      return setError("That username isn't available");
    }
    const { error } = await sb.auth.signUp({
      email: hiddenEmail(name),
      password,
      options: { captchaToken: token!, data: { username: name, birth_date: birthday } },
    });
    setRound(r => r + 1);
    setBusy(false);
    if (error) return setError(errorMessage(error));
    // New accounts get their recovery codes, then pick some hubs.
    router.push("/recovery-codes?next=welcome");
    router.refresh();
  }

  return (
    <form className="form-page" onSubmit={submit}>
      <h1>Join Nakodu</h1>
      <GoogleButton next="/" />
      <Username value={username} onChange={v => { setUsername(v); setError(null); }} />
      <Password id="password" label="Password" value={password} onChange={v => { setPassword(v); setError(null); }} autoComplete="new-password" />
      <Password id="confirm" label="Type the password again" value={confirm} onChange={v => { setConfirm(v); setError(null); }} autoComplete="new-password" />
      <div className="field">
        <label htmlFor="birthday">Birthday</label>
        <input id="birthday" type="date" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={e => { setBirthday(e.target.value); setError(null); }} />
      </div>
      <div className="note"><Icon icon={I.lock} size={13} /> Next you&apos;ll get recovery codes. With no email, they&apos;re the only way back in if you forget your password.</div>
      <Turnstile round={round} onToken={setToken} />
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn block" disabled={busy}>{busy ? "Creating your account..." : "Create account"}</button>
      <p className="muted small" style={{ textAlign: "center", margin: 0 }}>
        By creating an account you agree to the <Link href="/terms" className="linkish">Terms</Link>, the <Link href="/rules" className="linkish">Rules</Link> and the <Link href="/privacy" className="linkish">Privacy Policy</Link>. You must be at least 13.
      </p>
      <p className="muted small" style={{ textAlign: "center", margin: 0 }}>Already have an account? <Link href="/login" className="linkish">Log in</Link></p>
    </form>
  );
}

/** "Forgot password": one recovery code sets a new password (the recover server function). */
export function RecoverForm() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem =
      !username.trim() || !code.trim() ? "Enter your username and a recovery code" :
      password.length < 8 ? "Password must be at least 8 characters" :
      password !== confirm ? "The passwords don't match" : null;
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/recover`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ username: username.trim(), code: code.trim(), password }),
      });
      if (r.status === 429) setError("Too many tries. Wait an hour and try again.");
      else if (r.status === 400) setError("That username and code don't match. Check both and try again.");
      else if (!r.ok) setError("Something went wrong. Try again in a moment.");
      else setDone(true);
    } catch {
      setError("Can't reach Nakodu. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="form-page">
        <h1>Password changed</h1>
        <p style={{ margin: 0 }}>Log in with your new password. That recovery code is used up.</p>
        <Link href="/login" className="btn block">Log in</Link>
      </div>
    );
  }
  return (
    <form className="form-page" onSubmit={submit}>
      <h1>Use a recovery code</h1>
      <p className="muted" style={{ margin: 0 }}>You got them when you signed up. Each code works once.</p>
      <Username value={username} onChange={v => { setUsername(v); setError(null); }} />
      <div className="field">
        <label htmlFor="code">Recovery code</label>
        <input id="code" value={code} placeholder="XXXXX-XXXXX" onChange={e => { setCode(e.target.value.toUpperCase().slice(0, 20)); setError(null); }} autoCapitalize="characters" spellCheck={false} />
      </div>
      <Password id="password" label="New password" value={password} onChange={v => { setPassword(v); setError(null); }} autoComplete="new-password" />
      <Password id="confirm" label="Type the new password again" value={confirm} onChange={v => { setConfirm(v); setError(null); }} autoComplete="new-password" />
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn block" disabled={busy}>Set new password</button>
    </form>
  );
}

/** A new Google account's first visit: its username and birthday, then interests. */
export function FinishSignUp() {
  const [username, setUsername] = useState("");
  const [birthday, setBirthday] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!USERNAME.test(name)) return setError("Usernames are 3 to 20 letters, numbers or _");
    if (!birthday) return setError("Enter your birthday");
    setBusy(true);
    const { error } = await browserSupabase().rpc("finish_signup", { new_username: name, birth_date: birthday });
    setBusy(false);
    if (error) return setError(errorMessage(error).replace("Something went wrong. Try again in a moment.", error.message));
    router.push("/welcome");
    router.refresh();
  }
  return (
    <form className="form-page" onSubmit={submit}>
      <h1>Pick a username</h1>
      <p className="muted" style={{ margin: 0 }}>It&apos;s how people see you on Nakodu. You can&apos;t change it later.</p>
      <Username value={username} onChange={v => { setUsername(v); setError(null); }} />
      <div className="field">
        <label htmlFor="birthday">Birthday</label>
        <input id="birthday" type="date" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={e => { setBirthday(e.target.value); setError(null); }} />
      </div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn block" disabled={busy}>{busy ? "Saving..." : "Continue"}</button>
    </form>
  );
}
