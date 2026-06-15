import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// API Key Service — manage workspace API keys
// Keys are generated client-side; only the SHA-256 hash is stored in the DB.
// The raw key is shown ONCE and never retrievable again.
// ─────────────────────────────────────────────────────────────────────────────

const KEY_PREFIX = "tf_live_";

/**
 * Generate a cryptographically random API key and its SHA-256 hash.
 * Returns { rawKey, keyHash, keyPrefix } — rawKey must be shown to the user once.
 */
export const generateApiKey = async () => {
  const random  = crypto.getRandomValues(new Uint8Array(32));
  const rawKey  = KEY_PREFIX + Array.from(random).map((b) => b.toString(16).padStart(2, "0")).join("");

  const encoded = new TextEncoder().encode(rawKey);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  const keyHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { rawKey, keyHash, keyPrefix: rawKey.slice(0, 12) + "..." };
};

/**
 * Create a new API key for the workspace.
 * @returns {{ rawKey: string, record: object }} — show rawKey once, never again.
 */
export const createApiKey = async (workspaceId, createdBy, name, scopes = ["tasks:read"]) => {
  const { rawKey, keyHash, keyPrefix } = await generateApiKey();

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      workspace_id: workspaceId,
      created_by:   createdBy,
      name,
      key_hash:     keyHash,
      key_prefix:   keyPrefix,
      scopes,
    })
    .select()
    .single();

  if (error) throw error;
  return { rawKey, record: data };
};

/**
 * List all API keys for a workspace (hashes hidden, only prefixes shown).
 */
export const getApiKeys = async (workspaceId) => {
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Revoke (deactivate) an API key.
 */
export const revokeApiKey = async (keyId) => {
  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", keyId);
  if (error) throw error;
};

/**
 * Permanently delete an API key.
 */
export const deleteApiKey = async (keyId) => {
  const { error } = await supabase.from("api_keys").delete().eq("id", keyId);
  if (error) throw error;
};

// All supported scopes
export const AVAILABLE_SCOPES = [
  { value: "tasks:read",    label: "Tasks — Read",    desc: "List and view tasks"    },
  { value: "tasks:write",   label: "Tasks — Write",   desc: "Create and update tasks" },
  { value: "members:read",  label: "Members — Read",  desc: "List workspace members" },
];
