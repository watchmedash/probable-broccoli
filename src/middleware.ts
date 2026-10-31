import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "./lib/config";

// Keeps the login fresh: an expired access token is swapped for a new one before the page renders.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const sb = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: list => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Reads the cookie and only calls out when the token has expired. Pages check who you are themselves.
  await sb.auth.getSession();
  return response;
}

export const config = {
  // Skip static files, pictures and the legal pages.
  matcher: ["/((?!_next/static|_next/image|img/|download/|\\.well-known/|favicon|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|html|txt|xml|json|apk)$).*)"],
};
