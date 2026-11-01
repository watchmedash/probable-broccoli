"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";

export function MessageMods({ hubId, hubName }: { hubId: number; hubName: string }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="form-page">
      <h1>Message mods</h1>
      <p className="muted" style={{ margin: 0 }}>Goes to the mod team of n/{hubName}.</p>
      <div className="field"><label htmlFor="subject">Subject</label><input id="subject" value={subject} maxLength={120} onChange={e => setSubject(e.target.value)} /></div>
      <div className="field"><label htmlFor="body">Message</label><textarea id="body" value={body} maxLength={4000} onChange={e => setBody(e.target.value)} /></div>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button
        className="btn block"
        disabled={busy || !subject.trim() || !body.trim()}
        onClick={async () => {
          setBusy(true);
          const { data, error } = await browserSupabase().rpc("message_mods", { hub: hubId, subject: subject.trim(), body: body.trim() });
          setBusy(false);
          if (error) return setError(errorMessage(error));
          router.push(`/modmail/${data}`);
        }}
      >
        Send
      </button>
    </div>
  );
}
