"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";

/** A chat starts as a request: they see your first message and choose whether to accept. */
export function NewChat({ to }: { to: string }) {
  const [username, setUsername] = useState(to);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="form-page">
      <h1>New chat</h1>
      <div className="field">
        <label htmlFor="to">To</label>
        <div className="prefix"><span>u/</span><input id="to" value={username} onChange={e => setUsername(e.target.value.replace(/^u\//, ""))} autoCapitalize="none" spellCheck={false} style={{ height: 42 }} /></div>
      </div>
      <div className="field">
        <label htmlFor="msg">Message</label>
        <textarea id="msg" value={body} maxLength={4000} onChange={e => setBody(e.target.value)} style={{ minHeight: 120 }} />
      </div>
      <p className="muted small" style={{ margin: 0 }}>They can accept or decline. Until they accept, you can&apos;t send more.</p>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button
        className="btn block"
        disabled={busy || !username.trim() || !body.trim()}
        onClick={async () => {
          setBusy(true);
          const { data, error } = await browserSupabase().rpc("start_chat", { to_username: username.trim(), first_message: body.trim() });
          setBusy(false);
          if (error) return setError(errorMessage(error).replace("Something went wrong. Try again in a moment.", error.message || "Couldn't start that chat."));
          router.push(`/messages/${data}`);
        }}
      >
        Send request
      </button>
    </div>
  );
}
