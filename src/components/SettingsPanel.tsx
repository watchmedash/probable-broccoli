"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errors";
import { Icon, I } from "./Icon";
import { AccountSettings, AdminSettings } from "./MoreSettings";

function Row({ icon, title, sub, onClick, danger }: { icon: keyof typeof I; title: string; sub?: string | null; onClick?: () => void; danger?: boolean }) {
  return (
    <button className="hub-row" style={{ width: "100%", border: 0, borderBottom: "1px solid var(--line)", textAlign: "left", cursor: onClick ? "pointer" : "default", color: danger ? "var(--error)" : undefined }} onClick={onClick} disabled={!onClick}>
      <Icon icon={I[icon]} size={16} />
      <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <span>{title}</span>
        {sub && <span className="muted small">{sub}</span>}
      </span>
    </button>
  );
}

export function SettingsPanel({ username, admin }: { username: string; admin: boolean }) {
  const [left, setLeft] = useState<number | null>(null);
  const [dialog, setDialog] = useState<"codes" | "password" | "delete" | null>(null);
  const [pw, setPw] = useState({ a: "", b: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => { browserSupabase().rpc("recovery_codes_left").then(({ data }) => setLeft(typeof data === "number" ? data : null)); }, []);
  const close = () => { setDialog(null); setError(null); setPw({ a: "", b: "" }); };

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}><h1 style={{ margin: 0, fontSize: 22 }}>Settings</h1></div>
      <Row icon="user" title="Username" sub={`u/${username}`} />
      <Row
        icon="key"
        title="Recovery codes"
        sub={left == null ? null : left === 0 ? "None left. Make some so you can't get locked out." : left === 1 ? "1 left" : `${left} left`}
        onClick={left == null ? undefined : () => (left > 0 ? setDialog("codes") : router.push("/recovery-codes"))}
      />
      <Row icon="lock" title="Change password" onClick={() => setDialog("password")} />
      <Row icon="logout" title="Log out" onClick={async () => { await browserSupabase().auth.signOut(); router.push("/"); router.refresh(); }} />
      <Row icon="trash" title="Delete account" danger onClick={() => setDialog("delete")} />
      <AccountSettings />
      {admin && <AdminSettings />}

      {dialog && (
        <div className="dialog-back" onClick={close}>
          <div className="dialog" role="dialog" aria-modal onClick={e => e.stopPropagation()}>
            {dialog === "codes" && (
              <>
                <h2>Make new recovery codes?</h2>
                <p style={{ margin: 0 }}>Your current codes stop working.</p>
                <div className="row"><button className="btn quiet" onClick={close}>Cancel</button><button className="btn" onClick={() => router.push("/recovery-codes")}>Make new codes</button></div>
              </>
            )}
            {dialog === "password" && (
              <>
                <h2>Change password</h2>
                <div className="field"><label htmlFor="pw-a">New password</label><input id="pw-a" type="password" autoComplete="new-password" value={pw.a} onChange={e => setPw({ ...pw, a: e.target.value })} /></div>
                <div className="field"><label htmlFor="pw-b">Type it again</label><input id="pw-b" type="password" autoComplete="new-password" value={pw.b} onChange={e => setPw({ ...pw, b: e.target.value })} /></div>
                {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
                <div className="row">
                  <button className="btn quiet" onClick={close}>Cancel</button>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={async () => {
                      if (pw.a.length < 8) return setError("Password must be at least 8 characters");
                      if (pw.a !== pw.b) return setError("The passwords don't match");
                      setBusy(true);
                      const { error } = await browserSupabase().auth.updateUser({ password: pw.a });
                      setBusy(false);
                      if (error) return setError(errorMessage(error));
                      close();
                    }}
                  >
                    Save
                  </button>
                </div>
              </>
            )}
            {dialog === "delete" && (
              <>
                <h2>Delete your account?</h2>
                <p style={{ margin: 0 }}>This can&apos;t be undone. Your posts and comments stay as [deleted].</p>
                {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
                <div className="row">
                  <button className="btn quiet" onClick={close}>Cancel</button>
                  <button
                    className="btn danger"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const sb = browserSupabase();
                      const { error } = await sb.rpc("delete_my_account");
                      if (error) { setBusy(false); return setError(errorMessage(error)); }
                      await sb.auth.signOut({ scope: "local" });
                      router.push("/");
                      router.refresh();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
