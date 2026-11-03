"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { CategoryPicker } from "./CategoryPicker";
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

/** Right after sign-up: pick at least three interests. Hubs in them come up more in your home feed. */
export function PickInterests() {
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  async function finish() {
    setBusy(true);
    const { error } = await browserSupabase().from("user_interests").insert(picked.map(category => ({ category })));
    setBusy(false);
    if (error && error.code !== "23505") return setError(errorMessage(error));
    router.push("/");
    router.refresh();
  }
  return (
    <div className="form-page" style={{ maxWidth: 820 }}>
      <h1>What are you into?</h1>
      <p className="muted" style={{ margin: 0 }}>Pick at least 3. Hubs about them show up more in your home feed.</p>
      <CategoryPicker value={picked} onChange={setPicked} />
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn block" disabled={busy || picked.length < 3} onClick={finish}>
        {picked.length < 3 ? `Pick ${3 - picked.length} more` : "Continue"}
      </button>
    </div>
  );
}
