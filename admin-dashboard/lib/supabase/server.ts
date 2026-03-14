import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // B7 fix: was a no-op, meaning refreshed JWTs were never written
        // back to the browser. Users would get silently logged out when
        // their token expired. This writes the updated cookies so the
        // session stays alive across Supabase token refreshes.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — cookie writes are only
            // possible in middleware or Server Actions. The session will
            // still be read correctly; this just means we can't refresh
            // it from a Server Component directly, which is expected.
          }
        },
      },
    }
  );
}