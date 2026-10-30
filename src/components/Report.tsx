"use client";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { REPORT_REASONS } from "@/lib/queries";
import { errorMessage } from "@/lib/errors";
import { useToast } from "./Toast";

type Target = { post_id: number } | { comment_id: number } | { user_id: string };

/** Report a post, comment or person, with the same reasons as the app. */
export function ReportDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  return (
    <div className="dialog-back" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal aria-labelledby="report-title" onClick={e => e.stopPropagation()}>
        <h2 id="report-title">Report</h2>
        <div className="picker">
          {REPORT_REASONS.map(([value, label]) => (
            <label key={value}>
              <input type="radio" name="reason" checked={reason === value} onChange={() => setReason(value)} />
              {label}
            </label>
          ))}
        </div>
        <div className="field">
          <label htmlFor="report-details">Anything else? (optional)</label>
          <textarea id="report-details" value={details} maxLength={500} onChange={e => setDetails(e.target.value)} style={{ minHeight: 80 }} />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn quiet" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            disabled={!reason || busy}
            onClick={async () => {
              setBusy(true);
              const { error } = await browserSupabase().from("reports").insert({ ...target, reason, details: details.trim() });
              setBusy(false);
              if (error) return setError(errorMessage(error));
              toast("Thanks. The mods will take a look.");
              onClose();
            }}
          >
            Send report
          </button>
        </div>
      </div>
    </div>
  );
}
