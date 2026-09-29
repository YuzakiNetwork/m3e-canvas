import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* One client for the whole page. Collaboration and cloud save both sign in through it,
 * so they share a single auth session (a second client on the same storage key makes
 * supabase-js warn about multiple GoTrue instances and can make sign-in calls wait on
 * each other). NEXT_PUBLIC_* values are inlined by Next at build time, so they have to
 * be read as literal `process.env.NAME` expressions. */

let client: SupabaseClient | null = null;

const readEnv = () => {
  if (typeof window === "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
};

export const isSupabaseConfigured = () => !!readEnv();

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const env = readEnv();
  if (!env) return null;
  client = createClient(env.url, env.key);
  return client;
}

/** a message a person can act on, from whatever supabase-js or the realtime socket threw */
export function describeSupabaseError(error: unknown): string {
  const e = error as { message?: unknown; code?: unknown; hint?: unknown } | null;
  const message = typeof e?.message === "string" && e.message ? e.message : typeof error === "string" ? error : "Unknown error";
  const code = typeof e?.code === "string" && e.code ? ` [${e.code}]` : "";
  const hint =
    /anonymous/i.test(message) ? " — turn on Authentication › Sign In / Providers › Anonymous sign-ins."
    : /schema cache|does not exist|PGRST205|42P01/i.test(`${message}${code}`) ? " — run supabase/schema.sql in the SQL editor."
    : /partition/i.test(message) ? " — Realtime has not created today's message partition yet. Wait a minute and try again; if it keeps happening, check that the project is not paused and look at Logs › Realtime."
    : /infinite recursion/i.test(message) ? " — re-run the latest supabase/schema.sql (it replaces the old policies)."
    : /unauthorized|permission|not allowed|row-level security/i.test(message) ? " — check the policies from supabase/schema.sql and that Realtime › Settings › Allow public access is off."
    : "";
  return `${message}${code}${hint}`;
}
