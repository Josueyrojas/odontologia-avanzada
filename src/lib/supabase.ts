import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Cliente de Supabase. Es null mientras no configures .env.local (la app usa datos de ejemplo). */
export const supabase = url && key ? createClient(url, key) : null;
