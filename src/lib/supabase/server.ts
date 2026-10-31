import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { SUPABASE_KEY, SUPABASE_URL } from "../config";

/** A Supabase client for server components, acting as whoever is logged in (or as a guest). */
export async function serverSupabase() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: list => {
        // Server components can't set cookies; the middleware refreshes them instead.
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {}
      },
    },
  });
}

/** The logged-in user's id and username, or null for guests. Asked once per page, however many parts need it. */
export const currentUser = cache(async () => {
  const sb = await serverSupabase();
  const { data } = await sb.auth.getUser();
  const u = data.user;
  if (!u) return null;
  const username = (u.user_metadata?.username as string | undefined) ?? u.email?.split("@")[0] ?? "me";
  return { id: u.id, username };
});
