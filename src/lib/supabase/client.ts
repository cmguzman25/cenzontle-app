import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase para componentes del navegador. */
export function createClient() {
  return createBrowserClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
  );
}
