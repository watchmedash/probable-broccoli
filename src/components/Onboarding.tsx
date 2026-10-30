"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import type { Hub } from "@/lib/types";
import { HubIcon } from "./Avatars";
import { Icon, I } from "./Icon";

/**
 * A fresh set of recovery codes, shown once. Opening it makes the set (any older one stops working),
 * so it's only reached right after sign-up or after confirming in Settings.
 */
export function RecoveryCodes() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const next = useSearchParams().get("next") === "welcome" ? "/welcome" : "/settings";
  useEffect(() => {
    let live = true;
    browserSupabase().rpc("new_recovery_codes").then(({ data, error }) => {
      if (!live) return;
      if (error) setError(errorMessage(error));
      else setCodes(data as string[]);
    });
    return () => { live = false; };
  }, []);
  return (
    <div className="form-page">
      <h1>Save these somewhere safe</h1>
      <p className="muted" style={{ margin: 0 }}>If you forget your password, one of these codes lets you set a new one. Each works once, and they won&apos;t be shown again.</p>
      {error && <p className="error">{error}</p>}
      {codes ? <div className="codes">{codes.map(c => <span key={c}>{c}</span>)}</div> : !error && <p className="muted">Making your codes...</p>}
      {codes && (
        <>
          <button
            className="btn quiet block"
            onClick={async () => {
              await navigator.clipboard.writeText("Nakodu recovery codes\n" + codes.join("\n"));
              setCopied(true);
            }}
          >
            <Icon icon={copied ? I.check : I.copy} size={14} /> {copied ? "Copied" : "Copy codes"}
          </button>
          <button className="btn block" onClick={() => { router.push(next); router.refresh(); }}>I saved them</button>
        </>
      )}
    </div>
  );
}

/** Right after sign-up: tap the hubs you like, then join them all at once, so Following isn't empty. */
export function PickHubs({ hubs }: { hubs: Hub[] }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function finish() {
    setBusy(true);
    const sb = browserSupabase();
    // A hub that fails to join can be joined later from Hubs; don't hold the person up.
    await Promise.all([...picked].map(id => sb.from("hub_members").insert({ hub_id: id })));
    router.push(picked.size ? "/?feed=following" : "/");
    router.refresh();
  }
  return (
    <div className="form-page" style={{ maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <h1 style={{ flex: 1 }}>Pick some hubs</h1>
        <button className="linkish" onClick={() => { router.push("/"); router.refresh(); }}>Skip</button>
      </div>
      <p className="muted" style={{ margin: 0 }}>Posts from the hubs you join show up in Following.</p>
      <div className="picker">
        {hubs.map(h => (
          <label key={h.id}>
            <input type="checkbox" checked={picked.has(h.id)} onChange={() => setPicked(p => { const n = new Set(p); if (n.has(h.id)) n.delete(h.id); else n.add(h.id); return n; })} style={{ width: 20, height: 20, accentColor: "var(--blue)" }} />
            <HubIcon hub={h} size={40} />
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <b>n/{h.name}</b>
              {h.description && <span className="muted small">{h.description}</span>}
            </span>
          </label>
        ))}
      </div>
      <button className="btn block" disabled={busy} onClick={finish}>
        {picked.size === 0 ? "Continue" : picked.size === 1 ? "Join 1 hub" : `Join ${picked.size} hubs`}
      </button>
    </div>
  );
}
