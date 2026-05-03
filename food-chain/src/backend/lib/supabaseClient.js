/**
 * supabaseClient.js — Backend-only Supabase client
 *
 * Uses the SERVICE ROLE KEY which bypasses Row Level Security.
 * NEVER import this file from frontend / browser code.
 *
 * Required environment variables (set in .env or your deployment secrets):
 *   SUPABASE_URL              – e.g. https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY – long JWT starting with "eyJ…"
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    '[supabaseClient] Missing environment variable: SUPABASE_URL\n' +
    'Add it to your .env file or deployment secrets.'
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    '[supabaseClient] Missing environment variable: SUPABASE_SERVICE_ROLE_KEY\n' +
    'Add it to your .env file or deployment secrets. Never expose this key to the browser.'
  );
}

/**
 * Reusable Supabase admin client.
 *
 * Options:
 *  - auth.persistSession: false  — no cookie/localStorage on the server
 *  - auth.autoRefreshToken: false — service role tokens don't expire
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
