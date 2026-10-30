"use client";
import { createContext, useCallback, useContext, useState } from "react";

const Ctx = createContext<(text: string) => void>(() => {});

/** Short messages at the bottom of the screen, like the app's snackbar. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [text, setText] = useState<string | null>(null);
  const show = useCallback((t: string) => {
    setText(t);
    window.setTimeout(() => setText(cur => (cur === t ? null : cur)), 3200);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {text && (
        <div role="status" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", background: "#111827", color: "#fff", padding: "10px 16px", borderRadius: 4, fontSize: 14, zIndex: 60, maxWidth: "calc(100% - 32px)" }}>
          {text}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
