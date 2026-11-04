"use client";
import { useState } from "react";
import { AskDialog } from "./Dialogs";
import { Icon, I } from "./Icon";

/** Adds a gallery picture by its web address instead of uploading it. */
export function GalleryLink({ disabled, onAdd }: { disabled: boolean; onAdd: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn quiet" disabled={disabled} onClick={() => setOpen(true)}><Icon icon={I.image} size={13} /> Add by link</button>
      {open && (
        <AskDialog
          title="Add a picture by link"
          field
          placeholder="https://..."
          action="Add"
          onClose={() => setOpen(false)}
          onConfirm={url => {
            if (!/^https:\/\/\S+$/.test(url)) return "Paste a link that starts with https://";
            onAdd(url);
          }}
        />
      )}
    </>
  );
}
